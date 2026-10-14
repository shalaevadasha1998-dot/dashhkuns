import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import handler from '../api/nasypateli-live.js';
const tmp=process.env.RUNNER_TEMP;const require=createRequire(join(tmp,'voice-tools','package.json'));const {chromium,webkit}=require('playwright');
const out=join(tmp,'nasypateli-voice-proof');await mkdir(out,{recursive:true});
const password=randomBytes(40).toString('base64url');process.env.NASYPATELI_LIVE_PASSWORD=password;process.env.NASYPATELI_LIVE_SESSION_SECRET=randomBytes(48).toString('base64url');
const assets=new Map([['/nasypateli-live',['nasypateli-login.html','text/html; charset=utf-8']],['/assets/nasypateli-entry.css',['assets/nasypateli-entry.css','text/css']],['/assets/nasypateli-mark.webp',['assets/nasypateli-mark.webp','image/webp']]]);
const server=createServer({key:await readFile(join(tmp,'voice.key')),cert:await readFile(join(tmp,'voice.crt'))},async(req,res)=>{
  try{const path=new URL(req.url,'https://localhost').pathname;const asset=assets.get(path);if(asset&&req.method==='GET'){res.setHeader('Content-Type',asset[1]);res.setHeader('Referrer-Policy','same-origin');res.end(await readFile(asset[0]));return;}if(path!=='/nasypateli-live/app'){res.statusCode=404;res.end();return;}let body='';for await(const chunk of req)body+=chunk;req.body=body;res.status=function(n){this.statusCode=n;return this;};res.send=function(v){this.end(v);return this;};handler(req,res);}catch(error){res.statusCode=500;res.end('local test error');console.error(error.name);}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base='https://127.0.0.1:'+server.address().port;
// Synthetic 1-second sine, not a person's voice.
const wave=Buffer.alloc(44+16000*2);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(16000,24);wave.writeUInt32LE(32000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(32000,40);for(let i=0;i<16000;i++)wave.writeInt16LE(Math.round(1200*Math.sin(2*Math.PI*220*i/16000)),44+i*2);
let failures=0;const results=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}: {})});
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const result={engine:name,scope:'isolated HTTPS, synthetic credentials and synthetic sound'};
  try{
    await page.goto(base+'/nasypateli-live');assert.equal(await page.locator('#voiceReferencePanel').count(),0);
    await page.locator('#password').fill(password);await page.locator('button[type=submit]').click();await page.locator('#console').waitFor();
    await page.locator('#voiceReferencePanel > summary').click();assert.equal(await page.locator('#ownVoiceFile').isDisabled(),true);await page.locator('#voiceOwnerConsent').check();
    const network=[];page.on('request',r=>{if(r.method()!=='GET')network.push(r.url());});
    await page.locator('#ownVoiceFile').setInputFiles({name:'synthetic-reference.wav',mimeType:'audio/wav',buffer:wave});
    await page.locator('#ownVoicePlayer').waitFor({state:'visible'});assert.ok((await page.locator('#ownVoicePlayer').getAttribute('src')).startsWith('blob:'));
    assert.equal(await page.locator('#downloadOwnVoice').isEnabled(),true);const downloading=page.waitForEvent('download');await page.locator('#downloadOwnVoice').click();const download=await downloading;assert.equal(download.suggestedFilename(),'dashhkuns-voice-reference.wav');assert.equal(await download.failure(),null);
    await page.locator('#ownVoicePlayer').evaluate(a=>a.play());await page.locator('#panicStop').click();assert.equal(await page.locator('#ownVoicePlayer').evaluate(a=>a.paused),true);
    await page.locator('#clearOwnVoice').click();assert.equal(await page.locator('#ownVoicePlayer').isVisible(),false);assert.equal(await page.locator('#downloadOwnVoice').isDisabled(),true);
    if(name==='chromium'){
      await page.locator('#recordOwnVoice').click();await page.waitForFunction(()=>document.getElementById('voiceReferenceStatus').textContent.includes('идёт запись'));await page.waitForTimeout(1100);await page.locator('#stopOwnVoice').click();await page.waitForFunction(()=>!document.getElementById('downloadOwnVoice').disabled);assert.equal(await page.locator('#stopOwnVoice').isDisabled(),true);result.fakeDeviceRecording=true;
      await page.locator('#clearOwnVoice').click();await page.locator('#recordOwnVoice').click();await page.waitForFunction(()=>document.getElementById('voiceReferenceStatus').textContent.includes('идёт запись'));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('recordOwnVoice').disabled);result.escapeStopsRecorder=true;
    }
    await page.locator('#ownVoiceFile').setInputFiles({name:'synthetic-reference.wav',mimeType:'audio/wav',buffer:wave});
    // Confirm replacement in Chromium after the second synthetic recording.
    result.noAudioNetworkRequests=network.length===0;assert.equal(network.length,0);
    await page.locator('#voiceReferencePanel').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,name+'-voice-panel.png')});
    await page.setViewportSize({width:390,height:844});await page.locator('#voiceReferencePanel').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,name+'-voice-mobile.png')});
    assert.equal(errors.length,0);result.consent=true;result.filePreview=true;result.export=true;result.noJavascriptErrors=true;result.ok=true;
  }catch(error){result.ok=false;result.error=error.message.slice(0,300);failures++;await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});}
  results.push(result);console.log(JSON.stringify(result));await context.close();await browser.close();
}
server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile(join(out,'report.json'),JSON.stringify({results,failures},null,2));if(failures)process.exitCode=1;
