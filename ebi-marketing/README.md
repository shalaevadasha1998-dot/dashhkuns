# EBI Marketing — независимый исходник сайта

Оригинальный сайт: https://ebi.dashhkuns.com
Проект миграции: GitHub `shalaevadasha1998-dot/dashhkuns`, ветка `ebi-production`, директория `ebi-marketing/`.

Исходники восстановлены из публичной опубликованной версии ChatGPT Sites 21.11.2026: 13 HTML-страниц, CSS/JS, изображения, шрифты, robots.txt, sitemap.xml и публичный файл проверки владения доменом. Изменения в дизайне минимальны: корректировка высоты мобильных ссылок в assets/styles.css.

Развёртывание: отдельный Cloudflare Pages project; build command — пустой, project root — `ebi-marketing`, output — текущая директория. Домен переводить только после проверки всех URL и ассетов на Pages. DNS для CRM и почты не менять.

Публикация: меняй только файлы в этой директории, фиксируй изменения в GitHub и проверяй Pages preview. Скрипт `scripts/check_site.py` проверяет SEO и целостность. Не вставляй секреты в HTML/JS. Форма заявки остаётся на https://dashhkuns.com/contact и зависит от Supabase Edge Function (отдельная интеграция).

Если есть расходящиеся версии: GitHub — источник истины для обновлённого EBI; старый ChatGPT Sites после переключения домена не редактировать.

Проверка использования: миграция не создаёт новый рекламный бюджет и не обещает SEO-позиций. Cloudflare Free имеет лимиты; контролируй использование, не включай платные продукты без разрешения.

Тестовый и будущий независимый хостинг: https://ebi-marketing.pages.dev (Cloudflare Pages project `ebi-marketing`).
