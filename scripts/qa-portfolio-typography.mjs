import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

const root=process.cwd();
const evidence=path.join(root,'typography-evidence');
await fs.mkdir(evidence,{recursive:true});
const pages=JSON.parse(await fs.readFile(path.join(evidence,'scope.json'),'utf8'));
const byPath=new Map(pages.map(p=>[new URL(p.url).pathname.replace(/\/$/,'')||'/',p.file]));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const rel=byPath.get(pathname.replace(/\/$/,'')||'/')||pathname.slice(1);
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch();
const reports=[];
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:width<600?844:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('dashhkuns_internal_v1','1');});
  // Tests never generate visitors, leads or bookings. Keep only font and local asset requests.
  await context.route('**/*',async route=>{
   const request=route.request(); const url=new URL(request.url());
   if(url.hostname==='127.0.0.1'||url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')return route.continue();
   return route.abort();
  });
  for(const item of pages){
   const p=await context.newPage();
   const errors=[]; p.on('pageerror',e=>errors.push(e.message));
   const response=await p.goto('http://127.0.0.1:4173'+new URL(item.url).pathname,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,item.file);
   await p.evaluate(async()=>{await document.fonts.load('700 48px "Alumni Sans"','придумываю projects');await document.fonts.load('italic 400 48px "Literata"','запускаю projects');await document.fonts.ready;});
   await p.waitForTimeout(300);
   // Reveal scroll-animated sections so full-page evidence is not blank.
   await p.evaluate(()=>{document.querySelectorAll('.reveal').forEach(e=>e.classList.add('visible'));});
   const data=await p.evaluate(()=>{
    const h=document.querySelector('h1'); const s=document.querySelector('.serif');
    const problems=[];
    for(const el of document.querySelectorAll('h1,h2,h3,.btn,.top-cta,.menu-btn,input,select,textarea')){
     const cs=getComputedStyle(el),r=el.getBoundingClientRect();
     if(cs.display==='none'||cs.visibility==='hidden'||!r.width||!r.height)continue;
     if(el.closest('[class*="carousel"],[class*="rail"],[class*="slider"],[class*="scroll"],.mobile-menu'))continue;
     const range=document.createRange();range.selectNodeContents(el);
     for(const box of range.getClientRects()){
      if(box.width>0&&(box.left<r.left-5||box.right>r.right+5)){
       problems.push({tag:el.tagName,class:el.className,text:el.textContent.trim().slice(0,90),parentWidth:Math.round(r.width),textWidth:Math.round(box.width)});break;
      }
     }
    }
    return {h1Font:h?getComputedStyle(h).fontFamily:null,italicFont:s?getComputedStyle(s).fontFamily:null,italicStyle:s?getComputedStyle(s).fontStyle:null,
     loadedFonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,style:f.style,weight:f.weight})),
     horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,overflowingText:problems,
     oldGoogleFontLinks:[...document.querySelectorAll('link[href*="fonts.googleapis.com/css"]')].filter(l=>/Manrope|Sofia|Cormorant|Geologica|Prata/.test(l.href)).length};
   });
   const client=await context.newCDPSession(p);
   await client.send('DOM.enable');await client.send('CSS.enable');
   const doc=await client.send('DOM.getDocument');
   const platform=[];
   for(const selector of ['h1','.serif']){
    const {nodeId}=await client.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});
    if(nodeId){const result=await client.send('CSS.getPlatformFontsForNode',{nodeId});platform.push({selector,fonts:result.fonts});}
   }
   const name=(new URL(item.url).pathname.replaceAll('/','_')||'_home')+'-'+width;
   await p.screenshot({path:path.join(evidence,name+'.png'),fullPage:true,animations:'disabled'});
   let menu=null;
   const menuButton=p.locator('.menu-btn');
   if(width===390&&await menuButton.count()&&await menuButton.isVisible()){
    await menuButton.click(); menu=await menuButton.getAttribute('aria-expanded');
    await p.screenshot({path:path.join(evidence,name+'-menu.png'),animations:'disabled'});
    assert.equal(menu,'true','Mobile menu failed: '+item.file);
   }
   assert.equal(data.oldGoogleFontLinks,0,'Old font CSS still linked: '+item.file);
   assert(data.loadedFonts.some(f=>f.family.replaceAll('"','')==='Alumni Sans'),'Alumni Sans did not load');
   assert(data.loadedFonts.some(f=>f.family.replaceAll('"','')==='Literata'&&f.style==='italic'),'Literata italic did not load');
   reports.push({url:item.url,width,...data,platformFonts:platform,menu,scriptErrors:errors});
   console.log(JSON.stringify({url:item.url,width,h1:data.h1Font,italic:data.italicFont,overflow:data.overflowingText,scriptErrors:errors}));
   await p.close();
  }
  await context.close();
 }
 const report={pages:pages.length,checks:reports.length,reports};
 await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2));
 console.log('TYPOGRAPHY_REPORT '+JSON.stringify({pages:pages.length,checks:reports.length,horizontalOverflow:reports.filter(r=>r.horizontalOverflow).map(r=>({url:r.url,width:r.width})),textOverflow:reports.filter(r=>r.overflowingText.length).map(r=>({url:r.url,width:r.width,items:r.overflowingText})),errors:reports.filter(r=>r.scriptErrors.length).map(r=>({url:r.url,errors:r.scriptErrors}))}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
