"""Read-only source collection for the user's new wishlist entries."""
from pathlib import Path
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
import io,json,os,re,requests
from bs4 import BeautifulSoup
from PIL import Image,ImageOps,ImageDraw
import numpy as np
OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-oct15-sources';OUT.mkdir(parents=True,exist_ok=True);(OUT/'images').mkdir(exist_ok=True)
SOURCES={
'zaum':['https://avatars.mds.yandex.net/get-yastore/18793859/tdbzwzr9fpj6662qpkqrcs4sjh7b9v87/orig'],
'reflector':['https://fujimifoto.ru/product-category/studijnoe-oborudovanie/otrazhateli/5-v-1/'],
'monitor':['https://www.thexebec.com/products/xebec-tri-screen-3'],
'celimax':['https://celimax.us/products/the-real-noni-energy-ampoule-ji-woo-gae-heartleaf-bha-peeling-pad','https://celimax.us/collections/all'],
'valoshirt':['https://www.hottopic.com/product/him-pink-ville-valo-t-shirt/36380793.html'],
'apple-tv':['https://www.apple.com/apple-tv-4k/'],
'camera':['https://lamax-electronics.com/en/products/lamax-instakid2-plus-pink'],
'glasses':['https://www.zennioptical.com/p/womens-cat-eye-eyeglass-frames/78361/7836121'],
'genealogy':['https://rodoslovnaya.pro/','https://yourfamilystory.ru/'],
'plants':['https://foliage-factory.com/products/syngonium-podophyllum-strawberry','https://foliage-factory.com/products/syngonium-pink-perfection-aka-pink-dream']
}
PATTERNS={'reflector':r'702|reflect|отраж|рефлект','apple-tv':r'tv_4k|apple_tv|remote|hero|hardware','glasses':r'78361','valoshirt':r'36380793|ville|HIM','genealogy':r'.','celimax':r'noni|pad|cream|set|ampoule','plants':r'syngonium|pink|strawberry'}
def get(u):
 r=requests.get(u,timeout=20,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status();assert len(r.content)<20000000;return r

def collect(pair):
 name,pages=pair;rows=[];seen=set();errors=[]
 for page in pages:
  try:
   response=get(page)
   if response.headers.get('Content-Type','').startswith('image/'):
    urls=[(page,'direct image')]
   else:
    soup=BeautifulSoup(response.content,'html.parser');urls=[]
    if '/products/' in page:
     try:
      data=get(page+'.js').json()
      urls.extend((urljoin(page,u),'product') for u in data.get('images',[])[:10])
     except Exception:pass
    for m in soup.select('meta[property="og:image"], meta[name="twitter:image"]'):
     if m.get('content'):urls.append((urljoin(page,m['content']),'social'))
    for img in soup.find_all(['img','source']):
     alt=img.get('alt','')
     for att in ['src','data-src','data-original']:
      if img.get(att):urls.append((urljoin(page,img[att]),alt))
     for att in ['srcset','data-srcset']:
      if img.get(att):
       for part in img[att].split(',')[-1:]:urls.append((urljoin(page,part.strip().split()[0]),alt))
    urls=[r for r in urls if re.search(PATTERNS.get(name,r'.'),r[0]+' '+r[1],re.I)]
   for url,alt in urls:
    key=url.split('?')[0]
    if key in seen or not url.startswith('https://') or any(x in url.lower() for x in ['logo','sprite','tracking','pixel']):continue
    seen.add(key)
    try:
     im=ImageOps.exif_transpose(Image.open(io.BytesIO(get(url).content))).convert('RGBA')
     if min(im.size)<180 or max(im.size)<400:continue
     im.thumbnail((1800,1800),Image.Resampling.LANCZOS)
     f=f'{name}-{len(rows):02d}.png';im.save(OUT/'images'/f,optimize=True)
     a=np.array(im);rows.append({'name':f,'url':url,'page':page,'alt':alt[:150],'size':im.size,'alpha_fraction':round(float((a[:,:,3]<8).mean()),4)})
     if len(rows)>=8:break
    except Exception as error:errors.append(str(error)[:160])
   if len(rows)>=8:break
  except Exception as error:errors.append(str(error)[:220])
 if rows:
  sheet=Image.new('RGB',(1440,760),'#eeeeee');d=ImageDraw.Draw(sheet)
  for n,row in enumerate(rows):
   x=n%4*360;y=n//4*380
   for yy in range(0,330,20):
    for xx in range(0,350,20):d.rectangle((x+xx,y+yy,x+xx+19,y+yy+19),fill='#dadada' if (xx//20+yy//20)%2 else '#f3f3f3')
   im=Image.open(OUT/'images'/row['name']);im.thumbnail((330,305));sheet.paste(im,(x+(350-im.width)//2,y+(330-im.height)//2),im)
   d.text((x+8,y+338),row['name']+' / alpha '+str(row['alpha_fraction']),fill='black')
  sheet.save(OUT/(name+'.jpg'),quality=87)
 print(name,len(rows),flush=True);return {'id':name,'images':rows,'errors':errors}
with ThreadPoolExecutor(max_workers=5) as p:rows=list(p.map(collect,SOURCES.items()))
(OUT/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
