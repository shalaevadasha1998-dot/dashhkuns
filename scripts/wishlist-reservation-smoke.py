"""Exercise actual public reservation API using hidden test fixtures, then inspect the staged UI."""
import json,os,pathlib,secrets,urllib.request,urllib.error,concurrent.futures,mimetypes
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
API='https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/wishlist-reserve'
KEY='sb_publishable_nlajzfkH1tYEOAUZKcBvgg_5hbYJCM4'
ROOT=pathlib.Path('.').resolve();OUT=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-refresh';OUT.mkdir(exist_ok=True)
report={'api':{},'viewports':[]};tokens=[secrets.token_hex(32) for _ in range(6)];gift=None

def request(body=None,key=KEY,origin='https://dashhkuns.com'):
 headers={'apikey':key,'Origin':origin,'Content-Type':'application/json'}
 req=urllib.request.Request(API,data=json.dumps(body).encode() if body else None,headers=headers,method='POST' if body else 'GET')
 try:
  with urllib.request.urlopen(req,timeout=20) as r:return r.status,json.loads(r.read())
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def action(name,token,telegram=None):
 body={'action':name,'gift':gift,'token':token}
 if telegram:body['telegram']=telegram
 return request(body)
try:
 code,status=request();assert code==200 and set(status)=={'enabled','reserved'}
 assert request(key='not-an-app-key')[0]==401
 assert request(origin='https://example.org')[0]==403
 # both fixture ids come from the setup migration and its explicit rename, never user rows
 for candidate in ['test-reservation','__test-reservation']:
  gift=candidate;code,result=action('owned',tokens[0])
  if code==200:break
 assert code==200 and not result['reserved'], 'isolated fixture unavailable or occupied'
 tg='wishlist_test_'+secrets.token_hex(5)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(action,'reserve',tokens[n],tg+str(n)) for n in (0,1)]
  outcomes=[f.result() for f in futures]
 assert sorted(x[0] for x in outcomes)==[200,409], outcomes
 winner=next(i for i,r in enumerate(outcomes) if r[0]==200);loser=1-winner
 assert action('cancel',tokens[loser])[0]==403
 assert action('owned',tokens[winner])[1]['mine'] is True
 assert action('renew',tokens[winner])[0]==200
 public=request()[1]
 assert set(public)=={'enabled','reserved'} and gift not in public['reserved']
 assert 'telegram' not in json.dumps(public) and 'token' not in json.dumps(public) and 'hash' not in json.dumps(public)
 assert action('cancel',tokens[winner])[0]==200
 assert action('owned',tokens[winner])[1]['reserved'] is False
 report['api']={'race_one_winner':True,'foreign_cancel_denied':True,'owner_control':True,'renewal':True,'cancellation':True,'no_contact_or_token_in_public_response':True,'api_key_required':True,'cors_allowlist':True}
 manifest=json.loads((ROOT/'wishlist/data.json').read_text());assert len(manifest['items'])==39
 assert next(i for i in manifest['items'] if i['id']=='newyear')['title']=='новый год в тёплом месте'
 assert all('.' not in i['description'] and '.' not in i['title'] for i in manifest['items'])
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':1000},permissions=['clipboard-read','clipboard-write'])
   def local(route):
    path=urlsplit(route.request.url).path
    if path=='/wishlist':path='/wishlist/index.html'
    file=(ROOT/path.lstrip('/')).resolve()
    if not file.is_relative_to(ROOT) or not file.is_file():return route.continue_()
    raw=file.read_bytes()
    # insert one hidden test gift only into this browser's manifest, never the public website
    if path=='/wishlist/data.json':
     fixture=json.loads(raw);fixture['items'][0]['id']=gift;fixture['items'][0]['title']='тестовый подарок';raw=json.dumps(fixture,ensure_ascii=False).encode()
    if path in ['/wishlist/app.js','/wishlist/reservations.js']:
     raw=raw.replace(b'^[a-z0-9-]+$',b'^[a-z0-9_-]+$')
    route.fulfill(status=200,body=raw,content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
   context.route('https://dashhkuns.com/**',local)
   def test_status(route):
    if route.request.method=='OPTIONS':return route.continue_()
    if route.request.method!='GET':return route.continue_()
    code,body=request();owned=action('owned',tokens[5])[1]
    if owned.get('reserved'):body['reserved'].append(gift)
    route.fulfill(status=code,body=json.dumps(body),headers={'content-type':'application/json','access-control-allow-origin':'https://dashhkuns.com'})
   context.route(API,test_status)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('https://dashhkuns.com/wishlist',wait_until='domcontentloaded')
   page.wait_for_function("document.querySelectorAll('.gift-card').length===39")
   page.wait_for_function("document.querySelectorAll('.reservation-badge').length===39")
   page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
   page.wait_for_timeout(2500)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert 'хочет.' not in page.locator('body').inner_text()
   page.screenshot(path=str(OUT/f'hero-{width}.png'))
   page.locator('#gifts').scroll_into_view_if_needed();page.wait_for_timeout(400);page.screenshot(path=str(OUT/f'items-{width}.png'))
   page.locator('#search').fill('тестовый подарок');assert page.locator('.gift-card:visible').count()==1
   page.locator('.gift-card:visible h3 button').click()
   page.wait_for_function("!document.querySelector('#reservation-form').hidden")
   page.locator('#reservation-telegram').fill('@'+tg)
   page.locator('#reservation-consent').check()
   page.locator('#reservation-submit').click()
   page.wait_for_function("!document.querySelector('#reservation-management').hidden",timeout=30000)
   assert page.locator('#reservation-telegram').input_value()==''
   page.screenshot(path=str(OUT/f'reservation-{width}.png'))
   saved=page.evaluate("JSON.parse(localStorage.getItem('dashhkuns-private-gift-tokens-v1'))")
   token=saved[gift]
   assert tg not in page.evaluate('JSON.stringify(localStorage)')
   assert action('owned',token)[1]['mine'] is True
   assert action('owned',tokens[5])[1]['mine'] is False
   # restore the private capability in a new browser context without a Telegram login
   other=browser.new_context(viewport={'width':width,'height':1000})
   other.route('https://dashhkuns.com/**',local);other.route(API,test_status)
   second=other.new_page();second.goto('https://dashhkuns.com/wishlist#manage='+gift+'&key='+token,wait_until='domcontentloaded')
   second.wait_for_function("!document.querySelector('#reservation-management').hidden",timeout=30000)
   assert '&key=' not in second.url
   second.on('dialog',lambda d:d.accept())
   second.locator('#reservation-cancel').click();second.wait_for_function("!document.querySelector('#reservation-form').hidden",timeout=30000)
   assert action('owned',token)[1]['reserved'] is False
   assert not errors,errors
   report['viewports'].append({'width':width,'real_reservation':True,'private_link_restored_on_other_device':True,'telegram_not_in_browser_storage':True,'cancellation':True,'horizontal_overflow':False,'javascript_errors':[]})
   other.close();context.close()
  browser.close()
 report['ok']=True
except Exception as e:
 report['ok']=False;report['error']=str(e);raise
finally:
 if gift:
  for token in tokens:
   try:action('cancel',token)
   except Exception:pass
 (OUT/'reservations-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
