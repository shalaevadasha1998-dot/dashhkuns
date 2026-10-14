"""Verify public production byte equality, transparent assets and actual browser UI."""
import concurrent.futures,hashlib,io,json,os,pathlib,time,urllib.request,urllib.error
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('.').resolve();BASE='https://dashhkuns.com'
OUT=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-live';OUT.mkdir(parents=True,exist_ok=True)
PATHS=['wishlist/index.html','wishlist/app.js','wishlist/reservations.js','wishlist/reservations.css','wishlist/data.json']
report={'ok':False,'public_files':[],'viewports':[],'images':[]}
def get(path):
 url=path if path.startswith('https://') else BASE+'/'+path
 req=urllib.request.Request(url,headers={'User-Agent':'dashhkuns-wishlist-release-check/1.0','Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=30) as r:return r.read(4_000_000)
def current_release():
 for n in range(18):
  try:
   if all(get(path)==(ROOT/path).read_bytes() for path in PATHS):return
  except urllib.error.HTTPError as e:
   if e.code in (401,403):raise RuntimeError('access control encountered; no bypass attempted') from e
  time.sleep(12)
 raise RuntimeError('production did not reach expected release')
def check_image(item):
 path=item['image'];assert path.startswith('/wishlist/items/') and path.endswith('.png')
 raw=get(path.lstrip('/'));im=Image.open(io.BytesIO(raw))
 assert im.format=='PNG' and im.mode=='RGBA',item['id']
 hist=im.getchannel('A').histogram();transparency=hist[0]/(im.width*im.height)
 assert .08<transparency<.995,item['id']
 return {'id':item['id'],'png':True,'alpha':True,'transparent_fraction':round(transparency,4),'bytes':len(raw)}
try:
 current_release()
 for path in PATHS:
  raw=get(path);report['public_files'].append({'path':path,'matches_expected':raw==(ROOT/path).read_bytes(),'sha256':hashlib.sha256(raw).hexdigest()})
 data=json.loads(get('wishlist/data.json'));assert len(data['items'])==39
 assert next(i for i in data['items'] if i['id']=='newyear')['title']=='новый год в тёплом месте'
 assert all('.' not in i['title'] and '.' not in i['description'] for i in data['items'])
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:report['images']=list(pool.map(check_image,data['items']))
 for url in [BASE+'/', 'https://crm.dashhkuns.com/']:
  assert len(get(url))>500
 report['main_and_crm_available']=True
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':1000})
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'/wishlist',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_function("document.querySelectorAll('.gift-card').length===39")
   page.wait_for_function("document.querySelectorAll('.reservation-badge').length===39 && !document.querySelector('[data-reservation=unknown]')",timeout=30000)
   page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
   page.evaluate("Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,6000))])")
   page.wait_for_function("[...document.querySelectorAll('.gift-card img')].every(i=>i.complete&&i.naturalWidth>0)",timeout=45000)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('h1').inner_text().replace('\n',' ')=='дора хочет'
   page.screenshot(path=str(OUT/f'hero-{width}.png'))
   page.evaluate("scrollTo({top:document.querySelector('#gifts').offsetTop-70,behavior:'instant'})");page.wait_for_timeout(300)
   page.screenshot(path=str(OUT/f'cards-{width}.png'))
   if width==1440:page.screenshot(path=str(OUT/'full-desktop.png'),full_page=True)
   page.locator('#search').fill('новый год');assert page.locator('.gift-card:visible').count()==1
   page.locator('#reset').click()
   available=page.locator('[data-reservation=available] h3 button').first
   available.click();page.wait_for_function("!document.querySelector('#reservation-form').hidden",timeout=30000)
   assert page.locator('#reservation-telegram').input_value()==''
   assert page.locator('#reservation-consent').is_checked()==False
   assert page.locator('#reservation-submit').inner_text()=='забронировать за собой'
   page.screenshot(path=str(OUT/f'reservation-form-{width}.png'))
   page.keyboard.press('Escape');assert not page.locator('#gift-dialog').evaluate('(d)=>d.open')
   assert not errors,errors
   report['viewports'].append({'width':width,'all_39_images_visible':True,'reservation_form':True,'public_statuses':True,'search':True,'no_js_errors':True,'no_horizontal_overflow':True})
   ctx.close()
  browser.close()
 report['ok']=True
except Exception as e:
 report['error']=str(e);raise
finally:
 (OUT/'live-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
