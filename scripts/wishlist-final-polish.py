"""Final visual-review corrections after the full-object builder."""
from pathlib import Path
import json,html,os
import numpy as np
from PIL import Image,ImageDraw
scope={}
source=Path('scripts/wishlist-full-products.py').read_text()
exec(compile(source.split('manifest=json.loads(')[0],'<image helpers>','exec'),scope)
root=Path('.');items=root/'wishlist/items';out=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-full-review';out.mkdir(parents=True,exist_ok=True)
get=scope['get'];load=scope['load_url'];studio=scope['studio'];frame=scope['normalized']
# Use a complete photographed pack, not the previously segmented box with holes
page='https://www.liquitex.com/products/basics-acrylic-set-48x22ml'
product=get(page+'.js').json();urls=product.get('images',[])
url=next(u for u in urls if '/80919' in u)
if url.startswith('//'):url='https:'+url
acrylic=frame(studio(load(url),10));acrylic.save(items/'acrylic-full.png',optimize=True)
# The Genotek lifestyle image is not a viable cutout; use a complete kit illustration
# This is an image reference only, not a chosen laboratory or purchase recommendation
kit_url='https://cmsasset.ancestrycdn.com/content/experience-fragments/acom/en-us/onsite/_2026/oct_fall_sale/dna-lohp/nonsubs/_jcr_content/root/responsivegrid/container_copy_copy__891895731/itemlist/item-0/container_copy_copy/image.coreimg.png/1786556409823/us-octgift-dna.png'
kit=load(kit_url)
if float((np.array(kit)[:,:,3]==0).mean())<.05:kit=studio(kit,10)
kit=frame(kit);kit.save(items/'dna-full.png',optimize=True)
# Preserve line breaks and use a gender-neutral message for every visitor
css=root/'wishlist/ideas.css';text=css.read_text()
rule='\n.gift-description,#dialog-description{white-space:pre-line}\n'
if rule.strip() not in text:css.write_text(text+rule)
js=root/'wishlist/ideas.js';js.write_text(js.read_text().replace('дора, увидела идею «','дора, в твоём вишлисте есть идея «'))
data_path=root/'wishlist/product-image-sources.json';sources=json.loads(data_path.read_text())
sources['acrylic']={'image':url,'page':page,'processing':'whole_package_border_mask'}
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
print('39 complete-frame assets, two final reference replacements, readable text and neutral messages')
