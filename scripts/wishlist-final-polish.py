"""Final visual-review corrections after the full-object builder."""
from pathlib import Path
import json,html,os
import numpy as np
from PIL import Image,ImageDraw
scope={}
source=Path('scripts/wishlist-full-products.py').read_text()
exec(compile(source.split('manifest=json.loads(')[0],'<image helpers>','exec'),scope)
root=Path('.');items=root/'wishlist/items';out=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-full-review';out.mkdir(parents=True,exist_ok=True)
get=scope['get'];load=scope['load_url'];studio=scope['studio'];frame=scope['normalized'];polygon=scope['polygon']
page='https://www.liquitex.com/products/basics-acrylic-set-48x22ml'
product=get(page+'.js').json();urls=product.get('images',[])
url=next(u for u in urls if '/80919' in u)
if url.startswith('//'):url='https:'+url
# The selected photo is a front-on rectangular box: mask its whole face, retaining white printing
pack=load(url);rgb=np.array(pack)[:,:,:3];ys,xs=np.where(rgb.min(axis=2)<180)
assert len(xs)>1000
pad=max(1,round(pack.width/1000));x0=max(0,int(xs.min())-pad);x1=min(pack.width-1,int(xs.max())+pad);y0=max(0,int(ys.min())-pad);y1=min(pack.height-1,int(ys.max())+pad)
acrylic=frame(polygon(pack,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]));acrylic.save(items/'acrylic-full.png',optimize=True)
# Replace an unusable lifestyle photograph with a complete kit reference, not a lab recommendation
kit_url='https://cmsasset.ancestrycdn.com/content/experience-fragments/acom/en-us/onsite/_2026/oct_fall_sale/dna-lohp/nonsubs/_jcr_content/root/responsivegrid/container_copy_copy__891895731/itemlist/item-0/container_copy_copy/image.coreimg.png/1786556409823/us-octgift-dna.png'
kit=load(kit_url)
if float((np.array(kit)[:,:,3]==0).mean())<.05:kit=studio(kit,10)
frame(kit).save(items/'dna-full.png',optimize=True)
# Keep the complete book stack and glasses; discard the fragmented background plant and cup
books=Image.open(items/'psychology.png').convert('RGBA')
assert books.size==(900,700)
books=polygon(books,[(0,0),(460,0),(465,282),(483,288),(483,348),(500,350),(502,405),(510,408),(510,460),(0,650)])
frame(books).save(items/'psychology-full.png',optimize=True)
css=root/'wishlist/ideas.css';text=css.read_text()
rule='\n.gift-description,#dialog-description{white-space:pre-line}\n'
if rule.strip() not in text:css.write_text(text+rule)
js=root/'wishlist/ideas.js';js.write_text(js.read_text().replace('дора, увидела идею «','дора, в твоём вишлисте есть идея «'))
data_path=root/'wishlist/product-image-sources.json';sources=json.loads(data_path.read_text())
sources['acrylic']={'image':url,'page':page,'processing':'complete_rectangular_package_face'}
sources['dna']={'image':kit_url,'page':'https://www.ancestry.com/dna/','processing':'complete_kit_reference'}
data_path.write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
credits=root/'wishlist/image-credits.html';text=credits.read_text()
if 'id="last-reference-update"' not in text:
 text=text.replace('</body>','<section id="last-reference-update"><h2>уточнение источников предметных фотографий</h2><p>акрил — <a href="'+html.escape(page,quote=True)+'">полная упаковка liquitex</a><br>днк-тест — <a href="https://www.ancestry.com/dna/">фотография набора ancestry</a> как пример услуги, лаборатория не выбрана<br>фон удалён, масштаб и поля изменены</p></section></body>')
 credits.write_text(text)
manifest=json.loads((root/'wishlist/data.json').read_text());checks=[]
for batch in range(4):
 part=manifest['items'][batch*12:(batch+1)*12];sheet=Image.new('RGB',(1600,960),'#ddd');d=ImageDraw.Draw(sheet)
 for n,item in enumerate(part):
  im=Image.open(root/item['image'].lstrip('/')).convert('RGBA');alpha=np.array(im.getchannel('A'));bbox=im.getbbox()
  assert .08<float((alpha==0).mean())<.985,item['id']
  assert bbox and bbox[0]>=30 and bbox[1]>=30 and bbox[2]<=1170 and bbox[3]<=870,item['id']
  checks.append({'id':item['id'],'rgba':True,'whole_frame_margin':True,'transparent_fraction':round(float((alpha==0).mean()),4)})
  x=n%4*400;y=n//4*320;d.rectangle((x,y,x+399,y+280),fill='#111111' if n%2 else '#f6f6f6')
  im.thumbnail((390,280),Image.Resampling.LANCZOS);sheet.paste(im,(x+(400-im.width)//2,y),im);d.text((x+12,y+294),item['id'],fill='black')
 sheet.save(out/f'full-items-{batch+1}.jpg',quality=93)
(out/'full-items-report.json').write_text(json.dumps({'ok':True,'count':len(checks),'items':checks},indent=2))
print('39 complete-frame assets, final reference replacements, readable text and neutral messages')
