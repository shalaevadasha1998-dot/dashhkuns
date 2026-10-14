"""Read-only production smoke test; never sends analytics, forms or bookings."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from urllib.parse import urlsplit
import hashlib,json,time,xml.etree.ElementTree as ET

BASE='https://dashhkuns.com'
MARKER='portfolio-typography.css?v=alumni-literata-20261014'
def read(url):
    request=Request(url,headers={'User-Agent':'dashhkuns-typography-check/1.0','Cache-Control':'no-cache'})
    with urlopen(request,timeout=25) as response:
        return response.status,response.read().decode('utf-8')

# The Git deployment is asynchronous. Wait for the public release marker.
for attempt in range(36):
    try:
        status,body=read(BASE+'/?typography_check=alumni-literata-20261014')
        if MARKER in body:
            break
    except HTTPError as error:
        if error.code in (401,403):
            raise  # Do not bypass an access refusal.
    except URLError:
        pass
    time.sleep(5)
else:
    raise RuntimeError('New production typography did not appear within three minutes')

results=[]
for loc in ET.parse('sitemap.xml').getroot().iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
    url=loc.text
    route=urlsplit(url).path.rstrip('/')
    file=Path('index.html' if not route else route.lstrip('/')+'.html')
    if not file.is_file(): file=Path(route.lstrip('/'))/'index.html'
    if not file.is_file() or 'styles-v2.css' not in file.read_text(): continue
    status,body=read(url)
    ok=status==200 and MARKER in body and 'family=Alumni+Sans' in body and 'family=Literata' in body
    results.append({'url':url,'status':status,'newTypography':ok})
    print(json.dumps(results[-1]))
    if not ok: raise RuntimeError('Public page not updated: '+url)
    time.sleep(.2)
for rel in ['styles-v2.css','assets/portfolio-typography.css']:
    status,body=read(BASE+'/'+rel+'?v=alumni-literata-20261014')
    expected=Path(rel).read_text()
    if status!=200 or body!=expected: raise RuntimeError('Public stylesheet mismatch: '+rel)
    results.append({'url':BASE+'/'+rel,'status':status,'matchesRepository':True})
Path('public-typography-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('PUBLIC_TYPOGRAPHY_VERIFIED '+str(len(results)))
