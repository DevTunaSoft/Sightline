import test from 'node:test';
import assert from 'node:assert/strict';
import { RefRegistry } from '../extension/ref-registry.js';
import { createDomActionAdapter } from '../extension/dom-action-adapter.js';
import { executeValidatedAction } from '../extension/action-executor-core.js';

function fakeElement(overrides={}) {
  const events=[];
  return {
    isConnected:true, disabled:false, value:'', innerText:'', textContent:'', checked:false,
    attrs:{}, events,
    getAttribute(name){ return this.attrs[name] ?? null; },
    dispatchEvent(event){ events.push(event.type); return true; },
    focus(){ this.focused=true; }, scrollIntoView(){ this.scrolled=true; },
    click(){ this.clicked=(this.clicked||0)+1; if ('checked' in this && this.toggleOnClick) this.checked=!this.checked; },
    ...overrides,
  };
}

function setup(element, windowObject={Event:globalThis.Event,scrollBy(){}}) {
  const registry=new RefRegistry(); registry.replace('snap',[{ref:'@e1',value:element}]);
  return createDomActionAdapter({registry,snapshotId:'snap',windowObject,documentObject:{body:{innerText:'Page ready'},activeElement:element}});
}

test('adapter clicks current registered element', async () => {
  const el=fakeElement(); const result=await executeValidatedAction({action:'click',ref:'@e1'},setup(el));
  assert.equal(result.ok,true); assert.equal(el.clicked,1); assert.equal(el.scrolled,true);
});
test('adapter types through normal input/change events', async () => {
  const el=fakeElement({value:'old'}); const result=await executeValidatedAction({action:'type',ref:'@e1',text:'new'},setup(el));
  assert.equal(result.ok,true); assert.equal(el.value,'new'); assert.deepEqual(el.events,['input','change']);
});
test('adapter refuses password fields even if action reaches executor', async () => {
  const el=fakeElement({attrs:{type:'password'}}); const result=await executeValidatedAction({action:'type',ref:'@e1',text:'secret'},setup(el));
  assert.equal(result.ok,false); assert.equal(result.code,'SENSITIVE_FIELD'); assert.equal(el.value,'');
});
test('adapter detects unavailable select option', async () => {
  const el=fakeElement({tagName:'SELECT',options:[{value:'a'},{value:'b'}]}); const result=await executeValidatedAction({action:'select',ref:'@e1',value:'c'},setup(el));
  assert.equal(result.ok,false); assert.equal(result.code,'OPTION_NOT_FOUND');
});


test('iframe input dispatch uses target document event realm', async () => {
  class FrameEvent {
    constructor(type){ this.type=type; this.realm='frame'; }
  }
  const el=fakeElement({
    ownerDocument:{defaultView:{Event:FrameEvent}},
    value:'',
  });
  const registry=new RefRegistry(); registry.replace('snap',[{ref:'@e1',value:el}]);
  const adapter=createDomActionAdapter({
    registry,
    snapshotId:'snap',
    windowObject:{Event:class TopEvent{constructor(type){this.type=type;this.realm='top';}}},
    documentObject:{body:{innerText:'Page'},activeElement:el},
  });
  await executeValidatedAction({action:'type',ref:'@e1',text:'abc'},adapter);
  assert.deepEqual(el.events,['input','change']);
});

test('pressKey descends into same-origin focused iframe', async () => {
  const keyEvents=[];
  class FrameKeyboardEvent {
    constructor(type,options){ this.type=type; this.key=options.key; }
  }
  const inner={
    tagName:'INPUT',
    ownerDocument:{defaultView:{KeyboardEvent:FrameKeyboardEvent}},
    dispatchEvent(event){ keyEvents.push([event.type,event.key]); return true; },
  };
  const frame={
    tagName:'IFRAME',
    contentDocument:{activeElement:inner,body:inner},
  };
  const adapter=createDomActionAdapter({
    registry:new RefRegistry(),
    snapshotId:'snap',
    windowObject:{},
    documentObject:{activeElement:frame,body:frame},
  });
  const result=await executeValidatedAction({action:'pressKey',key:'Enter'},adapter);
  assert.equal(result.ok,true);
  assert.deepEqual(keyEvents,[['keydown','Enter'],['keyup','Enter']]);
});

