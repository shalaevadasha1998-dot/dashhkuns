# dashhkuns

персональный коммерческий сайт креативного продюсера.

production: https://dashhkuns.com/

## коммерческая воронка

- основной cta: `/contact#project-form`
- заявки уходят напрямую в supabase edge function `website-intake`
- лиды сохраняются в `public.website_leads`
- события аналитики сохраняются в `public.website_events`
- реферальные партнёры и ставки хранятся в `public.website_referrals`
- `ref` и utm сохраняются на 90 дней и прикладываются к заявке
- основная конверсия: `form_submit_success`

## реферальные ссылки

формат:

`https://dashhkuns.com/?ref=partner_code`

код источника сохраняется при первом заходе и прикладывается к заявке.

процент не считается от производственного бюджета. реферальная база определяется вручную от фактически полученного гонорара продюсера.

## уведомления о заявках

сама заявка всегда сначала сохраняется в базе. email-уведомление из edge function включается, когда в supabase secrets настроены:

- `RESEND_API_KEY`
- `LEAD_NOTIFICATION_EMAIL`
- `RESEND_FROM_EMAIL` — опционально

значения секретов в репозитории не хранятся.

## seo

production использует clean urls:

- `/`
- `/services`
- `/projects`
- `/about`
- `/contact`

также есть `robots.txt`, `sitemap.xml`, canonical, open graph и отдельная social preview картинка `assets/og-card.png`.

## публичные ссылки

- [креативный продюсер в москве](https://dashhkuns.com/)
- [продюсирование проектов под ключ](https://dashhkuns.com/services)
- [кейсы и запуски](https://dashhkuns.com/projects)
- [разбор: что делает креативный продюсер](https://dashhkuns.com/creative-producer)

