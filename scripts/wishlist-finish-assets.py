"""Refine only already prepared product cutouts; never alter the owner's portrait."""
from pathlib import Path
import hashlib,json,os
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'wishlist-refresh';OUT.mkdir(parents=True,exist_ok=True)
def frame(im):
    bbox=im.getbbox()
    if not bbox:raise ValueError('empty cutout')
    cut=im.crop(bbox);cut.thumbnail((810,610),Image.Resampling.LANCZOS)
    result=Image.new('RGBA',(900,700),(0,0,0,0))
    result.alpha_composite(cut,((900-cut.width)//2,(700-cut.height)//2))
    return result
marker=ROOT/'wishlist/items/.studio-panels-clean-v1'
if not marker.exists():
    p=ROOT/'wishlist/items/airwrap.png'
    im=Image.open(p).convert('RGBA');a=np.array(im);rgb=a[:,:,:3].astype(float)
    # Remaining rectangular photo panels are cool grey-blue; the product is pink and black
    background=(rgb[:,:,0]>165)&(rgb[:,:,1]>173)&(rgb[:,:,2]>184)&(rgb[:,:,2]>=rgb[:,:,0]-1)&((rgb.max(axis=2)-rgb.min(axis=2))<42)
    a[background,3]=0
    # Keep the primary three attachments rather than duplicate secondary product insets
    frame(Image.fromarray(a).crop((485,35,805,334))).save(p,optimize=True)
    p=ROOT/'wishlist/items/airstrait.png'
    im=Image.open(p).convert('RGBA');a=np.array(im);a[:110,:,3]=0
    frame(Image.fromarray(a)).save(p,optimize=True)
    marker.write_text('v1\n')
manifest=json.loads((ROOT/'wishlist/data.json').read_text())
rows=[]
for item in manifest['items']:
    p=ROOT/item['image'].lstrip('/')
    im=Image.open(p)
    assert im.format=='PNG' and im.mode=='RGBA',item['id']
    alpha=np.array(im.getchannel('A'));fraction=float((alpha==0).mean())
    assert .08<fraction<.995,item['id']
    assert '.' not in item['title'] and '.' not in item['description'],item['id']
    rows.append({'id':item['id'],'png':True,'transparent_fraction':round(fraction,4),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(rows)==39
assert next(i for i in manifest['items'] if i['id']=='newyear')['title']=='новый год в тёплом месте'
(OUT/'cutout-final-check.json').write_text(json.dumps({'ok':True,'count':len(rows),'items':rows},ensure_ascii=False,indent=2))
# Contact sheets include a checkerboard only for review; actual PNG files remain transparent
for batch in range(4):
    chunk=manifest['items'][batch*12:(batch+1)*12]
    if not chunk:continue
    sheet=Image.new('RGB',(1200,990),'#eeeeee')
    from PIL import ImageDraw
    d=ImageDraw.Draw(sheet)
    for j,item in enumerate(chunk):
        x=(j%4)*300;y=(j//4)*330
        for yy in range(0,280,20):
            for xx in range(0,300,20):d.rectangle((x+xx,y+yy,x+xx+19,y+yy+19),fill='#d6d6d6' if (xx//20+yy//20)%2 else '#eeeeee')
        im=Image.open(ROOT/item['image'].lstrip('/')).convert('RGBA');im.thumbnail((280,260))
        sheet.paste(im,(x+(300-im.width)//2,y+(280-im.height)//2),im)
        d.text((x+12,y+292),item['id'],fill='black')
    sheet.save(OUT/f'final-cutouts-{batch+1}.jpg',quality=92)
print(json.dumps({'ok':True,'cutouts':len(rows)}))
