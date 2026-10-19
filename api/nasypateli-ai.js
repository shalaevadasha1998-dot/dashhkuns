// Same-origin relay to the already deployed nasypateli-ai Worker.
// The Worker performs the authoritative session validation against the live app.
export const maxDuration=60;
export const config={api:{bodyParser:{sizeLimit:'2mb'}}};
const BASE='https://nasypateli-ai.shalaevadasha1998.workers.dev';
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method'});}
  const host=String(req.headers.host||'');
  const origin=String(req.headers.origin||'');
  const site=String(req.headers['sec-fetch-site']||'');
  if(site==='cross-site')return res.status(403).json({error:'origin'});
  if(origin){
    try{
      const source=new URL(origin);
      if(source.protocol!=='https:'||source.host!==host)return res.status(403).json({error:'origin'});
    }catch{return res.status(403).json({error:'origin'});}
  }
  const cookie=String(req.headers.cookie||'');
  if(!cookie.includes('nasypateli_live_session=')||cookie.length>8192)
    return res.status(401).json({error:'session_expired'});
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input))
    return res.status(400).json({error:'invalid_body'});
  const route=req.query?.route==='transcribe'?'transcribe':'reply';
  let body;
  try{body=JSON.stringify(input);}catch{return res.status(400).json({error:'invalid_body'});}
  if(body.length>1250000)return res.status(413).json({error:'too_large'});
  const base=process.env.NASYPATELI_AI_URL||BASE;
  if(!/^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(base))
    return res.status(503).json({error:'service_unavailable'});
  try{
    const response=await fetch(base.replace(/\/$/,'')+'/'+route,{
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(60000),
      headers:{'content-type':'application/json','origin':'https://dashhkuns.com','cookie':cookie},
      body
    });
    if(response.status>=300&&response.status<400)return res.status(502).json({error:'upstream_redirect'});
    const raw=await response.text();
    if(raw.length>450000)return res.status(502).json({error:'upstream_response'});
    let data;try{data=JSON.parse(raw);}catch{return res.status(502).json({error:'upstream_response'});}
    if(data===null||typeof data!=='object')return res.status(502).json({error:'upstream_response'});
    return res.status(response.status).json(data);
  }catch{return res.status(503).json({error:'service_unavailable'});}
}
