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
const out=join(tmp,'nasypateli-identity-proof');await mkdir(out,{recursive:true});
// Ephemeral local credentials only; never touch production environment variables.
const password=randomBytes(30).toString('base64url');
process.env.NASYPATELI_LIVE_PASSWORD=password;
process.env.NASYPATELI_LIVE_SESSION_SECRET=randomBytes(48).toString('base64url');
const staticFiles=new Map([
 ['/nasypateli-live',['nasypateli-login.html','text/html; charset=utf-8']],
 ['/assets/nasypateli-entry.css',['assets/nasypateli-entry.css','text/css']],
 ['/assets/nasypateli-mark.webp',['assets/nasypateli-mark.webp','image/webp']]
]);
const server=createServer({key:await readFile(join(tmp,'identity.key')),cert:await readFile(join(tmp,'identity.crt'))},async(req,res)=>{
 try{
  const path=new URL(req.url,'https://localhost').pathname;
  const asset=staticFiles.get(path);
  if(asset&&req.method==='GET'){
   res.setHeader('Content-Type',asset[1]);res.setHeader('Referrer-Policy','same-origin');
   res.end(await readFile(asset[0]));return;
  }
  if(path!=='/nasypateli-live/app'){res.statusCode=404;res.end();return;}
  let body='';for await(const chunk of req)body+=chunk;
  req.body=body;res.status=function(n){this.statusCode=n;return this;};res.send=function(v){this.end(v);return this;};
  handler(req,res);
 }catch(error){res.statusCode=500;res.end('local test error');console.error(error.name);}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='https://127.0.0.1:'+server.address().port;
const results=[];let failures=0;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={engine:name,scope:'isolated HTTPS, generated credentials'};
 try{
  await page.goto(base+'/nasypateli-live');await page.locator('.brand-lockup img').waitFor();
  assert.equal(await page.locator('.brand-lockup h1').textContent(),'насыпатели');
  assert.ok(await page.locator('.brand-lockup img').evaluate(el=>el.complete&&el.naturalWidth===320));
  assert.equal(await page.locator('#character').count(),0);
  result.logoAboveProjectName=await page.locator('.brand-lockup').evaluate(el=>el.children[0].tagName==='IMG'&&el.children[1].textContent==='насыпатели');
  assert.ok(result.logoAboveProjectName);await page.screenshot({path:join(out,name+'-entry.png')});
  await page.locator('#password').fill('wrong-for-local-test');await page.locator('button[type=submit]').click();
  await page.getByText('неверный пароль',{exact:true}).waitFor();
  assert.equal(await page.locator('#character').count(),0);
  await page.locator('#password').fill(password);await page.locator('button[type=submit]').click();
  await page.locator('#console').waitFor();
  assert.equal(await page.locator('#character h1').textContent(),'насыпатели');
  assert.equal(await page.locator('.ear-left').count(),0);
  assert.ok((await page.locator('body').innerText()).includes('самостоятельный ии на сайте ещё не подключён'));
  await page.screenshot({path:join(out,name+'-operator.png')});
  const newPage=context.waitForEvent('page');await page.locator('#openStage').click();const stage=await newPage;
  await stage.waitForLoadState('domcontentloaded');assert.equal(await stage.locator('#console').isVisible(),false);
  await stage.screenshot({path:join(out,name+'-projector-title.png')});
  await page.locator('#cue').fill('а что могло бы изменить твоё мнение?');
  assert.equal(await stage.locator('#caption').textContent(),'');result.draftHidden=true;
  await page.locator('#showCue').click();
  await stage.waitForFunction(()=>document.querySelector('#caption')?.textContent==='а что могло бы изменить твоё мнение?');result.projectorSync=true;
  assert.equal(await stage.locator('#stage').evaluate(el=>el.classList.contains('has-cue')),true);
  await stage.screenshot({path:join(out,name+'-projector-cue.png')});
  await page.locator('#clearCue').click();await stage.waitForFunction(()=>document.querySelector('#caption')?.textContent==='');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(out,name+'-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(errors.length,0);result.noJavascriptErrors=true;result.noHorizontalOverflow=true;result.ok=true;
 }catch(error){result.ok=false;result.error=error.message.slice(0,350);failures++;await page.screenshot({path:join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});}
 results.push(result);console.log(JSON.stringify(result));await context.close();await browser.close();
}
server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
await writeFile(join(out,'report.json'),JSON.stringify({results,failures},null,2));
if(failures)process.exitCode=1;
