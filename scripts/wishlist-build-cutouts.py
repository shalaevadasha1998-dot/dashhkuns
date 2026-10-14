"""Build real RGBA cutouts from the already published card photos, not the owner's portrait."""
import io,json,os,pathlib,urllib.request,concurrent.futures,hashlib
import numpy as np
from PIL import Image,ImageOps,ImageDraw
from rembg import remove,new_session
ROOT=pathlib.Path('wishlist');OUT=ROOT/'items';OUT.mkdir(exist_ok=True)
EVIDENCE=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-refresh';EVIDENCE.mkdir(exist_ok=True)
data=json.loads((ROOT/'data.json').read_text());report=[];cache={}
session=new_session('isnet-general-use',providers=['CPUExecutionProvider'])
def load(item):
 url=item['image'];req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; WishlistAssetBuild/1.0)'})
 with urllib.request.urlopen(req,timeout=30) as r:
  raw=r.read(25_000_001)
  if len(raw)>25_000_000:raise ValueError('source exceeds 25mb')
 im=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGBA');im.thumbnail((1300,1300),Image.Resampling.LANCZOS)
 return item,im
sources={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for item in data['items']:
  sources[item['id']]=pool.submit(load,item)
for item in data['items']:
 try:
  if item['image'] in cache:
   cutout=cache[item['image']].copy()
  else:
   _,original=sources[item['id']].result()
   alpha=np.asarray(original.getchannel('A'))
   if (alpha<32).mean()>.15 and (alpha>220).mean()>.02:cutout=original
   else:cutout=remove(original,session=session).convert('RGBA')
   a=np.asarray(cutout.getchannel('A'));bbox=cutout.getchannel('A').point(lambda x:255 if x>12 else 0).getbbox()
   if not bbox or (a>128).mean()<.002:raise ValueError('no meaningful foreground found')
   cutout=cutout.crop(bbox);cache[item['image']]=cutout.copy()
  cutout.thumbnail((820,620),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(900,700),(0,0,0,0));canvas.alpha_composite(cutout,((900-cutout.width)//2,(700-cutout.height)//2))
  file=OUT/(item['id']+'.png');canvas.save(file,optimize=True)
  values=np.asarray(canvas.getchannel('A'))
  report.append({'id':item['id'],'title':item['title'],'ok':True,'transparent_fraction':float((values==0).mean()),'bytes':file.stat().st_size})
  item['image']='/wishlist/items/'+item['id']+'.png';item.pop('fit',None)
  print('prepared',item['id'],flush=True)
 except Exception as e:
  report.append({'id':item['id'],'ok':False,'error':str(e)[:240]});print('failed',item['id'],str(e)[:160],flush=True)
(ROOT/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(EVIDENCE/'cutout-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
# alpha checkboard and contact sheets for human inspection, separate from shipped assets
for start in range(0,len(data['items']),12):
 batch=data['items'][start:start+12];sheet=Image.new('RGB',(1200,330*((len(batch)+3)//4)),(238,238,238));draw=ImageDraw.Draw(sheet)
 for index,item in enumerate(batch):
  x=(index%4)*300;y=(index//4)*330
  for yy in range(y,y+280,20):
   for xx in range(x,x+300,20):
    if ((xx-x)//20+(yy-y)//20)%2:draw.rectangle((xx,yy,xx+19,yy+19),fill=(212,212,212))
  file=OUT/(item['id']+'.png')
  if file.exists():
   im=Image.open(file);im.thumbnail((290,270));sheet.paste(im,(x+(300-im.width)//2,y+(280-im.height)//2),im)
  draw.text((x+12,y+290),item['id'],fill=(0,0,0))
 sheet.save(EVIDENCE/f'cutouts-{start//12+1}.jpg',quality=90)
assert all(x['ok'] for x in report), 'some images require manual attention'
