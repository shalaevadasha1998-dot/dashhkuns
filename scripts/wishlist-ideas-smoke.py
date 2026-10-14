"""Public UI checks for optional ideas; no purchases, messaging or real gift reservations."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-live';OUT.mkdir(parents=True,exist_ok=True)
report={'ok':False,'viewports':[]}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':1000},permissions=['clipboard-read','clipboard-write'])
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('https://dashhkuns.com/wishlist',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_function("document.querySelectorAll('.gift-card').length===39")
   assert page.locator('.idea-card').count()==16
   assert page.locator('#ideas .reservation-badge').count()==0
   assert page.locator('#ideas [data-save]').count()==0
   assert page.locator('.idea-status').all_text_contents()==['идея, не выбранный подарок']*16
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('.gift-card img').evaluate_all("nodes=>nodes.every(n=>n.src.includes('-full.png'))")
   page.evaluate("scrollTo({top:document.querySelector('#ideas').offsetTop-70,behavior:'instant'})")
   page.wait_for_timeout(800)
   page.screenshot(path=str(OUT/f'ideas-{width}.png'))
   button=page.locator('[data-idea]').first;title=button.get_attribute('data-idea');button.click()
   page.wait_for_timeout(250)
   clipboard=page.evaluate('navigator.clipboard.readText()')
   assert title in clipboard and 'сначала выберем вместе' in clipboard
   assert not errors,errors
   report['viewports'].append({'width':width,'confirmed_gifts':39,'optional_ideas':16,'ideas_not_bookable':True,'clipboard_copy':True,'no_horizontal_overflow':True,'no_javascript_errors':True})
   context.close()
  browser.close()
 report['ok']=True
except Exception as error:
 report['error']=str(error);raise
finally:
 (OUT/'ideas-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
