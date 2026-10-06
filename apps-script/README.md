# custom booking backend

эта папка нужна один раз, чтобы сайт мог читать свободное время из google calendar и создавать google meet без calendly.

## apps script
1. открыть https://script.google.com/home
2. новый проект → название `dashhkuns booking`
3. заменить Code.gs содержимым из `apps-script/Code.gs`
4. project settings → show "appsscript.json" manifest file in editor → заменить манифест содержимым `apps-script/appsscript.json`
5. deploy → new deployment → web app
6. execute as: me
7. who has access: anyone
8. authorize google calendar + send email
9. скопировать url вида `https://script.google.com/macros/s/.../exec`

после этого url вставляется в cloudflare worker, а сайт обращается только к `/api/booking`.
