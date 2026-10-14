import {createRequire} from 'node:module';
import {createServer} from 'node:https';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import handler from '../api/nasypateli-live.js';
const temp=process.env.RUNNER_TEMP;
if(!temp)throw new Error('RUNNER_TEMP required');
const req=createRequire(join(temp,'browser-tools/package.json'));
const {chromium,webkit}=req('playwright');
const out=join(temp,'nasypateli-evidence');
await mkdir(out,{recursive:true});
const results=[];
const base=process.env.NASYPATELI_BROWSER_BASE||'https://dashhkuns.com';
const targets=[['domain',base+'/nasypateli-live'],['static-file',base+'/nasypateli-login.html']];
const password=randomBytes(24).toString('base64url');
process.env.NASYPATELI_LIVE_PASSWORD=password;
process.env.NASYPATELI_LIVE_SESSION_SECRET=randomBytes(48).toString('base64url');
const server=createServer({key:await readFile(join(temp,'local-test.key')),cert:await readFile(join(temp,'local-test.crt'))},async(request,response)=>{
  response.status=function(n){this.statusCode=n;return this;};
  response.send=function(body){this.end(body);return this;};
  try{
    const path=new URL(request.url,'https://localhost').pathname;
    if(path==='/nasypateli-live'||path==='/nasypateli-login.html'){
      response.setHeader('Content-Type','text/html; charset=utf-8');
      // Preserve the deployed static route policy; document meta deliberately overrides it
      response.setHeader('Referrer-Policy','no-referrer');
      response.end(await readFile(resolve('nasypateli-login.html')));return;
    }
    if(path==='/assets/nasypateli-entry.css'){
      response.setHeader('Content-Type','text/css; charset=utf-8');
      response.end(await readFile(resolve('assets/nasypateli-entry.css')));return;
    }
    if(!['/nasypateli-live/app','/api/nasypateli-live'].includes(path)){response.statusCode=404;response.end();return;}
    if(request.method==='POST'){
      const chunks=[];for await(const chunk of request)chunks.push(chunk);
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
  context.setDefaultTimeout(12000);
  for(const [name,url] of targets){
    const page=await context.newPage();
    const row={engine,name,url,scope:'production anonymous'};
    const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const response=await page.goto(url,{waitUntil:'load',timeout:30000});
      row.status=response?.status();row.passwordVisible=await page.locator('#password').isVisible();
      row.stageVisible=await page.locator('#character').isVisible();row.title=await page.title();
      row.referrerMeta=await page.locator('meta[name=referrer]').getAttribute('content');
      await page.screenshot({path:join(out,engine+'-'+name+'-login.png')});
      if(name==='domain'&&row.passwordVisible){
        await page.locator('#password').fill('invalid-browser-test-password');
        const [posted]=await Promise.all([
          page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/nasypateli-live/app'),
          page.locator('button[type=submit]').click()
        ]);
        row.postOrigin=(await posted.request().allHeaders()).origin;
        row.fetchSite=(await posted.request().allHeaders())['sec-fetch-site'];
        row.wrongPasswordStatus=posted.status();
        await page.waitForLoadState('load');
        row.wrongPasswordVisible=await page.getByText('неверный пароль',{exact:true}).isVisible();
        row.stageAfterWrongPassword=await page.locator('#character').isVisible();
        await page.screenshot({path:join(out,engine+'-domain-wrong-password.png')});
      }
      row.ok=row.status===200&&row.passwordVisible&&!row.stageVisible;
      if(name==='domain')row.ok=row.ok&&row.wrongPasswordVisible&&!row.stageAfterWrongPassword;
    }catch(error){row.error=String(error.message).slice(0,500);row.ok=false;}
    row.pageErrors=errors;results.push(row);console.log(JSON.stringify(row));
    if(!row.ok)failures++;
    await page.close();
  }
  await context.close();
  const localContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});
  localContext.setDefaultTimeout(10000);
  const page=await localContext.newPage();
  const row={engine,name:'valid-login-and-projector',scope:'isolated HTTPS with synthetic credentials'};
  const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
  try{
    await page.goto(local+'/nasypateli-live');
    // First test rejection, then retry the real browser form on its server-rendered error page
    await page.locator('#password').fill('invalid-synthetic-password');
    await page.locator('button[type=submit]').click();
    await page.waitForLoadState('load');
    row.wrongPasswordVisible=await page.getByText('неверный пароль',{exact:true}).isVisible();
    if(!row.wrongPasswordVisible)throw new Error('real same-origin form was rejected before password validation');
    await page.locator('#password').fill(password);
    const [posted]=await Promise.all([
      page.waitForResponse(r=>r.request().method()==='POST'),
      page.locator('button[type=submit]').click()
    ]);
    row.validPostStatus=posted.status();row.validPostOrigin=(await posted.request().allHeaders()).origin;
    await page.waitForLoadState('load');
    row.character=await page.locator('#character').isVisible();row.console=await page.locator('#console').isVisible();
    await page.screenshot({path:join(out,engine+'-synthetic-operator.png')});
    if(!row.character||!row.console)throw new Error('authenticated operator did not render');
    const cookie=(await localContext.cookies()).find(c=>c.name==='nasypateli_live_session');
    row.cookie={present:!!cookie,httpOnly:cookie?.httpOnly,secure:cookie?.secure,sameSite:cookie?.sameSite};
    const [stage]=await Promise.all([
      localContext.waitForEvent('page',{timeout:10000}),
      page.locator('#openStage').click({timeout:9000})
    ]);
    await stage.waitForLoadState('load');
    await page.locator('#cue').fill('проверка связи оператора и проектора');
    await page.locator('#showCue').click();
    await stage.waitForFunction(()=>document.getElementById('caption')?.textContent==='проверка связи оператора и проектора',null,{timeout:10000});
    row.projectorSynced=true;row.projectorHasConsole=await stage.locator('#console').isVisible();
    row.ok=row.cookie.httpOnly&&row.cookie.secure&&row.projectorSynced&&!row.projectorHasConsole;
    await stage.screenshot({path:join(out,engine+'-synthetic-projector.png')});
  }catch(error){row.error=String(error.message).slice(0,600);row.ok=false;await page.screenshot({path:join(out,engine+'-synthetic-failure.png')}).catch(()=>{});}
  row.pageErrors=errors;results.push(row);console.log(JSON.stringify(row));if(!row.ok)failures++;
  await localContext.close();await browser.close();
}
await new Promise(resolve=>server.close(resolve));
await writeFile(join(out,'report.json'),JSON.stringify({at:new Date().toISOString(),failures,results},null,2));
if(failures)process.exitCode=1;
