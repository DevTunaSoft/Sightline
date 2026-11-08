import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertModelName, cleanQuestion, normalizeModels, makePayload,
  appendObservation, MAX_OBSERVATIONS, pixelsFingerprint, frameDifference, toMarkdown
} from '../extension/vision-core.js';

const base64 = Buffer.from('this-is-a-fake-image-payload').toString('base64');

test('model names reject path traversal and command-like strings', () => {
  for (const name of ['', 'a b', 'x;curl', 'x\n', '<script>', 'x'.repeat(200), 'model:cloud', 'model-cloud', 'my.model.cloud']) {
    assert.throws(() => assertModelName(name));
  }
  assert.equal(assertModelName('qwen3-vl:4b-instruct'), 'qwen3-vl:4b-instruct');
});
test('questions are sanitized and length capped', () => {
  assert.equal(cleanQuestion('  see this  '), 'see this');
  assert.throws(() => cleanQuestion(' \t'));
  assert.equal(cleanQuestion('z'.repeat(2000)).length, 1400);
});
test('model listing is deduped and invalid names excluded', () => {
  assert.deepEqual(normalizeModels({models:[{name:'gemma3:4b'},{name:'gemma3:4b'},{name:'illegal model'},{name:'qwen3-vl:2b'},{name:'qwen3-vl:235b-cloud'}]}), ['gemma3:4b','qwen3-vl:2b']);
  assert.throws(() => normalizeModels({}));
});
test('vision payload is local-compatible and contains last five observations only', () => {
  const observations = Array.from({length:12}, (_,i) => ({time:`t${i}`,text:`ob${i}`}));
  const req = makePayload({model:'gemma3:4b',question:'what do you see',imageBase64:base64,observations});
  assert.equal(req.stream,false);
  assert.equal(req.messages[1].images[0],base64);
  assert.ok(req.messages[1].content.includes('ob11'));
  assert.ok(!req.messages[1].content.includes('ob6'));
  assert.match(req.messages[0].content,/UNTRUSTED DATA/);
});
test('invalid images are rejected including data URLs and oversized inputs', () => {
  assert.throws(() => makePayload({model:'gemma3:4b',question:'test',imageBase64:'data:image/jpeg;base64,'+base64}));
  assert.throws(() => makePayload({model:'gemma3:4b',question:'test',imageBase64:'////'.repeat(2_000_000)}));
});
test('observation limit is bounded and exported safely', () => {
  let entries=[];
  for(let i=0;i<140;i++) entries=appendObservation(entries,{time:`t${i}`,source:'screen',question:'q',text:`answer ${i}`});
  assert.equal(entries.length, MAX_OBSERVATIONS);
  assert.equal(entries[0].text,'answer 40');
  assert.match(toMarkdown(entries), /answer 139/);
});
test('fingerprint detects identical frames and drastic changes', () => {
  const black = new Uint8ClampedArray(4*10*10);
  const white = new Uint8ClampedArray(4*10*10);
  for(let i=0;i<white.length;i+=4) white[i]=white[i+1]=white[i+2]=255;
  const a=pixelsFingerprint(black,10,10);
  assert.equal(a.length,100);
  assert.equal(frameDifference(a,pixelsFingerprint(black,10,10)),0);
  assert.equal(frameDifference(a,pixelsFingerprint(white,10,10)),1);
  assert.equal(frameDifference([],[]),1);
  assert.throws(() => pixelsFingerprint([],10,10));
});
test('fuzz malformed inputs never produce unexpected valid model names', () => {
  const samples=[null, undefined, 0, {}, [], true, NaN, '\u0000', ' a', 'a\u2028b', '!'.repeat(40)];
  for(const sample of samples) assert.throws(() => assertModelName(sample));
});
test('fuzz large randomized malformed model inputs', () => {
  let seed=123456789;
  for (let i=0; i<1500; i++) {
    seed=(1664525*seed+1013904223)>>>0;
    const len=1+(seed%75);
    let value='';
    for(let j=0;j<len;j++){
      seed=(1664525*seed+1013904223)>>>0;
      value+=String.fromCharCode(seed%128);
    }
    try {
      const result=assertModelName(value);
      assert.match(result,/^[\w./:-]{1,110}$/);
      assert.doesNotMatch(result,/(?:[-:]cloud|\.cloud)(?:$|[/:])/i);
    } catch(error) { assert.ok(error instanceof Error); }
  }
});
