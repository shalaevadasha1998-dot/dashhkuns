import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import handler from '../api/nasypateli-live.js';
const tmp=process.env.RUNNER_TEMP;
const require=createRequire(join(tmp,'ui-tools','package.json'));
const {chromium,webkit}=require('playwright');
const out=join(tmp,'nasypateli-studio-proof');await mkdir(out,{recursive:true});
const password=randomBytes(30).toString('base64url');
process.env.NASYPATELI_LIVE_PASSWORD=password;
process.env.NASYPATELI_LIVE_SESSION_SECRET=randomBytes(48).toString('base64url');
const assets=new Map([
 ['/nasypateli-live',['nasypateli-login.html','text/html; charset=utf-8']],
 ['/assets/nasypateli-entry.css',['assets/nasypateli-entry.css','text/css']],
 ['/assets/nasypateli-mark.webp',['assets/nasypateli-mark.webp','image/webp']]
]);
const server=createServer({key:await readFile(join(tmp,'identity.key')),cert:await readFile(join(tmp,'identity.crt'))},async(req,res)=>{
 try{
  const path=new URL(req.url,'https://localhost').pathname;const asset=assets.get(path);
  if(asset&&req.method==='GET'){res.setHeader('Content-Type',asset[1]);res.setHeader('Referrer-Policy','same-origin');res.end(await readFile(asset[0]));return;}
  if(path!=='/nasypateli-live/app'){res.statusCode=404;res.end();return;}
  let body='';for await(const c of req)body+=c;
  req.body=body;res.status=function(n){this.statusCode=n;return this;};res.send=function(v){this.end(v);return this;};handler(req,res);
 }catch(e){res.statusCode=500;res.end('isolated test server error');console.error(e.name);}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='https://127.0.0.1:'+server.address().port;
const results=[];let failures=0;
for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
 const page=await ctx.newPage(),errors=[];ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 const result={engine:name,scope:'isolated HTTPS, generated credentials; no real microphone or voice output'};
 try{
  await page.goto(base+'/nasypateli-live');await page.locator('#password').fill(password);await page.locator('button[type=submit]').click();await page.locator('#console').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('nasypateli.studio.v3')),null);result.storageOptIn=true;
  const popup=ctx.waitForEvent('page');await page.locator('#openStage').click();const stage=await popup;await stage.waitForLoadState('domcontentloaded');
  await page.waitForFunction(()=>document.getElementById('screenStatus')?.textContent.includes('экран подключён'));
  assert.equal(await stage.locator('#console').isVisible(),false);assert.equal(await stage.locator('#caption').textContent(),'');
  const first='а что могло бы изменить твоё мнение?';await page.locator('#cue').fill(first);assert.equal(await stage.locator('#caption').textContent(),'');
  await page.locator('#showCue').click();await stage.waitForFunction(t=>document.getElementById('caption')?.textContent===t,first);result.explicitPublication=true;
  await page.locator('#cue').fill('черновик не должен попасть в кадр');assert.equal(await stage.locator('#caption').textContent(),first);result.draftIsolation=true;
  await page.getByText('заготовки реплик',{exact:true}).click();await page.locator('#queueCue').click();assert.equal(await page.locator('#cueQueue article').count(),1);
  await page.getByText('выпуск и память',{exact:true}).click();
  await page.locator('#transcriptInput').fill('00:01:24 | иван | свобода требует ответственности\n00:01:45 | дора | желание зависит от обстоятельств');await page.locator('#importTranscript').click();
  await page.locator('#quoteQuery').fill('свобода');await page.locator('#searchQuotes').click();assert.ok((await page.locator('#quoteResults').textContent()).includes('проверенных цитат по запросу нет'));
  await page.locator('#episodeArchive summary').first().click();await page.locator('#episodeArchive input[type=checkbox]').nth(1).check();await page.locator('#searchQuotes').click();
  assert.ok((await page.locator('#quoteResults').textContent()).includes('свобода требует ответственности'));assert.ok((await page.locator('#quoteResults').textContent()).includes('00:01:24'));result.reviewedSources=true;
  await page.getByText('сохранение и резервная копия',{exact:true}).click();await page.locator('#saveLocal').check();
  await page.waitForFunction(()=>Boolean(localStorage.getItem('nasypateli.studio.v3')));
  const download=page.waitForEvent('download');await page.locator('#exportArchive').click();const file=await download;const path=join(out,name+'-synthetic-archive.json');await file.saveAs(path);const exported=JSON.parse(await readFile(path,'utf8'));assert.equal(exported.project,'nasypateli');assert.equal(exported.episodes[0].items.length,3);assert.ok(!JSON.stringify(exported).includes('черновик не должен попасть'));result.backup=true;
  await page.locator('#startClock').click();await page.waitForTimeout(1150);await page.locator('#startClock').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nasypateli.studio.v3')).elapsedSeconds>=1);
  const savedClock=await page.locator('#episodeClock').textContent();
  await page.screenshot({path:join(out,name+'-archive.png'),fullPage:true});
  await page.reload();await page.locator('#console').waitFor();assert.equal(await page.locator('#cue').inputValue(),'черновик не должен попасть в кадр');assert.equal(await page.locator('#episodeClock').textContent(),savedClock);result.pausedClockRestored=true;
  await stage.waitForFunction(()=>document.getElementById('caption')?.textContent==='');result.recoveryWithoutPublication=true;
  await page.locator('#showCue').click();await stage.waitForFunction(()=>document.getElementById('caption')?.textContent==='черновик не должен попасть в кадр');await page.locator('#panicStop').click();await stage.waitForFunction(()=>document.getElementById('caption')?.textContent==='');result.emergencyStop=true;
  const other=await ctx.newPage();await other.goto(base+'/nasypateli-live/app');await other.locator('#cue').fill('другой зал');await other.locator('#showCue').click();await stage.waitForTimeout(250);assert.equal(await stage.locator('#caption').textContent(),'');result.roomIsolation=true;await other.close();
  await page.locator('#cue').fill('свой черновик после изменения архива в другой вкладке');
  await page.waitForFunction(()=>document.getElementById('storageStatus')?.textContent.includes('другой вкладкой'));
  assert.equal(await page.locator('#saveLocal').isChecked(),false);result.concurrentArchiveProtected=true;
  await page.screenshot({path:join(out,name+'-operator.png')});await stage.screenshot({path:join(out,name+'-projector.png')});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,name+'-mobile.png'),fullPage:true});result.mobile=true;
  await page.locator('#logoutStudio button').click();await page.locator('#password').waitFor();await stage.locator('#password').waitFor();assert.equal(await page.locator('#console').count(),0);result.logout=true;
  assert.deepEqual(errors,[]);result.ok=true;
 }catch(e){result.ok=false;result.error=e.message.slice(0,500);result.errors=errors;failures++;await page.screenshot({path:join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});}
 results.push(result);console.log(JSON.stringify(result));await ctx.close();await browser.close();
}
server.closeAllConnections();await new Promise(r=>server.close(r));
await writeFile(join(out,'report.json'),JSON.stringify({results,failures},null,2));if(failures)process.exitCode=1;
