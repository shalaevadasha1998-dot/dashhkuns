"""Apply only the requested wishlist copy changes and wire up private reservations."""
from pathlib import Path
import re,json
root=Path('wishlist')
p=root/'index.html';text=p.read_text()
text=text.replace('не только вещи. зовите','не только вещи — зовите')
text=text.replace('встречаться. создавать.<br>уезжать. <span>и иногда — новую штуку.</span>','встречаться и создавать<br>уезжать <span>и иногда — новую штуку</span>')
text=re.sub(r'>([^<>]*)<',lambda m:'>'+m[1].replace('. ','<br>').replace('…','').rstrip('.')+'<',text)
text=text.replace('03 / без сложностей','03 / как сохранить сюрприз')
text=text.replace('не угадывай<br><span class="serif">просто напиши</span>','выбери подарок<br><span class="serif">сохрани сюрприз</span>')
text=text.replace('выбери подарок, открой карточку и скопируй сообщение<br>отправь его мне в нашем обычном чате — так мы уточним детали и не купим одно и то же','открой карточку, введи свой тг и забронируй подарок<br>я увижу только отметку «забронировано» — без имени и контакта')
text=text.replace('«мой выбор» сохраняется только в твоём браузере и не бронирует подарок для других','сохрани личную ссылку после бронирования — по ней можно снять или продлить бронь<br>сердечко «мой выбор» остаётся личной подборкой на твоём устройстве')
text=text.replace('https://dashhkuns.com/assets/shoot-2026-9694.jpg','https://dashhkuns.com/assets/shoot-2026-9694.jpg')
if '/wishlist/reservations.js' not in text:
 text=text.replace('</head>','<link rel="stylesheet" href="/wishlist/reservations.css?v=20261014-2">\n<script src="/wishlist/reservations.js?v=20261014-2" defer></script>\n</head>')
text=text.replace('20261014-1','20261014-2').replace('content="noindex,follow"','content="noindex,follow"')
text=text.replace('<meta name="theme-color"','<meta name="referrer" content="no-referrer"><meta name="theme-color"',1)
p.write_text(text)
p=root/'app.js';text=p.read_text();text=text.replace("const url = new URL(raw); return url.protocol === 'https:' ? url.href : '';", "const url = new URL(raw, location.origin); return (url.protocol === 'https:' || (typeof raw === 'string' && raw.startsWith('/wishlist/items/') && url.origin === location.origin)) ? url.href : '';")
text=text.replace("'хочу.'","'хочу'").replace("'». давай уточним детали, чтобы не промахнуться: '","'»\\nдавай уточним детали, чтобы не промахнуться: '")
text=text.replace("' · выбор на этом устройстве'","' / выбор на этом устройстве'")
text=text.replace("if (!dialog.open) dialog.showModal();","window.dispatchEvent(new CustomEvent('wishlist:gift',{detail:item})); if (!dialog.open) dialog.showModal();")
text=text.replace("render();filter();grid.setAttribute", "render();filter();window.dispatchEvent(new CustomEvent('wishlist:items',{detail:items}));grid.setAttribute")
text=text.replace("date.toLocaleDateString('ru-RU')", "date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(/\\s*г\\.$/,'')")
text=text.replace('20261014-1','20261014-2');p.write_text(text)
p=root/'data.json';data=json.loads(p.read_text())
for item in data['items']:
 for field in ('title','description','category'):
  if field in item:item[field]=item[field].replace('. ','\n').rstrip('.').replace(' · ',' / ')
 if item['id']=='newyear':
  item['title']='новый год в тёплом месте'
  item['description']='хочу уехать на неделю в тёплое место на новый год\nнаправление и даты пока выбираю'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
assert 'хочет.' not in text
assert len(data['items'])==39
print('copy refreshed: no sentence dots, new-year title, reservation UI attached')
