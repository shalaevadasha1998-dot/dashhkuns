const APPS_SCRIPT_URL = '__APPS_SCRIPT_URL__';
const ALLOWED_ORIGIN = 'https://dashhkuns.com';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN || origin === 'https://www.dashhkuns.com' ? origin : ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (APPS_SCRIPT_URL.includes('__APPS_SCRIPT_URL__')) {
      return Response.json({ ok: false, error: 'booking_api_not_configured' }, { status: 503, headers: cors });
    }

    const incoming = new URL(request.url);
    const target = new URL(APPS_SCRIPT_URL);

    if (request.method === 'GET') {
      target.search = incoming.search;
      const upstream = await fetch(target.toString(), { redirect: 'follow' });
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.text();
      const upstream = await fetch(target.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
        redirect: 'follow'
      });
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: cors });
  }
};
