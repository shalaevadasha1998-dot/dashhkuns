import test from 'node:test';
import assert from 'node:assert/strict';
import {wakeText,tidySpoken,writeWave,applyAutoLive} from '../lib/nasypateli-auto-live.mjs';

test('wake detection accepts real name and common recognition variants only',()=>{
  for(const text of ['насыпатель, а ты что думаешь?','а что, на сыпатель?','насипатель, ответь','Nasypatel, слышишь?'])
    assert.equal(wakeText(text),true,text);
  for(const text of ['насыпатели','про насыпателей','насЫпатели, молодцы','ты слышишь?','насипатели'])
    assert.equal(wakeText(text),false,text);
});

test('spoken output has no sentence-ending periods but retains decimals and questions',()=>{
  assert.equal(tidySpoken('мы думаем. и вот почему. а ты?'),'мы думаем и вот почему а ты?');
  assert.equal(tidySpoken('2.5 и 3.14. всё!'),'2.5 и 3.14 всё!');
  assert.equal(tidySpoken('раз… два. готово'),'раз два готово');
});

test('16khz wav encoder yields a valid mono PCM wave',()=>{
  const chunks=[Float32Array.from({length:8000},(_,i)=>Math.sin(i/12)*.02)];
  const value=writeWave(chunks,16000);
  const bytes=Buffer.from(value,'base64');
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');
  assert.equal(bytes.subarray(8,16).toString(),'WAVEfmt ');
  assert.equal(bytes.readUInt16LE(22),1);
  assert.equal(bytes.readUInt32LE(24),16000);
  assert.equal(bytes.readUInt16LE(34),16);
  assert.equal(bytes.readUInt32LE(40),16000);
  assert.equal(bytes.length,16044);
});

test('only authenticated studio receives auto controls, animation and nonce script',()=>{
  const nonce='SyntheticNonce2026';
  const login='<html><style nonce="'+nonce+'"></style><body><input id="password"></body></html>';
  assert.equal(applyAutoLive(login),login);
  const page='<html><style nonce="'+nonce+'"></style><body><div id="console"><div class="mode"></div></div><div id="character" data-state="idle"></div><textarea id="cue" rows="4" maxlength="750"></textarea></body></html>';
  const result=applyAutoLive(page);
  assert.match(result,/id="autoLivePanel"/);
  assert.match(result,/class="ear-loader"/);
  assert.match(result,/maxlength="2400"/);
  assert.match(result,/script type="module" nonce="SyntheticNonce2026"/);
  assert.equal(applyAutoLive(result),result);
});
