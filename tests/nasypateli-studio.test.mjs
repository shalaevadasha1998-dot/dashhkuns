import test from 'node:test';
import assert from 'node:assert/strict';
import {studioTime,parseStudioTranscript,validateStudioArchive,searchStudioQuotes,applyStudio,studioClient} from '../lib/nasypateli-studio.mjs';

test('timecodes are deterministic and ordered',()=>{
  assert.equal(studioTime(3671),'01:01:11');assert.equal(studioTime(-1),'00:00:00');
  const rows=parseStudioTranscript('00:01:14 | иван | свобода требует ответственности\n00:02:12 | дора | а что насчёт обстоятельств?');
  assert.equal(rows[0].seconds,74);assert.equal(rows[0].speaker,'иван');assert.equal(rows[0].reviewed,false);
  assert.throws(()=>parseStudioTranscript('00:01:14 | иван | текст\n00:00:01 | дора | текст'),/порядку/);
  assert.throws(()=>parseStudioTranscript('00:80:00 | иван | текст'),/таймкод/);
  assert.throws(()=>parseStudioTranscript('неразмеченный текст'),/формат/);
});
test('archive import validates shape and resets all imported review flags',()=>{
  const rows=parseStudioTranscript('00:00:01 | иван | точная цитата');rows[0].reviewed=true;
  const data={project:'nasypateli',version:3,episodes:[{id:'aaaaaaaa-bbbb-cccc',title:'пилот',items:rows}]};
  const imported=validateStudioArchive(data);assert.equal(imported[0].items[0].text,rows[0].text);assert.equal(imported[0].items[0].reviewed,false);
  assert.throws(()=>validateStudioArchive({...data,project:'nasypateli-cinema'}));
  assert.throws(()=>validateStudioArchive({...data,version:2}));
  assert.throws(()=>validateStudioArchive({...data,episodes:[data.episodes[0],data.episodes[0]]}));
  assert.throws(()=>validateStudioArchive({...data,episodes:[{...data.episodes[0],items:[{...rows[0],seconds:Infinity}]}]}));
});
test('search never surfaces unchecked statements or invents memories',()=>{
  const rows=parseStudioTranscript('00:00:01 | иван | свобода требует ответственности\n00:00:02 | дора | свобода зависит от обстоятельств');
  const eps=[{id:'episode-test-001',title:'свобода',items:rows}];assert.deepEqual(searchStudioQuotes(eps,'свобода'),[]);
  rows[0].reviewed=true;const found=searchStudioQuotes(eps,'ответственности');assert.equal(found.length,1);assert.equal(found[0].speaker,'иван');assert.equal(found[0].seconds,1);assert.equal(found[0].text,'свобода требует ответственности');assert.equal(found[0].episodeId,eps[0].id);
  assert.deepEqual(searchStudioQuotes(eps,'несуществующееслово'),[]);
});
test('empty transcript is rejected and active source HTML is stored as text only',()=>{
  assert.throws(()=>parseStudioTranscript('  '));
  const q=parseStudioTranscript('00:00:01 | иван | <img src=x onerror=alert(1)>');assert.equal(q[0].text,'<img src=x onerror=alert(1)>');assert.equal(q[0].reviewed,false);
  assert.doesNotMatch(studioClient.toString(),/\.innerHTML\s*=/);
});
test('unauthed responses are returned byte for byte',()=>{
  const login='<html><style nonce="test">body{}</style><input id="password"></html>';
  assert.equal(applyStudio(login),login);assert.equal(applyStudio(undefined),undefined);
});
test('enhancement creates one scoped client and does not retain legacy code',()=>{
  const input='<html><head><style nonce="abcdefghijklmnop">body{}</style></head><body><div id="stage"><div id="character"></div><button class="fullscreen" id="fullscreen"></button></div><aside id="console"><div class="mode"></div><div class="portrait-note"></div></aside><script type="module" nonce="abcdefghijklmnop">legacyPlaceholder();</script></body></html>';
  const out=applyStudio(input);assert.ok(out.includes('id="panicStop"'));assert.ok(out.includes('id="episodeArchive"'));assert.ok(out.includes('id="enableStageAudio"'));assert.ok(out.includes('BroadcastChannel'));assert.ok(!out.includes('legacyPlaceholder'));
  const script=out.match(/<script type="module" nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Function(script));assert.doesNotMatch(script,/fetch\(|supabase|OPENAI_API_KEY|NASYPATELI_LIVE_PASSWORD/);
});
