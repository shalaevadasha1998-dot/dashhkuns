"""Build reviewed whole-object cutouts only; no generative segmentation or portrait edits."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,io,json,os
import requests,numpy as np
from scipy import ndimage as ndi
from PIL import Image,ImageOps,ImageFilter,ImageDraw
ROOT=Path('.').resolve();ITEMS=ROOT/'wishlist/items';OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-full-review';OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
'macbook':('https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/macbook-pro-14-inch-m5.png','https://support.apple.com/en-us/125405','native'),
'airwrap':('https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/492485-01.png?fmt=png-alpha&wid=1400','https://www.dyson.com/hair-care/hair-stylers/airwrap-co-anda2x','native'),
'airstrait':('https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary-locale/en_US/453951-01.png?fmt=png-alpha&wid=1400','https://www.dyson.com/hair-care/hair-straighteners/airstrait/ceramic-pink-rose-gold','native'),
'speaker':('https://www.morningblues.com/cdn/shop/files/A1_BG.png?v=1785206536&width=1600','https://www.morningblues.com/products/morningblues-lyric-transparent-speaker-sonicglass-a1','native'),
'sousvide':('https://cdn.shopify.com/s/files/1/0619/7487/2253/products/Anova_PrecisionCooker3hero.webp?v=1757350346','https://anovaculinary.com/products/anova-precision-cooker-3','white'),
'coffee':('https://dam.delonghi.com/902x902/assets/113707','https://www.delonghi.com/en-us/p/essenza-mini-espresso-machine/EN85B.html','coffee'),
'fabricpaint':('https://images.squarespace-cdn.com/content/v1/5ac4eb022971149bb6d709d3/1544137761805-NO7PGN6O4YYHZJGXY9KY/JAC5000_Lumiere-6-color-set-RGB.jpg','https://www.jacquardproducts.com/lumiere','white'),
'tattoo':('https://shop.us.cheyennetattoo.com/cdn/shop/files/HAWK_Pen_2_2.jpg?v=1761639609&width=1445','https://cheyennetattoo.com/en/tattoo-machines/hawk-pen','holes'),
'theact':('https://theact.ru/upload/webp/100/upload/resize-cache/iblock/38a/wbc0mj9yjkqywqglv58epqgxc98pgvh4/1000-1500-1/3-skraba-nabor-1.webp','https://theact.ru/catalog/nabory/nabor_skrabov_dlya_tela_kokos_shokolad_greypfrut/','white'),
'drums':('https://aeroband.fr/wp-content/uploads/2024/02/PocketDrum-2-Plus.webp','https://aeroband.fr/','holes'),
'plants':('https://cdn.shopify.com/s/files/1/0979/5115/4506/files/syngonium-podophyllum-pink-perfection-aka-pink-dream-04.webp?v=1776363046','https://foliage-factory.com/products/syngonium-pink-perfection-aka-pink-dream','plant'),
'piercing':('https://cdn.shopify.com/s/files/1/0002/2872/0700/files/bj0375-P_1.jpg?v=1722319573','https://glittersjewellery.com/products/titanium-double-cz-belly-button-navel-ring-pink','silver'),
'checkup':('https://assets.solventum.com/is/image/mmmspinco/5861-Aux-1','https://www.littmann.com/en-us/home/f/b00037556/','holes'),
'magazines':('https://pngimg.com/uploads/magazine/magazine_PNG100074.png','https://pngimg.com/images/objects/magazine','native'),
'dna':('https://www.genotek.ru/full-genome/Research_desktop.png','https://www.genotek.ru/full-genome/','auto'),
'console':('https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21?$facebook$','https://www.playstation.com/en-us/ps5/','native')
}
def get(url):
 r=requests.get(url,timeout=35,headers={'User-Agent':'Mozilla/5.0 (WishlistProductReference)'});r.raise_for_status()
 if len(r.content)>25_000_000:raise ValueError('source too large')
 return r

def load_url(url):return ImageOps.exif_transpose(Image.open(io.BytesIO(get(url).content))).convert('RGBA')
def apply_mask(im,mask):
 a=np.array(im.convert('RGBA'));m=np.array(Image.fromarray((~mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.35)));m[m<8]=0;m[m>248]=255;a[:,:,3]=np.minimum(a[:,:,3],m);return Image.fromarray(a)
def connected(candidate):
 labels,_=ndi.label(candidate);idx=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]));return np.isin(labels,idx[idx!=0])
def studio(im,tolerance=16,holes=False,neutral=False):
 a=np.array(im);rgb=a[:,:,:3].astype(float);edges=np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]])
 background=np.median(edges,axis=0);candidate=np.max(abs(rgb-background),axis=2)<=tolerance
 if neutral:candidate=(rgb.min(axis=2)>140)&((rgb.max(axis=2)-rgb.min(axis=2))<13)
 return apply_mask(im,candidate if holes else connected(candidate|(a[:,:,3]<8)))
def polygon(im,points):
 mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(points,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(.45));a=np.array(im);a[:,:,3]=np.minimum(a[:,:,3],np.array(mask));return Image.fromarray(a)
def normalized(im,canvas=(1200,900)):
 a=np.array(im.convert('RGBA'));a[a[:,:,3]<8,3]=0;im=Image.fromarray(a);bbox=im.getbbox()
 if not bbox:raise ValueError('empty object')
 im=im.crop(bbox);scale=min((canvas[0]-160)/im.width,(canvas[1]-160)/im.height,2.8)
 im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',canvas);out.alpha_composite(im,((canvas[0]-im.width)//2,(canvas[1]-im.height)//2));return out

def original(key):return Image.open(ITEMS/(key+'.png')).convert('RGBA')
def prep(key,im,mode):
 if mode=='native':return im
 if mode=='auto' and np.mean(np.array(im)[:,:,3]<8)>.05:return im
 if mode=='plant':return studio(im,neutral=True)
 if mode=='silver':return studio(im,7)
 if mode=='coffee':
  im=studio(im);assert im.size==(902,902)
  return polygon(im,[(0,0),(902,0),(902,602),(627,603),(627,608),(526,695),(517,699),(478,698),(465,710),(451,719),(422,727),(386,731),(349,729),(323,724),(307,719),(292,709),(285,689),(0,689)])
 return studio(im,17,mode=='holes')

def park_logo():
 # The park page rejected automated access, so use the separate designer's public case asset
 import cairosvg
 url='https://air.agency/img/case/ostrov/logo.svg';raw=get(url).content
 return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw,output_width=1000))).convert('RGBA'),url
manifest=json.loads((ROOT/'wishlist/data.json').read_text());rows=[];old_ids=[x['id'] for x in manifest['items']]
with ThreadPoolExecutor(max_workers=5) as pool:pending={key:pool.submit(load_url,row[0]) for key,row in SOURCES.items()}
assets={key:prep(key,f.result(),SOURCES[key][2]) for key,f in pending.items()}
assets['airpods']=original('airpods').crop((70,80,560,620))
assets['finemarkers']=polygon(original('finemarkers'),[(260,30),(770,30),(770,658),(730,658),(349,567),(335,310),(303,182),(286,135),(260,120)])
assets['beads']=original('beads').crop((199,105,601,420));assets['necklace']=assets['beads'].copy()
console=assets.pop('console').crop((543,10,804,603));console=console.crop(console.getbbox());console.thumbnail((360,720),Image.Resampling.LANCZOS)
pad=studio(original('playstation'),neutral=True);pad=pad.crop(pad.getbbox());pad.thumbnail((460,290),Image.Resampling.LANCZOS)
combo=Image.new('RGBA',(1050,800));combo.alpha_composite(console,(120,50));combo.alpha_composite(pad,(535,130));combo.alpha_composite(pad,(535,450));assets['playstation']=combo
assets['dreamisland'],park_source=park_logo()
for item in manifest['items']:
 key=item['id'];im=normalized(assets.get(key) if key in assets else original(key));path=ITEMS/(key+'-full.png');im.save(path,optimize=True)
 alpha=np.array(im.getchannel('A'));bbox=im.getbbox();assert .08<(alpha==0).mean()<.985,key
 assert bbox[0]>=30 and bbox[1]>=30 and bbox[2]<=1170 and bbox[3]<=870,key
 item['image']='/wishlist/items/'+path.name;item.pop('fit',None)
 rows.append({'id':key,'new_source':key in SOURCES or key=='playstation' or key=='dreamisland','mode':SOURCES.get(key,('','','preserved_whole_selection'))[2],'full_frame_margin':True,'transparent_fraction':round(float((alpha==0).mean()),4),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
changes={
 'speaker':{'title':'morningblues sonicglass a1','description':'прозрачная колонка с экраном и текстами песен\nориентир — sonicglass a1, комплектацию согласуем','url':'https://www.morningblues.com/products/morningblues-lyric-transparent-speaker-sonicglass-a1'},
 'theact':{'title':'набор скрабов и ухода the act','description':'хочу большой набор ухода the act\nскрабы и другие средства — точный состав сначала согласуем'},
 'bigcanvas':{'description':'два больших холста — хочу сама написать картины в спальню\nразмеры сначала согласуем'},
 'fabricpaint':{'description':'большая профессиональная палитра для ткани\nобязательно флуоресцентные, перламутровые и металлические оттенки\nфото — пример линейки, хочу не только маленький набор'},
 'hardware':{'description':'люверсы, кнопки, заклёпки, цепи, карабины, кольца, пряжки, шипы и молнии\nмного разных необычных деталей для кастома одежды и головных уборов'},
 'gluegun':{'description':'хороший клеевой пистолет для декора, коллажей и мелких diy-штук\nудобная подача клея и сменные стержни — модель сначала согласуем'},
 'tattoo':{'description':'оплата сеанса или сертификат на татуировку\nмастера и эскиз выбираю сама\nтату-машинка на фото только символ сеанса — оборудование дарить не нужно'},
 'checkup':{'description':'бюджет около 20 000 ₽ на чекап и анализы\nклинику и состав обследования выбираю отдельно\nстетоскоп на фото — символ обследования, не отдельная хотелка'},
 'dna':{'description':'хочу днк-тест на происхождение и генетические особенности\nлабораторию, программу и условия обработки данных выбираю отдельно\nнабор на фото только визуальный пример'},
 'piercing':{'description':'пирсинг пупка — сертификат на прокол и украшение\nстудию выбираю сама, подходящее украшение подбирает пирсер'},
 'magazines':{'description':'старые журналы, газеты, каталоги, открытки и интересные бумажки для коллажей\nособенно нравится печатное из 90-х и нулевых\nможно просто отдать то, что вам уже не нужно'},
 'necklace':{'description':'бисер, стеклярус, жемчуг, подвески и фурнитура — хочу собрать ожерелье сама\nнить, иглы, застёжки и соединительные кольца тоже пригодятся'}
}
for item in manifest['items']:
 item.update(changes.get(item['id'],{}));assert '.' not in item['title'] and '.' not in item['description']
assert old_ids==[x['id'] for x in manifest['items']];assert len(old_ids)==39
manifest['updated']='2026-10-15';(ROOT/'wishlist/data.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
provenance={key:{'image':row[0],'page':row[1],'processing':row[2]} for key,row in SOURCES.items()};provenance['dreamisland']={'image':park_source,'page':'https://air.agency/cases/ostrov','processing':'public_designer_mark'}
(ROOT/'wishlist/product-image-sources.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
for batch in range(4):
 part=manifest['items'][batch*12:(batch+1)*12];sheet=Image.new('RGB',(1600,960),'#ddd');draw=ImageDraw.Draw(sheet)
 for n,item in enumerate(part):
  x=n%4*400;y=n//4*320;draw.rectangle((x,y,x+399,y+280),fill='#111111' if n%2 else '#f6f6f6')
  im=Image.open(ROOT/item['image'].lstrip('/'));im.thumbnail((390,280),Image.Resampling.LANCZOS);sheet.paste(im,(x+(400-im.width)//2,y),im);draw.text((x+12,y+294),item['id'],fill='black')
 sheet.save(OUT/f'full-items-{batch+1}.jpg',quality=93)
(OUT/'full-items-report.json').write_text(json.dumps({'ok':True,'count':len(rows),'items':rows},indent=2))
print(json.dumps({'ok':True,'items':len(rows),'replacement_sources':sum(x['new_source'] for x in rows)}))
