"""Public, unauthenticated checks for the isolated wishlist. Never bypass access controls."""
import hashlib,json,os,pathlib,time,urllib.request
from playwright.sync_api import sync_playwright
BASE='https://dashhkuns.com'
OUT=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-evidence';OUT.mkdir(parents=True,exist_ok=True)
report={'base':BASE,'checks':[],'images':{},'errors':[]}
def read(url):
 req=urllib.request.Request(url,headers={'User-Agent':'dashhkuns-wishlist-smoke/1.0'})
 with urllib.request.urlopen(req,timeout=25) as r:
  return r.status,r.read(3_000_000),r.geturl()
def ready():
 for attempt in range(16):
  try:
   status,body,url=read(BASE+'/wishlist')
   if status==200 and b'id="gift-grid"' in body and read(BASE+'/wishlist/data.json')[1]==pathlib.Path('wishlist/data.json').read_bytes():return
  except Exception as e:
   if getattr(e,'code',None) in (401,403):raise RuntimeError('public page requires access; no bypass attempted') from e
  time.sleep(15)
 raise RuntimeError('wishlist did not become publicly available')
try:
 ready()
 for path in ['/','/wishlist','/wishlist/data.json','/wishlist/style.css','/wishlist/app.js','/crm-app/index.html']:
  status,body,url=read(BASE+path)
  report['checks'].append({'path':path,'status':status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'url':url})
  assert status==200
  if path=='/':assert b'dashhkuns' in body
 status,body,url=read('https://crm.dashhkuns.com/')
 report['checks'].append({'path':'crm.dashhkuns.com/','status':status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
 assert status==200
 data=json.loads(read(BASE+'/wishlist/data.json')[1]);assert len(data['items'])==39
 assert len({i['id'] for i in data['items']})==39
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':1000})
   page=context.new_page();errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'/wishlist',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_selector('.gift-card');assert page.locator('.gift-card').count()==39
   page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
   page.wait_for_timeout(12000)
   await_fonts="Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))])"
   page.evaluate(await_fonts)
   page.evaluate("Promise.race([Promise.allSettled([...document.images].map(i=>i.decode())),new Promise(r=>setTimeout(r,12000))])")
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   page.screenshot(path=str(OUT/f'hero-{width}.png'))
   page.evaluate("scrollTo({top:document.querySelector('#gifts').offsetTop-70,behavior:'instant'})");page.wait_for_timeout(600);page.screenshot(path=str(OUT/f'catalog-{width}.png'))
   if width==1440:
    report['images']=page.evaluate("[...document.querySelectorAll('.gift-card')].map(a=>({id:a.dataset.id,title:a.querySelector('h3').innerText,loaded:!!a.querySelector('img')?.naturalWidth,url:a.querySelector('img')?.src}))")
    page.evaluate("scrollTo({top:0,behavior:'instant'})");page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/'wishlist-full-desktop.png'),full_page=True)
   page.locator('#search').fill('macbook');assert page.locator('.gift-card:visible').count()==1
   page.locator('.gift-card:visible [data-save]').click();assert page.locator('#saved-count').inner_text()=='1'
   page.locator('.gift-card:visible h3 button').click();assert page.locator('#gift-dialog').evaluate('(d)=>d.open')
   page.screenshot(path=str(OUT/f'detail-{width}.png'));page.keyboard.press('Escape')
   assert not page.locator('#gift-dialog').evaluate('(d)=>d.open')
   page.locator('#search').fill('xyz-no-match');assert page.locator('#empty').is_visible()
   page.locator('#empty-reset').click();assert page.locator('.gift-card:visible').count()==39
   page.locator('#priority').check();assert 0<page.locator('.gift-card:visible').count()<39
   page.locator('#reset').click();page.locator('#saved-toggle').click();assert page.locator('.gift-card:visible').count()==1
   page.goto(BASE+'/wishlist#gift-coffee',wait_until='domcontentloaded')
   page.wait_for_function("document.querySelector('#gift-dialog').open")
   assert 'кофемашина' in page.locator('#dialog-title').inner_text()
   assert page.locator('#dialog-source').is_hidden();page.keyboard.press('Escape')
   assert page.locator('#saved-count').inner_text()=='1'
   assert not errors,errors
   report['checks'].append({'viewport':width,'search':True,'filters':True,'shortlist_persistence':True,'dialog':True,'deep_link':True,'no_horizontal_overflow':True,'javascript_errors':errors})
   context.close()
  browser.close()
 report['missing_images']=[i['id'] for i in report['images'] if not i['loaded']]
 assert not report['missing_images'], 'images missing: '+str(report['missing_images'])
 report['ok']=True
except Exception as e:
 report['ok']=False;report['errors'].append(str(e));raise
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