test('adapter blocks all sensitive reference operations and active-key dispatch', async () => {
  const el=fakeElement({tagName:'INPUT',attrs:{type:'password'},value:'canary-password',textContent:'canary-password',toggleOnClick:true});
  const adapter=setup(el,{Event:globalThis.Event,KeyboardEvent:globalThis.KeyboardEvent});
  for(const action of [
    {action:'read',ref:'@e1'},
    {action:'click',ref:'@e1'},
    {action:'type',ref:'@e1',text:'x'},
    {action:'clear',ref:'@e1'},
    {action:'select',ref:'@e1',value:'x'},
    {action:'check',ref:'@e1'},
    {action:'uncheck',ref:'@e1'},
    {action:'verify',ref:'@e1',expect:'canary'},
    {action:'pressKey',key:'Enter'},
  ]) {
    const result=await executeValidatedAction(action,adapter);
    assert.equal(result.ok,false,action.action);
    assert.equal(result.code,'SENSITIVE_FIELD',action.action);
  }
  assert.equal(el.value,'canary-password');
  assert.equal(el.clicked,undefined);
  assert.deepEqual(el.events,[]);
});
test('select refuses non-select inputs before changing value', async () => {
  const el=fakeElement({tagName:'INPUT',value:'unchanged'});
  const result=await executeValidatedAction({action:'select',ref:'@e1',value:'changed'},setup(el));
  assert.equal(result.ok,false);
  assert.equal(result.code,'NOT_SELECTABLE');
  assert.equal(el.value,'unchanged');
});

test('value setter works when inherited beyond the immediate prototype', async () => {
  const root = { set value(value) { this._value = value; }, get value() { return this._value || ''; } };
  const intermediate = Object.create(root);
  const el = fakeElement({tagName:'INPUT'});
  Object.setPrototypeOf(el, intermediate);
  delete el.value;
  el._value = '';
  el.isConnected = true; el.disabled = false;
  el.getAttribute = () => null;
  el.dispatchEvent = () => true;
  const result = await executeValidatedAction({action:'type',ref:'@e1',text:'updated'},setup(el));
  assert.equal(result.ok,true);
  assert.equal(el.value,'updated');
});

test('sensitive uncheck never triggers a click', async () => {
  const el=fakeElement({attrs:{type:'password'},checked:true,toggleOnClick:true});
  const result=await executeValidatedAction({action:'uncheck',ref:'@e1'},setup(el));
  assert.equal(result.ok,false);
  assert.equal(result.code,'SENSITIVE_FIELD');
  assert.equal(el.clicked,undefined);
});

test('verify receipts contain only a verdict and never echo the expectation text', async () => {
  const secret='synthetic-sensitive-canary-007';
  const element=fakeElement({tagName:'DIV',textContent:'Result: '+secret});
  const result=await executeValidatedAction(
    {action:'verify',ref:'@e1',expect:secret},
    setup(element));
  assert.equal(result.ok,true);
  assert.equal(result.matched,true);
  assert.equal(Object.hasOwn(result,'expectation'),false);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-sensitive-canary-007/);
});

test('many completed waits release abort listeners instead of retaining closures', async () => {
  const adapter=setup(fakeElement());
  const controller=new AbortController();
  const signal=controller.signal;
  const add=signal.addEventListener.bind(signal);
  const remove=signal.removeEventListener.bind(signal);
  let registered=0;
  let peak=0;
  signal.addEventListener=(...args)=>{
    if(args[0]==='abort'){registered++;peak=Math.max(peak,registered);}
    return add(...args);
  };
  signal.removeEventListener=(...args)=>{
    if(args[0]==='abort')registered--;
    return remove(...args);
  };
  for(let i=0;i<120;i++){
    const result=await adapter.wait({ms:0},{signal});
    assert.equal(result.ok,true);
    assert.equal(registered,0,'wait '+i);
  }
  assert.equal(peak,1);
});

test('aborting a wait cancels its timer and removes the listener', async () => {
  const adapter=setup(fakeElement());
  const controller=new AbortController();
  let adds=0, removes=0;
  const add=controller.signal.addEventListener.bind(controller.signal);
  const remove=controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener=(...args)=>{adds++;return add(...args);};
  controller.signal.removeEventListener=(...args)=>{removes++;return remove(...args);};
  const pending=adapter.wait({ms:5000},{signal:controller.signal});
  controller.abort();
  const result=await pending;
  assert.equal(result.ok,false);
  assert.equal(result.code,'ABORTED');
  assert.equal(adds,1);
  assert.equal(removes,1);
});

