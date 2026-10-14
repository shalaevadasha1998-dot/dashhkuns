"""Run the existing read-only collector with only the missing exact sources."""
from pathlib import Path
scope={}
source=Path('scripts/wishlist-candidate-review.py').read_text()
exec(compile(source.split('with ThreadPoolExecutor(max_workers=5) as pool:')[0],'<candidate helpers>','exec'),scope)
scope['PATTERNS'].update({'plants2':r'syngonium|robusta|neon|pink','piercing2':r'beth|pink','coffee2':r'essenza|en85|en_85|013219|013218','theact2':r'3-skraba|3_skraba|nabor|4678599767626|скраб|набор','dna2':r'kit|tube|box|набор|order|steps|genotek','magazines2':r'magazine|newspaper|png','checkup2':r'stethoscope|hTmowh'})
S={
'airstrait2':['https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary-locale/en_US/453951-01.png?fmt=png-alpha&wid=1400'],
'speaker2':['https://www.morningblues.com/cdn/shop/files/A1_BG.png?v=1785206536&width=1600'],
'plants2':['https://www.patchplants.com/products/plants-syngonium-neon-robusta/'],
'piercing2':['https://tremunpiercing.com/product/beth-pink/'],
'coffee2':['https://www.delonghi.com/en-us/p/essenza-mini-espresso-machine/EN85B.html'],
'dna2':['https://www.genotek.ru/','https://www.genotek.ru/full-genome/'],
'checkup2':['https://www.pngitem.com/middle/hTmowh_stethoscope-png-littmann-classic-3-5870-transparent-png/'],
'magazines2':['https://www.pngall.com/magazine-png/'],
'theact2':['https://theact.ru/upload/webp/100/upload/resize-cache/iblock/38a/wbc0mj9yjkqywqglv58epqgxc98pgvh4/1000-1500-1/3-skraba-nabor-1.webp','https://theact.ru/catalog/nabory/nabor_skrabov_dlya_tela_kokos_shokolad_greypfrut/']
}
with scope['ThreadPoolExecutor'](max_workers=5) as pool:
 reports=list(pool.map(lambda x:scope['candidates'](*x),S.items()))
(scope['OUT']/'manifest.json').write_text(scope['json'].dumps(reports,ensure_ascii=False,indent=2))
