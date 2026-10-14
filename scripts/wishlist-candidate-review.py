"""Collect source images for human visual review; no generative masking, no publication."""
from pathlib import Path
from urllib.parse import urljoin,urlsplit
from concurrent.futures import ThreadPoolExecutor
import requests,io,json,os,re,html,hashlib
from bs4 import BeautifulSoup
from PIL import Image,ImageOps,ImageDraw
import numpy as np
ROOT=Path('.').resolve();OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-candidates';OUT.mkdir(exist_ok=True)
(OUT/'photos').mkdir(exist_ok=True)
SOURCES={
'airwrap':['https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/492485-01.png?fmt=png-alpha&wid=1400','https://www.dyson.com/hair-care/hair-stylers/airwrap-co-anda2x/straight-wavy-jasper-plum'],
'airstrait':['https://www.dyson.com/hair-care/hair-straighteners/airstrait'],
'macbook':['https://support.apple.com/en-us/125405','https://www.apple.com/shop/buy-mac/macbook-pro/14-inch-space-black-standard-display-apple-m5-chip-10-core-cpu-10-core-gpu-16gb-memory-1tb-storage'],
'airpods':['https://www.apple.com/airpods-max/','https://www.apple.com/shop/buy-airpods/airpods-max'],
'playstation':['https://www.playstation.com/en-us/ps5/'],
'sousvide':['https://anovaculinary.com/products/anova-precision-cooker-3'],
'coffee':['https://www.nespresso.com/us/en/order/machines/original/essenza-mini-c30-intense-grey','https://www.delonghi.com/en-us/p/essenza-mini-espresso-machine/EN85B.html'],
'tattoo':['https://cheyennetattoo.com/en/tattoo-machines/hawk-pen'],
'fabricpaint':['https://www.jacquardproducts.com/lumiere','https://www.jacquardproducts.com/lumiere-exciter-pack'],
'acrylic':['https://www.liquitex.com/collections/basics-acrylic-sets'],
'drums':['https://www.aeroband.net/products/pocketdrum-2-plus','https://aeroband.fr/'],
'plants':['https://www.thesill.com/products/pink-syngonium'],
'piercing':['https://anatometal.com/products/prong-set-navel-curves'],
'photo-printer':['https://instax.com/mini_link_3/en/'],
'mat':['https://olfa.com/products/rm-sg-18-x-24-self-healing-rotary-cutting-mat'],
'heatpress':['https://cricut.com/en-us/heat-presses/cricut-easypress/cricut-easypress-mini/cricut-easypress-mini/2007468.html']
}
PATTERNS={
'macbook':r'macbook|mbp|m5|125405', 'airpods':r'airpods|max', 'playstation':r'console|ps5.*(hardware|product|console|render)|hardware.*ps5|dualsense.*pink',
'airwrap':r'primary/|specifications/|492485|\.png', 'airstrait':r'primary/|airstrait.*png|specifications/|\.png',
'tattoo':r'hawk.*pen|pen.*hawk','fabricpaint':r'lumiere|exciter','plants':r'syngonium|pink',
'drums':r'pocket|drum','photo-printer':r'product|pink|main|device|item|printer','mat':r'cutting|rm-sg|rotary','heatpress':r'mini|easypress'}
def get(u):
 r=requests.get(u,timeout=22,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status()
 if len(r.content)>18_000_000:raise ValueError('oversize')
 return r

def candidates(key,urls):
 results=[];seen=set();errors=[];matches=PATTERNS.get(key,r'.')
 for page in urls:
  try:
   r=get(page)
   if r.headers.get('Content-Type','').startswith('image/'):
    pairs=[(page,'direct source')]
   else:
    soup=BeautifulSoup(r.text,'html.parser');pairs=[]
    # Shopify product JSON gives original full-frame product photographs before page banners
    if '/products/' in page:
     try:
      js=get(page.split('?')[0]+'.js').json()
      for u in js.get('images',[])[:15]:pairs.append((urljoin(page,u),'product image'))
     except Exception:pass
    for m in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
     if m.get('content'):pairs.append((urljoin(page,m['content']),'social image'))
    for im in soup.find_all(['img','source']):
     alt=im.get('alt','')
     for a in ['data-image','data-src','data-lazy-src','src']:
      if im.get(a):pairs.append((urljoin(page,im[a]),alt))
     for a in ['srcset','data-srcset']:
      if im.get(a):
       for x in im[a].split(',')[-2:]:pairs.append((urljoin(page,x.strip().split(' ')[0]),alt))
    for raw in re.findall(r'(?:https?:)?//[^\s\"<>]+?\.(?:png|webp|jpg|jpeg)(?:\?[^\s\"<>]*)?',r.text):pairs.append((urljoin(page,html.unescape(raw)),'inline asset'))
    pairs=[x for x in pairs if re.search(matches,x[0]+' '+x[1],re.I)]
   for url,alt in pairs:
    url=html.unescape(url).replace('\\/','/');identity=url.split('?')[0]
    if identity in seen or not url.startswith('https://') or any(x in url.lower() for x in ['logo','icon','badge','sprite','pixel','1x1','avatar','rating']):continue
    seen.add(identity)
    try:
     raw=get(url).content;im=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGBA')
     if min(im.size)<190 or max(im.size)<450:continue
     if max(im.size)>4000:im.thumbnail((2400,2400),Image.Resampling.LANCZOS)
     arr=np.array(im);alpha=arr[:,:,3];border=np.concatenate([arr[0,:,:3],arr[-1,:,:3],arr[:,0,:3],arr[:,-1,:3]]).astype(float)
     colour=np.median(border,axis=0);flat=float((np.max(abs(border-colour),axis=1)<10).mean());native=float((alpha<10).mean())
     name=f'{key}-{len(results):02d}.png';im.save(OUT/'photos'/name)
     results.append({'key':key,'name':name,'url':url,'page':page,'alt':alt,'size':im.size,'alpha':round(native,3),'border_flat':round(flat,3),'border_rgb':colour.astype(int).tolist(),'sha256':hashlib.sha256(raw).hexdigest()})
     if len(results)>=14:break
    except Exception as e:errors.append({'url':url,'error':str(e)[:110]})
   if len(results)>=14:break
  except Exception as e:errors.append({'page':page,'error':str(e)[:180]})
 for start in range(0,len(results),8):
  part=results[start:start+8];sheet=Image.new('RGB',(1440,760),'#eeeeee');d=ImageDraw.Draw(sheet)
  for j,row in enumerate(part):
   x=j%4*360;y=j//4*380
   for yy in range(0,330,22):
    for xx in range(0,352,22):d.rectangle((x+xx,y+yy,x+xx+21,y+yy+21),fill='#dadada' if (xx//22+yy//22)%2 else '#f2f2f2')
   im=Image.open(OUT/'photos'/row['name']);im.thumbnail((330,305));sheet.paste(im,(x+(350-im.width)//2,y+(330-im.height)//2),im)
   d.text((x+8,y+339),row['name']+' alpha='+str(row['alpha']),fill='black');d.text((x+8,y+356),str(row['size'])+' flat='+str(row['border_flat']),fill='black')
  sheet.save(OUT/f'{key}-{start//8}.jpg',quality=87)
 print(key,len(results),flush=True);return {'key':key,'results':results,'errors':errors}
with ThreadPoolExecutor(max_workers=5) as pool:reports=list(pool.map(lambda x:candidates(*x),SOURCES.items()))
(OUT/'manifest.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
# Snapshot allows local assessment without running network requests from the conversation container
import zipfile
with zipfile.ZipFile(OUT/'current-wishlist.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in (ROOT/'wishlist').rglob('*'):
  if p.is_file():z.write(p,str(p.relative_to(ROOT)))
print('candidate review complete')
