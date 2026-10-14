import {createRequire} from 'node:module';
import {createServer} from 'node:https';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import handler from '../api/nasypateli-live.js';
const temp=process.env.RUNNER_TEMP;
if(!temp) throw new Error('RUNNER_TEMP required');
const req=createRequire(join(temp,'browser-tools/package.json'));
const {chromium,webkit}=req('playwright');
const out=join(temp,'nasypateli-evidence');
await mkdir(out,{recursive:true});
const results=[];
const targets=[
  ['domain','https://dashhkuns.com/nasypateli-live'],
  ['static-file','https://dashhkuns.com/nasypateli-login.html'],
  ['deployment-domain','https://dashhkuns.vercel.app/nasypateli-live']
];
const syntheticPassword=randomBytes(24).toString('base64url');
process.env.NASYPATELI_LIVE_PASSWORD=syntheticPassword;
process.env.NASYPATELI_LIVE_SESSION_SECRET=randomBytes(48).toString('base64url');
const server=createServer({key:await readFile(join(temp,'local-test.key')),cert:await readFile(join(temp,'local-test.crt'))},async(request,response)=>{
  response.status=function(n){this.statusCode=n;return this;};
  response.send=function(body){this.end(body);return this;};
  try{
    const path=new URL(request.url,'https://localhost').pathname;
    if(path==='/nasypateli-live'||path==='/nasypateli-login.html'){
      response.setHeader('Content-Type','text/html; charset=utf-8');
      response.end(await readFile(resolve('nasypateli-login.html')));return;
    }
    if(path==='/assets/nasypateli-entry.css'){
      response.setHeader('Content-Type','text/css; charset=utf-8');
      response.end(await readFile(resolve('assets/nasypateli-entry.css')));return;
    }
    if(path!=='/nasypateli-live/app'&&path!=='/api/nasypateli-live'){response.statusCode=404;response.end();return;}
    if(request.method==='POST'){
      const chunks=[];for await(const chunk of request) chunks.push(chunk);
      request.body=Buffer.concat(chunks).toString('utf8');
    }
    handler(request,response);
  }catch{response.statusCode=500;response.end('isolated test error');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const local='https://127.0.0.1:'+server.address().port;
let failures=0;
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  for(const [name,url] of targets){
    const page=await context.newPage();
    const row={engine,name,url,scope:'production anonymous'};
    const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      row.status=response?.status();row.finalUrl=page.url();
      row.passwordVisible=await page.locator('#password').isVisible();
      row.stageVisible=await page.locator('#character').isVisible();
      row.title=await page.title();
      row.background=await page.evaluate(()=>getComputedStyle(document.body).backgroundImage);
      row.headers={};for(const key of ['server','x-vercel-id','x-robots-tag','content-type','location'])row.headers[key]=(await response?.allHeaders())?.[key];
      await page.screenshot({path:join(out,engine+'-'+name+'-login.png')});
      if(name==='domain'&&row.passwordVisible){
        await page.locator('#password').fill('invalid-browser-test-password');
        const posted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/nasypateli-live/app',{timeout:30000});
        await page.locator('button[type=submit]').click();
        row.wrongPasswordStatus=(await posted).status();
        await page.waitForLoadState('domcontentloaded');
        row.wrongPasswordVisible=await page.getByText('неверный пароль',{exact:true}).isVisible();
        row.stageAfterWrongPassword=await page.locator('#character').isVisible();
        await page.screenshot({path:join(out,engine+'-domain-wrong-password.png')});
      }
      row.ok=row.status===200&&row.passwordVisible&&!row.stageVisible;
      if(name==='domain')row.ok=row.ok&&row.wrongPasswordVisible&&!row.stageAfterWrongPassword;
    }catch(error){row.error=String(error.message).slice(0,450);row.ok=false;}
    row.pageErrors=errors;results.push(row);console.log(JSON.stringify(row));
    if(!row.ok)failures++;
    await page.close();
  }
  await context.close();
  const localContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});
  const page=await localContext.newPage();
  const row={engine,name:'valid-login-and-projector',scope:'isolated HTTPS with synthetic credentials'};
  const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
  try{
    await page.goto(local+'/nasypateli-live');
    await page.locator('#password').fill(syntheticPassword);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/nasypateli-live/app');
    row.character=await page.locator('#character').isVisible();
    row.console=await page.locator('#console').isVisible();
    const cookie=(await localContext.cookies()).find(c=>c.name==='nasypateli_live_session');
    row.cookie={present:!!cookie,httpOnly:cookie?.httpOnly,secure:cookie?.secure,sameSite:cookie?.sameSite};
    const opening=localContext.waitForEvent('page',{timeout:15000});
    await page.locator('#openStage').click();
    const stage=await opening;await stage.waitForLoadState('domcontentloaded');
    await page.locator('#cue').fill('проверка связи оператора и проектора');
    await page.locator('#showCue').click();
    await stage.waitForFunction(()=>document.getElementById('caption')?.textContent==='проверка связи оператора и проектора',null,{timeout:10000});
    row.projectorSynced=true;row.projectorHasConsole=await stage.locator('#console').isVisible();
    row.ok=row.character&&row.console&&row.cookie.httpOnly&&row.cookie.secure&&row.projectorSynced&&!row.projectorHasConsole;
    await page.screenshot({path:join(out,engine+'-synthetic-operator.png')});
    await stage.screenshot({path:join(out,engine+'-synthetic-projector.png')});
  }catch(error){row.error=String(error.message).slice(0,450);row.ok=false;}
  row.pageErrors=errors;results.push(row);console.log(JSON.stringify(row));
  if(!row.ok)failures++;
  await localContext.close();await browser.close();
}
await new Promise(resolve=>server.close(resolve));
await writeFile(join(out,'report.json'),JSON.stringify({at:new Date().toISOString(),failures,results},null,2));
if(failures)process.exitCode=1;
