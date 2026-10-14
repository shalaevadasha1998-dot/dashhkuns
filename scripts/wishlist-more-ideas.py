"""Add optional ideas separately from the 39 confirmed, reservable wishes."""
from pathlib import Path
import json,html
ROOT=Path('.').resolve();p=ROOT/'wishlist/index.html';text=p.read_text()
ideas=[
('пресс для люверсов и кнопок','чтобы аккуратно ставить фурнитуру на одежду и свои аксессуары'),
('коврик для раскроя и роликовый нож','для ровного раскроя ткани, бумаги и деталей коллажа'),
('хорошие портновские ножницы','ножницы для ткани, маленькие ножницы для нитей и удобный распарыватель'),
('мольберт для больших холстов','чтобы работать над большими картинами, а не искать им опору'),
('мастихины и текстурные пасты','для объёма, фактуры и экспериментов с акрилом'),
('пигменты и необычные медиумы','переливы, металлические эффекты и новые текстуры для творчества'),
('аэрограф с компрессором','для градиентов и экспериментов с росписью — сначала выберем комплект'),
('небольшой термопресс','для переноса изображений на одежду и новых экспериментов с кастомом'),
('набор для шелкографии','рамка, ракель и материалы, чтобы попробовать печать на ткани'),
('большой альбом для смешанных техник','плотная бумага под краску, маркеры и журнальные вырезки'),
('мини-фотопринтер','печатать свои фотографии и сразу добавлять их в коллажи'),
('сертификат на печать фото и наклеек','чтобы превратить собственные картинки в материалы для творчества'),
('органайзеры для материалов','переносные коробки с секциями для бисера, фурнитуры и мелочей'),
('манекен для кастомизации','примерять детали и собирать одежду прямо на форме — модель обсудим'),
('сертификат в художественный магазин','запас на материалы, которые я выберу под конкретную работу'),
('творческий мастер-класс вдвоём','керамика, стекло или печать по ткани — новый опыт и время вместе')
]
section='''<section class="wishlist-ideas" id="ideas" aria-labelledby="ideas-title"><div class="section-heading"><p class="eyebrow">ещё идеи / сначала обсудим</p><div><h2 id="ideas-title">а ещё <span class="serif">можно придумать</span></h2><p class="ideas-intro">идеи в дополнение к моим хотелкам — эти подарки я пока не выбрала<br>сначала напиши мне, чтобы решить, что действительно пригодится</p></div></div><div class="ideas-grid">'''
for title,description in ideas:
 section+='<article class="idea-card"><span class="idea-status">идея, не выбранный подарок</span><h3>'+html.escape(title)+'</h3><p>'+html.escape(description)+'</p><button class="text-button" type="button" data-idea="'+html.escape(title,quote=True)+'">предложить эту идею ↗</button></article>'
section+='</div><p class="ideas-footnote">эти идеи пока не бронируются<br>основной список выше — мои уже названные желания</p></section>\n'
if 'id="ideas"' not in text:
 assert '<section class="how"' in text
 text=text.replace('<section class="how"',section+'<section class="how"',1)
if '/wishlist/ideas.css' not in text:
 text=text.replace('</head>','<link rel="stylesheet" href="/wishlist/ideas.css?v=20261015-full-1">\n<script src="/wishlist/ideas.js?v=20261015-full-1" defer></script>\n</head>')
