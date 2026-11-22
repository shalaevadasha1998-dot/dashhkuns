# CRM source inventory and Telegram/EBI boundary (22 November 2026)

## What this branch contains

The `crm-os-v2-20261011` branch serves the **personal dashhkuns CRM UI**, including `crm.html`, `crm.js`, and `crm/`. The root `crm.js` calls:

```text
POST https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/crm-api
```

The source for **the active Supabase function `crm-api`, version 9**, has been preserved verbatim in `./index.ts` and `deno.json` from the authorized Supabase project `dashhkuns os` (ref `hiczdxqlmrzozdvnlqfl`). Function code uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through server environment variables. Do not copy real secret values into this repository.

This is a **code snapshot only**. Creating the GitHub branch or PR does not deploy, replace, restart, or alter the Supabase Edge Function. The actual release version must be compared with Supabase before any future deployment; v9 was read on 22 November 2026.

## Do not confuse two different CRM backends

**Personal dashhkuns CRM** (this repository): Supabase `crm-api`, with tables `crm_leads`, `crm_messages`, `crm_outbox`, `crm_sessions`, etc., used for the producer's personal pipeline.

**EBI Marketing CRM** (separate production service): `https://ebi-agency-crm.fit-ox-3185.chatgpt.site`. Its connected Telegram bot `@ebi_agency_leads_bot` already receives and replies to Telegram Business messages. The verified status from the existing EBI connector (21 November 2026) was: one Business incoming, one Business sent reply, `canReply=true`, webhook matches and no pending/errored updates. These aggregate observations do not expose individual chat IDs or message contents.

**Existing sales registry:** [EBI Sales OS](https://docs.google.com/spreadsheets/d/1EDLBy0nTNPvvev87v3VbsmHmfDi2BPFlMo02zgyWl7w/edit), which is not the personal Supabase CRM.

**Telegram Secretary/outbox implementation draft:** [dora_os PR #186](https://github.com/shalaevadasha1998-dot/dora_os/pull/186), with bounded approved reply dispatch and a privacy-minimized Sheets projection. Its code is not deployed to the EBI ChatGPT Sites backend.

## Safe integration contract

1. The **existing EBI backend** must expose authenticated, least-privilege operations to list qualified Telegram Business conversations and request an approved reply, with provider IDs and durable readback. The current EBI ChatGPT connector only exposes aggregate Telegram status. Do not invent chat IDs, fake sent receipts, or export private chats from a different CRM.
2. Keep the EBI Sales OS as the **only EBI sales register**. Link the same contact/campaign across email and Telegram, de-duplicate by stable hashed conversation key, exclude opt-outs and exhausted one-time consent. Do not bulk copy records into `crm_leads` of the personal producer CRM.
3. Telegram Business replies require an enabled connection, `can_reply`, current replyable inbound dialog (including the platform's 24-hour limit), approved exact text, and an idempotent send journal. A timeout is `unknown` and must not be retried blindly. Bots cannot start arbitrary chats with users who have not contacted them.
4. For the Google Sheets projection, use a **server-authorized Google Sheets adapter** and a server-only HMAC key, no chat text or credentials in Sheets. Keep external Telegram `message_id` as the authoritative evidence of acceptance, not delivery or reading.
5. Do not change the current Telegram webhook, introduce MTProto userbot workarounds, deploy personal CRM code over EBI, or resend the legacy EBI campaigns. No automatic cold DMs.

## Deployment status

- Live personal Supabase `crm-api`: ACTIVE (version 9), unchanged by this GitHub PR.
- Live EBI Telegram Business: connected, one verified reply (as of 21 November).
- Sending new Telegram messages from EBI Sales OS: **not deployed**, blocked by missing EBI backend chat/send adapter and server-side Sheets authorization.
- This source snapshot: ready for code review. It is **not** proof of EBI integration or live delivery.
