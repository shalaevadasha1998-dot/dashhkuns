"""Final narrow source review; public sources only, no generated products."""
from pathlib import Path
scope={}
source=Path('scripts/wishlist-candidate-review.py').read_text()
exec(compile(source.split('with ThreadPoolExecutor(max_workers=5) as pool:')[0],'<candidate helpers>','exec'),scope)
scope['PATTERNS'].update({'plants3':r'syngonium|dream|perfection','piercing3':r'pink|bj0375|navel','dna3':r'Step|Kit|Box|Order|набор|Tube','checkup3':r'5633|5870|classic|stethoscope|littmann','magazines3':r'magazine'})
S={
'plants3':['https://foliage-factory.com/products/syngonium-pink-perfection-aka-pink-dream'],
'piercing3':['https://glittersjewellery.com/products/titanium-double-cz-belly-button-navel-ring-pink'],
'dna3':['https://www.genotek.ru/full-genome/'],
'checkup3':['https://www.littmann.com/en-us/home/f/b00037556/'],
'magazines3':['https://pngimg.com/image/44799','https://www.pngkit.com/view/u2t4t4t4r5q8e6u2_magazine-png-download-png-image-with-transparent-background/']
}
with scope['ThreadPoolExecutor'](max_workers=5) as pool:
 reports=list(pool.map(lambda x:scope['candidates'](*x),S.items()))
(scope['OUT']/'manifest.json').write_text(scope['json'].dumps(reports,ensure_ascii=False,indent=2))
