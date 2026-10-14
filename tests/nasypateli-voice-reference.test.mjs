import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {applyVoiceReference,validateVoiceFile,createReferenceCapture,voiceReferenceClient} from '../lib/nasypateli-voice-reference.mjs';
import handler from '../api/nasypateli-live.js';
function harness(acquireOverride){
  const samples=[],states=[],messages=[];let stopped=0,time=0,tick=null;
  const stream={getTracks:()=>[{stop(){stopped++;}}]};
  class Recorder{static latest;static isTypeSupported(t){return t.startsWith('audio/webm');}constructor(){Recorder.latest=this;this.mimeType='audio/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';}finish(){this.ondataavailable?.({data:new Blob([new Uint8Array(100)],{type:this.mimeType})});this.onstop?.();}}
  const capture=createReferenceCapture({Recorder,acquire:acquireOverride||(()=>Promise.resolve(stream)),onSample:(...x)=>samples.push(x),onStatus:x=>messages.push(x),onState:x=>states.push(x),now:()=>time,every:fn=>{tick=fn;return 1;},cancel:()=>{tick=null;}});
  return {capture,Recorder,stream,samples,states,messages,get stopped(){return stopped;},advance(n){time=n;tick?.();}};
}
test('file preparation rejects executable formats, invalid MIME and oversized audio',()=>{
  assert.equal(validateVoiceFile({name:'мой голос.m4a',size:500,type:'audio/mp4'}),'m4a');
  assert.throws(()=>validateVoiceFile({name:'page.html',size:100,type:'text/html'}));
  assert.throws(()=>validateVoiceFile({name:'audio.wav',size:100,type:'text/html'}));
  assert.throws(()=>validateVoiceFile({name:'a.wav',size:16*1024*1024,type:'audio/wav'}));
  assert.throws(()=>validateVoiceFile({name:'a.wav',size:0}));
});
test('no microphone acquired before explicit start; serialized stop prevents overlapping sessions',async()=>{
  const h=harness();assert.equal(h.Recorder.latest,undefined);assert.equal(h.capture.state,'idle');
  assert.equal(await h.capture.start(),true);assert.equal(h.capture.state,'recording');assert.equal(await h.capture.start(),false);
  h.advance(45000);h.capture.stop();assert.equal(h.capture.state,'stopping');assert.equal(await h.capture.start(),false);
  h.Recorder.latest.finish();assert.equal(h.capture.state,'idle');assert.equal(h.samples.length,1);assert.equal(h.samples[0][2],45);assert.ok(h.stopped>0);
  h.capture.dispose();assert.equal(await h.capture.start(),false);
});
test('canceling a pending permission request immediately stops a late granted stream',async()=>{
  let grant;const h=harness(()=>new Promise(resolve=>{grant=resolve;}));const pending=h.capture.start();
  assert.equal(h.capture.state,'requesting');h.capture.stop();grant(h.stream);assert.equal(await pending,false);assert.equal(h.stopped,1);assert.equal(h.samples.length,0);
});
test('late rejected request does not interrupt a newer recording',async()=>{
  let rejectOld,n=0;const h=harness(()=>++n===1?new Promise((_,reject)=>{rejectOld=reject;}):Promise.resolve(h.stream));
  const pending=h.capture.start();h.capture.stop();assert.equal(await h.capture.start(),true);rejectOld(new Error('old rejection'));await pending;
  assert.equal(h.capture.state,'recording');h.capture.dispose();assert.equal(h.samples.length,0);
});
test('90-second limit and disposal release device tracks without further callbacks',async()=>{
  const h=harness();await h.capture.start();h.advance(90000);assert.equal(h.capture.state,'stopping');h.Recorder.latest.finish();assert.equal(h.samples.length,1);
  await h.capture.start();const recorder=h.Recorder.latest;h.capture.dispose();recorder.finish();assert.equal(h.samples.length,1);assert.ok(h.stopped>=2);
});
test('private transform preserves anonymous HTML and explicitly declares no cloning capability',()=>{
  assert.equal(applyVoiceReference('<html>login</html>'),'<html>login</html>');
  const html=applyVoiceReference('<html><style nonce="synthetic"></style><body><aside id="console"><div class="portrait-note"></div></aside></body></html>');
  assert.match(html,/id="voiceReferencePanel"/);assert.match(html,/синтез новых фраз этим голосом пока не подключён/);
  assert.match(html,/type="module" nonce="synthetic"/);assert.equal(applyVoiceReference(html),html);
  const client=voiceReferenceClient.toString()+createReferenceCapture.toString();
  assert.doesNotMatch(client,/fetch\(|XMLHttpRequest|sendBeacon|localStorage|indexedDB|BroadcastChannel/);
  assert.match(client,/view.*stage/);assert.match(client,/voiceOwnerConsent/);
});
test('password gate remains intact and CSP permits only local blob audio',()=>{
  const keys=['NASYPATELI_LIVE_PASSWORD','NASYPATELI_LIVE_SESSION_SECRET'];const old=keys.map(k=>process.env[k]);const secrets=keys.map(()=>randomBytes(40).toString('base64url'));keys.forEach((k,i)=>process.env[k]=secrets[i]);
  const serve=(method='GET',body={},cookie='')=>{const res={code:200,body:'',headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.code=n;return this;},send(v){this.body=v;},end(){}};handler({method,headers:{host:'example.test',origin:'https://example.test',cookie},body},res);return res;};
  try{
    const anonymous=serve();assert.doesNotMatch(anonymous.body,/id="voiceReferencePanel"/);
    const login=serve('POST',{action:'login',password:secrets[0]});assert.equal(login.code,303);
    const page=serve('GET',{},login.headers['set-cookie'].split(';')[0]);assert.match(page.body,/id="voiceReferencePanel"/);
    assert.match(page.headers['content-security-policy'],/media-src blob:/);assert.match(page.headers['content-security-policy'],/connect-src 'none'/);
    keys.forEach((_,i)=>assert.ok(!page.body.includes(secrets[i])));
  }finally{keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
