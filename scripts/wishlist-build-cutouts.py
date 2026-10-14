"""Generate non-generative RGBA item assets while preserving solid product colours."""
import io,json,os,pathlib,urllib.request,concurrent.futures,zipfile
from html.parser import HTMLParser
from urllib.parse import urljoin
import numpy as np
from PIL import Image,ImageOps,ImageDraw,ImageFilter
from scipy import ndimage as ndi
from rembg import remove,new_session
ROOT=pathlib.Path('wishlist');OUT=ROOT/'items';OUT.mkdir(exist_ok=True)
EVIDENCE=pathlib.Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-refresh';EVIDENCE.mkdir(exist_ok=True)
data=json.loads((ROOT/'data.json').read_text());report=[];cache={};session=None
original={x['id']:x['image'] for x in data['items']}
overrides={'tshirts':'https://freepngimg.com/thumb/tshirt/36634-6-blank-white-t-shirt-template.png','newyear':'https://assets.stickpng.com/images/580b585b2edbce24c47b271f.png','bigcanvas':original['canvas']}
australia_page='https://toppng.com/free-image/sydeny-opera-house-png-sydney-PNG-free-PNG-Images_210634'
class Metadata(HTMLParser):
 def __init__(self):super().__init__();self.images=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta' and a.get('property')=='og:image':self.images.insert(0,a.get('content',''))
  if tag=='img' and 'sydeny opera house' in a.get('alt','').lower():self.images.append(a.get('src',''))
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; WishlistAssetBuild/1.0)'})
 with urllib.request.urlopen(req,timeout=30) as r:
  b=r.read(25_000_001)
  if len(b)>25_000_000:raise ValueError('source too large')
  return b

def source(item):
 if item['image'].startswith('/wishlist/items/') and (OUT/(item['id']+'.png')).exists():return Image.open(OUT/(item['id']+'.png')).convert('RGBA')
 url=overrides.get(item['id'],item['image'])
 if item['id']=='australia':
  meta=Metadata();meta.feed(get(australia_page).decode('utf-8'))
  choices=[urljoin(australia_page,x) for x in meta.images if x]
  if not choices:raise ValueError('Australia transparent photo source unavailable')
  url=choices[0]
 raw=get(url);im=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGBA');im.thumbnail((1300,1300),Image.Resampling.LANCZOS);return im

def cut(im):
 global session
 existing=np.array(im.getchannel('A'))
 if (existing<32).mean()>.15 and (existing>220).mean()>.02:return im,'native_alpha'
 rgb=np.array(im.convert('RGB')).astype(np.int16)
 border=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]])
 colour=np.median(border,axis=0);flat=np.max(np.abs(border-colour),axis=1)<12
 if flat.mean()>.65 and colour.min()>180:
  candidate=np.max(np.abs(rgb-colour),axis=2)<16
  seed=np.zeros(candidate.shape,bool);seed[0]=candidate[0];seed[-1]=candidate[-1];seed[:,0]=candidate[:,0];seed[:,-1]=candidate[:,-1]
  bg=ndi.binary_propagation(seed,mask=candidate)
  mask=~bg;mode='connected_studio_background'
 else:
  if session is None:session=new_session('u2net',providers=['CPUExecutionProvider'])
  mask=np.array(remove(im,session=session,only_mask=True).convert('L'))>128
  mask=ndi.binary_fill_holes(mask);mode='subject_mask'
 labels,n=ndi.label(mask);sizes=np.bincount(labels.ravel());keep=sizes>=max(8,mask.size*.00004);keep[0]=False;mask=keep[labels]
 if mask.mean()<.002:raise ValueError('no meaningful foreground found')
 alpha=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.4))
 result=im.copy();result.putalpha(alpha);return result,mode

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 sources={i['id']:pool.submit(source,i) for i in data['items']}
 for item in data['items']:
  try:
   im=sources[item['id']].result();cutout,mode=cut(im)
   bbox=cutout.getchannel('A').point(lambda x:255 if x>12 else 0).getbbox()
   if not bbox:raise ValueError('empty alpha')
   cutout=cutout.crop(bbox)
   if item['id']=='bigcanvas':
    cutout.thumbnail((380,590),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(900,700),(0,0,0,0));canvas.alpha_composite(cutout,(55,(700-cutout.height)//2));canvas.alpha_composite(cutout,(460,(700-cutout.height)//2))
   else:
    cutout.thumbnail((820,620),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(900,700),(0,0,0,0));canvas.alpha_composite(cutout,((900-cutout.width)//2,(700-cutout.height)//2))
   file=OUT/(item['id']+'.png');canvas.save(file,optimize=True)
   values=np.array(canvas.getchannel('A'));report.append({'id':item['id'],'title':item['title'],'ok':True,'method':mode,'transparent_fraction':float((values==0).mean()),'bytes':file.stat().st_size})
   item['image']='/wishlist/items/'+item['id']+'.png';item.pop('fit',None);print('prepared',item['id'],mode,flush=True)
  except Exception as e:report.append({'id':item['id'],'ok':False,'error':str(e)[:240]});print('failed',item['id'],str(e)[:160],flush=True)
(ROOT/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');(EVIDENCE/'cutout-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
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
with zipfile.ZipFile(EVIDENCE/'prepared-wishlist.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in ROOT.rglob('*'):
  if file.is_file():z.write(file,str(file))
assert all(x['ok'] for x in report), 'some images require manual attention'