test('read and verify reject oversized text instead of returning a misleading success', async () => {
  const element=fakeElement({tagName:'DIV', textContent:'ready '+ 'x'.repeat(20000)});
  const adapter=setup(element);
  const read=await executeValidatedAction({action:'read',ref:'@e1'},adapter);
  assert.equal(read.ok,false);
  assert.equal(read.code,'INCOMPLETE_OBSERVATION');
  assert.ok(read.text.length<=4000);
  const verify=await executeValidatedAction({action:'verify',ref:'@e1',expect:'ready'},adapter);
  assert.equal(verify.ok,false);
  assert.equal(verify.matched,false);
  assert.equal(verify.code,'INCOMPLETE_OBSERVATION');
});

test('read-only tree walk stops at a bounded number of text nodes', async () => {
  let nextCalls=0;
  const doc={
    defaultView:{NodeFilter:{SHOW_TEXT:4}},
    createTreeWalker:()=>({nextNode(){
      nextCalls++;
      return nextCalls<=20000 ? {
        nodeValue:' ',parentElement:{closest:()=>null},
      } : null;
    }}),
  };
  const element=fakeElement({tagName:'DIV',ownerDocument:doc});
  const result=await executeValidatedAction({action:'read',ref:'@e1'},setup(element));
  assert.equal(result.ok,false);
  assert.equal(result.code,'INCOMPLETE_OBSERVATION');
  assert.ok(nextCalls<=6001);
});

test('text source scan exhaustion also stops DOM reads early', async () => {
  let nextCalls=0;
  const doc={
    defaultView:{NodeFilter:{SHOW_TEXT:4}},
    createTreeWalker:()=>({nextNode(){
      nextCalls++;
      return {
        nodeValue:' '.repeat(100000),
        parentElement:{closest:()=>null},
      };
    }}),
  };
  const result=await executeValidatedAction(
    {action:'read',ref:'@e1'},
    setup(fakeElement({tagName:'DIV',ownerDocument:doc})));
  assert.equal(result.ok,false);
  assert.equal(result.code,'INCOMPLETE_OBSERVATION');
  assert.ok(nextCalls<=4);
});

test('complete short DOM text remains readable and verifiable', async () => {
  let offset=0;
  const doc={
    defaultView:{NodeFilter:{SHOW_TEXT:4}},
    createTreeWalker:()=>{
      offset=0;
      const nodes=['Welcome','back'].map(value=>({
        nodeValue:value,parentElement:{closest:()=>null},
      }));
      return {nextNode:()=>nodes[offset++]||null};
    },
  };
  const adapter=setup(fakeElement({tagName:'DIV',ownerDocument:doc}));
  const read=await executeValidatedAction({action:'read',ref:'@e1'},adapter);
  assert.equal(read.ok,true);
  assert.equal(read.text,'Welcome back');
  const verify=await executeValidatedAction(
    {action:'verify',ref:'@e1',expect:'welcome back'},adapter);
  assert.equal(verify.ok,true);
  assert.equal(verify.matched,true);
});

test('large select options cannot cause an unbounded allocation or full scan', async () => {
  let inspected=0;
  const options=new Proxy({length:100000}, {
    get(target,key) {
      if (key==='length') return target.length;
      if (/^\d+$/.test(String(key))) {
        inspected++;
        return {value:'option-'+key};
      }
    },
  });
  const element=fakeElement({tagName:'SELECT',options,value:'initial'});
  const result=await executeValidatedAction(
    {action:'select',ref:'@e1',value:'option-90000'},setup(element));
  assert.equal(result.ok,false);
  assert.equal(result.code,'OPTION_SCOPE_UNVERIFIED');
  assert.equal(inspected,2048);
  assert.equal(element.value,'initial');
});

test('select can use an early verified option in a large live collection', async () => {
  let inspected=0;
  const options=new Proxy({length:100000}, {
    get(target,key) {
      if (key==='length') return target.length;
      if (/^\d+$/.test(String(key))) {
        inspected++;
        return {value:key==='3'?'desired':'another'};
      }
    },
  });
  const element=fakeElement({tagName:'SELECT',options,value:''});
  const result=await executeValidatedAction(
    {action:'select',ref:'@e1',value:'desired'},setup(element));
  assert.equal(result.ok,true);
  assert.equal(result.value,'desired');
  assert.equal(inspected,4);
});

