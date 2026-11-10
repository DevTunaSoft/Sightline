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
