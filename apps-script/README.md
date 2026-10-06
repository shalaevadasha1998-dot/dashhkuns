# custom booking backend

сайт использует свою форму бронирования. calendly в новой версии интерфейса не участвует.

цепочка:
dashhkuns.com → supabase edge function `website-booking` → google apps script → google calendar / google meet.

## первичная настройка
1. открыть https://script.google.com/home
2. создать проект `dashhkuns booking`
3. заменить `Code.gs` содержимым из этой папки
4. project settings → включить показ `appsscript.json`
5. заменить `appsscript.json` содержимым из этой папки
6. deploy → new deployment → web app
7. execute as: me
8. who has access: anyone
9. разрешить доступ к calendar и отправке email

## после изменений кода
manage deployments → edit → version: new version → deploy.

supabase proxy уже хранит актуальный web app url. клиент не видит google apps script url.