test('select fails closed when no options are available', async () => {
  const element=fakeElement({tagName:'SELECT',options:[],value:'unchanged'});
  const result=await executeValidatedAction(
    {action:'select',ref:'@e1',value:'missing'},setup(element));
  assert.equal(result.ok,false);
  assert.equal(result.code,'OPTION_NOT_FOUND');
  assert.equal(element.value,'unchanged');
});

test('adapter refuses name-masked credential identifiers before any side effect', async () => {
  const el=fakeElement({
    tagName:'INPUT',attrs:{type:'text',name:'notes',id:'new_password'},
    value:'synthetic-private-value',textContent:'synthetic-private-value',
  });
  const adapter=setup(el);
  const actions=[
    {action:'read',ref:'@e1'}, {action:'verify',ref:'@e1',expect:'synthetic'},
    {action:'click',ref:'@e1'}, {action:'type',ref:'@e1',text:'x'},
    {action:'clear',ref:'@e1'}, {action:'pressKey',key:'Enter'},
  ];
  for(const action of actions){
    const result=await executeValidatedAction(action,adapter);
    assert.equal(result.ok,false,action.action);
    assert.equal(result.code,'SENSITIVE_FIELD',action.action);
  }
  assert.equal(el.value,'synthetic-private-value');
  assert.equal(el.clicked,undefined);
  assert.equal(el.focused,undefined);
});

test('adapter protects ordinary text inputs marked sensitive only by accessible hints', async () => {
  for (const attrs of [
    {type:'text','aria-label':'Enter password'},
    {type:'text',placeholder:'Security code'},
    {type:'text',autocomplete:'section-login current-password'},
  ]) {
    const el=fakeElement({tagName:'INPUT',attrs,value:'safe-old-value'});
    const result=await executeValidatedAction({action:'type',ref:'@e1',text:'new'},setup(el));
    assert.equal(result.code,'SENSITIVE_FIELD');
    assert.equal(el.value,'safe-old-value');
    assert.equal(el.focused,undefined);
  }
});

test('noneditable show-password button is not wrongly treated as a secret field', async () => {
  const el=fakeElement({tagName:'BUTTON',attrs:{'aria-label':'Show password'}});
  const result=await executeValidatedAction({action:'click',ref:'@e1'},setup(el));
  assert.equal(result.ok,true);
  assert.equal(el.clicked,1);
});

test('adapter refuses sensitive fields identified only by external labels', async () => {
  const cases=[
    {labels:[{textContent:'Enter password'}]},
    {labels:[{textContent:'Security code'}]},
    {
      ownerDocument:{getElementById:id=>id==='linked'?{textContent:'One time code'}:null},
      attrs:{'aria-labelledby':'linked'},
    },
  ];
  for(const fields of cases){
    const el=fakeElement({tagName:'INPUT',value:'synthetic-private-text',...fields});
    const adapter=setup(el);
    for(const action of [
      {action:'read',ref:'@e1'}, {action:'verify',ref:'@e1',expect:'synthetic'},
      {action:'click',ref:'@e1'}, {action:'type',ref:'@e1',text:'new'},
      {action:'clear',ref:'@e1'},{action:'pressKey',key:'Enter'},
    ]) {
      const result=await executeValidatedAction(action,adapter);
      assert.equal(result.code,'SENSITIVE_FIELD',action.action);
      assert.equal(result.ok,false,action.action);
    }
    assert.equal(el.value,'synthetic-private-text');
    assert.equal(el.focused,undefined);
    assert.equal(el.clicked,undefined);
  }
});

test('action-time linked-label change invalidates the previously ordinary target', async () => {
  const label={textContent:'Notes'};
  const el=fakeElement({tagName:'INPUT',labels:[label],value:'draft'});
  const adapter=setup(el);
  label.textContent='Enter password';
  const result=await executeValidatedAction({action:'type',ref:'@e1',text:'new'},adapter);
  assert.equal(result.code,'SENSITIVE_FIELD');
  assert.equal(el.value,'draft');
});