text=text.replace('v=20261014-3','v=20261015-full-1')
text=text.replace('<a href="#how">как дарить</a>','<a href="#ideas">ещё идеи</a><a href="#how">как дарить</a>',1)
text=text.replace('здесь всё, чему я буду рада<br>дорогой подарок совсем не обязателен','люблю вещи, с которыми можно что-то сделать руками<br>и время вместе — дорогой подарок совсем не обязателен')
p.write_text(text)
app=ROOT/'wishlist/app.js';js=app.read_text().replace('v=20261014-3','v=20261015-full-1');app.write_text(js)
css='''.wishlist-ideas{max-width:1600px;margin:auto;padding:64px var(--gutter) 76px;border-top:1px solid var(--black)}.wishlist-ideas h2 .serif{color:var(--pink)}.ideas-intro{font-size:20px;line-height:1.35;max-width:700px;margin-top:26px;color:rgba(8,8,8,.68)}.ideas-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.idea-card{border:1px solid var(--line);border-radius:20px;padding:24px;display:flex;flex-direction:column;min-width:0;background:#fff}.idea-status{display:inline-block;align-self:flex-start;font-size:11px;letter-spacing:.025em;line-height:1.25;padding:5px 9px;border-radius:999px;background:var(--acid);color:var(--black)}.idea-card h3{font-size:30px;line-height:1.05;margin:24px 0 18px;overflow-wrap:anywhere}.idea-card p{font-size:17px;line-height:1.3;color:rgba(8,8,8,.68);margin-bottom:22px}.idea-card button{margin-top:auto;align-self:flex-start;text-align:left;font-size:15px;min-height:40px}.idea-card:hover{border-color:var(--black)}.ideas-footnote{font-size:15px;line-height:1.4;color:rgba(8,8,8,.6);margin-top:28px}.product-source-update{margin:30px auto;padding:24px;max-width:1000px}.product-source-update li{margin:12px 0}.product-source-update a{text-decoration:underline}.gift-picture img,.dialog-picture img{object-fit:contain;object-position:center;image-rendering:auto}@media(max-width:1100px){.ideas-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar nav{gap:16px;font-size:14px}}@media(max-width:640px){.wishlist-ideas{padding:46px var(--gutter)}.ideas-grid{grid-template-columns:minmax(0,1fr)}.idea-card{padding:22px}.idea-card h3{font-size:31px}.ideas-intro{font-size:18px}.idea-card p{font-size:18px}}\n'''
(ROOT/'wishlist/ideas.css').write_text(css)
(ROOT/'wishlist/ideas.js').write_text("""'use strict';
(() => {let timer;document.querySelectorAll('[data-idea]').forEach(button=>button.addEventListener('click',async()=>{const idea=button.dataset.idea;if(!idea)return;const message='дора, увидела идею «'+idea+'» в твоём вишлисте\\nэто тебе сейчас пригодится? давай сначала выберем вместе';try{await navigator.clipboard.writeText(message);const toast=document.getElementById('toast');toast.textContent='текст скопирован — отправь доре в вашем чате';toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),4000);}catch(_){window.prompt('скопируй сообщение и отправь доре',message);}}));})();
""")
(ROOT/'wishlist/ideas.json').write_text(json.dumps({'status':'unconfirmed_suggestions','bookable':False,'ideas':[{'title':t,'description':d} for t,d in ideas]},ensure_ascii=False,indent=2)+'\n')
credits=ROOT/'wishlist/image-credits.html';content=credits.read_text();sources=json.loads((ROOT/'wishlist/product-image-sources.json').read_text())
if 'id="full-product-sources"' not in content:
 additions='<section class="product-source-update" id="full-product-sources"><h2>целые предметы / обновление 15 октября</h2><p>фотографии и изображения производителей используются как визуальные ориентиры для личного некоммерческого вишлиста<br>точные модели и комплектации согласуются до покупки<br>для услуг показаны условные предметы — инструмент не является подарком</p><ul>'
 for key,row in sources.items():additions+='<li>'+html.escape(key)+' — <a href="'+html.escape(row['page'],quote=True)+'" rel="noopener noreferrer">источник изображения</a></li>'
 additions+='</ul><p>изображение журналов — pngimg, личное некоммерческое использование, условия автора на странице источника<br>фон удалён или сохранён исходный альфа-канал, предметы не дорисовывались</p></section>'
 content=content.replace('</body>',additions+'</body>');credits.write_text(content)
readme=ROOT/'wishlist/README.md';rd=readme.read_text()
if '## дополнительные идеи' not in rd:rd+='\n## дополнительные идеи\n\n39 подтверждённых пожеланий по-прежнему используют прежние id и тот же сервис бронирования\n16 предложений вынесены отдельно в раздел «ещё идеи / сначала обсудим», не объявлены подтверждёнными и не бронируются\nличные задачи и покупки собственника квартиры не опубликованы\nизображения `*-full.png` используют целые предметы и исходные альфа-каналы или маски однотонного фона, без нейросетевого дорисовывания\nприватные брони и портрет не изменялись\n';readme.write_text(rd)
assert len(ideas)==16
print('39 existing wishes preserved; 16 separate unconfirmed creative ideas added')
