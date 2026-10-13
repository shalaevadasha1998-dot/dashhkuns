// dashhkuns crm reverse proxy.
// Keeps login and API calls on the same origin to avoid blocked cross-domain fetches in iOS and in-app browsers.
// No passwords, session tokens, or customer data are logged or cached.
export const maxDuration = 20;
const BASE="https://hiczdxqlmrzozdvnlqfl.supabase.co/functions/v1/crm-api";
const APIKEY="sb_publishable_nlajzfkH1tYEOAUZKcBvgg_5hbYJCM4";
const ALLOWED=new Set(["login","snapshot","create_task","update_task","delete_task","create_project","update_project","cancel_project","bulk_update_tasks","changes","create_lead","update_lead","delete_lead","update_message","queue_email","activities","add_activity","mark_alert_read","check_reminders"]);
function reply(res,status,data){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","private, no-store, max-age=0");
  res.setHeader("CDN-Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(status).json(data);
}
export default async function handler(req,res){
  if(req.method==="GET")return reply(res,200,{ok:true,service:"crm-connection-v6",status:"online",authenticated:false});
  if(req.method!=="POST")return reply(res,405,{error:"method_not_allowed"});
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return reply(res,403,{error:"wrong_origin"})}catch{return reply(res,403,{error:"wrong_origin"})}}
  const data=req.body;
  if(!data||typeof data!=="object"||Array.isArray(data))return reply(res,400,{error:"invalid_request"});
  const action=String(data.action||"");
  if(!ALLOWED.has(action))return reply(res,400,{error:"unknown_action"});
  const body=JSON.stringify(data);
  if(body.length>100000)return reply(res,413,{error:"request_too_large"});
  const authorization=String(req.headers.authorization||"");
  if(action!=="login"&&!/^Bearer [a-f0-9]{64}$/i.test(authorization))return reply(res,401,{error:"unauthorized"});
  const headers={"Content-Type":"application/json","apikey":APIKEY};
  if(action!=="login")headers.Authorization=authorization;
  try{
    const response=await fetch(BASE,{method:"POST",headers,body,cache:"no-store",signal:AbortSignal.timeout(14000)});
    const contentType=response.headers.get("content-type")||"";
    if(!contentType.includes("json"))return reply(res,502,{error:"crm_unexpected_response"});
    const result=await response.json();
    // Preserve the auth service's response status, but never cache it.
    return reply(res,response.status,result);
  }catch(error){
    console.error("crm-connection-v6",error?.name==="TimeoutError"?"timeout":"connection_error");
    return reply(res,502,{error:"crm_connection_failed"});
  }
}
