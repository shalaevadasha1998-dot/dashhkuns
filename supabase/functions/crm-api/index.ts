import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }
async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
const leadFields = new Set(["direction","company","contact","channel","sent_at","status","last_reply","next_action_at","priority","notes","deal_value","currency","source_url","metadata"]);
const projectFields = new Set(["parent_id","slug","name","category","status","priority","goal","next_action","deadline","owner","notes","color","sort_order","metadata"]);
const taskFields = new Set(["project_id","title","description","status","priority","due_at","owner","waiting_on","category","source","source_ref","metadata"]);
const messageFields = new Set(["status","actionable","project_id","lead_id"]);
const taskStatuses=new Set(["todo","doing","waiting","backlog","blocked","review","paused","done","cancelled"]);
const projectStatuses=new Set(["active","later","paused","done","cancelled"]);
function pick(input: Record<string, unknown>, allowed: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const [k,v] of Object.entries(input || {})) if (allowed.has(k)) out[k] = v;
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error:"method_not_allowed" },405);
  let body:any={};
  try { body = await req.json(); } catch { return json({ error:"invalid_json" },400); }

  const supabase=createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {auth:{persistSession:false,autoRefreshToken:false}}
  );

  if (body.action === "login") {
    const candidate=String(body.password||"");
    const [{data:setting,error:settingError}, candidateHash] = await Promise.all([
      supabase.from("crm_auth_settings").select("value").eq("key","password_hash").single(),
      sha256Hex(candidate)
    ]);
    if (settingError || !candidate || candidateHash !== setting?.value) {
      await new Promise(r=>setTimeout(r,350));
      return json({error:"invalid_password"},401);
    }
    const token=randomToken(), tokenHash=await sha256Hex(token);
    const expiresAt=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();
    const {error}=await supabase.from("crm_sessions").insert({token_hash:tokenHash,expires_at:expiresAt});
    if(error) return json({error:"session_error"},500);
    return json({token,expires_in:SESSION_SECONDS});
  }

  const raw=req.headers.get("authorization")||"";
  const token=raw.startsWith("Bearer ")?raw.slice(7):null;
  if (!token) return json({error:"unauthorized"},401);
  const tokenHash=await sha256Hex(token);
  const {data:session}=await supabase.from("crm_sessions").select("expires_at").eq("token_hash",tokenHash).single();
  if(!session || new Date(session.expires_at).getTime()<=Date.now()) return json({error:"unauthorized"},401);

  try {
    if (body.action === "snapshot") {
      const [projects,tasks,leads,messages,events,briefings,outbox,alerts,siteEvents,siteLeads,operatorActions,automationRuns,syncJobs] = await Promise.all([
        supabase.from("crm_projects").select("*").order("sort_order",{ascending:true}),
        supabase.from("crm_tasks").select("*").order("due_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}),
        supabase.from("crm_leads").select("*").order("next_action_at",{ascending:true,nullsFirst:false}).order("updated_at",{ascending:false}),
        supabase.from("crm_messages").select("*").order("received_at",{ascending:false}).limit(250),
        supabase.from("crm_events").select("*").order("starts_at",{ascending:false}).limit(250),
        supabase.from("crm_briefings").select("*").order("brief_date",{ascending:false}).limit(10),
        supabase.from("crm_outbox").select("*").order("created_at",{ascending:false}).limit(100),
        supabase.from("crm_alerts").select("*").order("created_at",{ascending:false}).limit(100),
        supabase.from("website_events").select("event_name,created_at,session_id").gte("created_at",new Date(Date.now()-7*86400000).toISOString()).order("created_at",{ascending:false}).limit(2500),
        supabase.from("website_leads").select("id",{count:"exact",head:true}),
        supabase.from("crm_operator_actions").select("id,source,action_type,status,subject,counterparty,summary,external_link,created_at").order("created_at",{ascending:false}).limit(100),
        supabase.from("crm_automation_runs").select("job,status,result,created_at").order("created_at",{ascending:false}).limit(30),
        supabase.from("sync_jobs").select("provider,status,updated_at").order("updated_at",{ascending:false}).limit(100)
      ]);
      for (const r of [projects,tasks,leads,messages,events,briefings,outbox,alerts,siteEvents,siteLeads,operatorActions,automationRuns,syncJobs]) if (r.error) throw r.error;
      const visitEvents=siteEvents.data||[];
      const views=visitEvents.filter(e=>e.event_name.startsWith("page_view_")||e.event_name==="case_view").length;
      const clickEvents=visitEvents.filter(e=>e.event_name==="calendly_click").length;
      const formSubmit=visitEvents.filter(e=>e.event_name==="form_submit_success").length;
      const stats={
        period_days:7, tracked_events:visitEvents.length,
        page_views:views, unique_sessions:new Set(visitEvents.map(e=>e.session_id).filter(Boolean)).size,
        contact_clicks:visitEvents.filter(e=>e.event_name==="cta_project_click").length,
        booking_clicks:clickEvents, form_submissions:formSubmit,
        leads_total:siteLeads.count||0,
        by_event:visitEvents.reduce((out,e)=>{out[e.event_name]=(out[e.event_name]||0)+1;return out},{} as Record<string,number>),
        last_event_at:visitEvents[0]?.created_at||null, max_records:2500
      };
      return json({projects:projects.data||[],tasks:tasks.data||[],leads:leads.data||[],messages:messages.data||[],events:events.data||[],briefings:briefings.data||[],outbox:outbox.data||[],alerts:alerts.data||[],website:stats,operator_actions:operatorActions.data||[],
        automation_health:{
          checked_at:new Date().toISOString(),
          reminder_runs:(automationRuns.data||[]).filter(x=>x.job==="reminders").slice(0,5),
          sync_failed:(syncJobs.data||[]).filter(x=>x.status==="failed").length,
          sync_recent:(syncJobs.data||[]).filter(x=>x.status==="completed").length,
          latest_operator_action:operatorActions.data?.[0]?.created_at||null,
          pending_operator_approvals:(operatorActions.data||[]).filter(x=>x.status==="pending_approval").length,
          gmail_mode:"chatgpt_automation_only",
          calendar_mode:"chatgpt_automation_only",
          ios_push_mode:"foreground_only",
          reminder_schedule_mode:"not_verified"
        }});
    }

    if (body.action === "check_reminders") {
      const {data,error}=await supabase.rpc("crm_generate_reminders");
      if(error)throw error;
      return json({ok:true,generated:data});
    }

    if (body.action === "mark_alert_read") {
      const id=String(body.id||"");
      if(!/^[0-9a-f-]{36}$/i.test(id)) return json({error:"invalid_alert_id"},400);
      const {error}=await supabase.from("crm_alerts").update({read_at:new Date().toISOString()}).eq("id",id);
      if(error)throw error;
      return json({ok:true});
    }

    if (body.action === "create_lead") {
      const payload=pick(body.lead||{},leadFields);
      if (!String(payload.company||"").trim()) return json({error:"company_required"},400);
      const {data,error}=await supabase.from("crm_leads").insert(payload).select("*").single(); if(error)throw error; return json({lead:data});
    }
    if (body.action === "update_lead") {
      const patch={...pick(body.patch||{},leadFields),updated_at:new Date().toISOString()};
      const {data,error}=await supabase.from("crm_leads").update(patch).eq("id",String(body.id||"")).select("*").single(); if(error)throw error; return json({lead:data});
    }
    if (body.action === "delete_lead") {
      const {error}=await supabase.from("crm_leads").delete().eq("id",String(body.id||"")); if(error)throw error; return json({ok:true});
    }

    if (body.action === "cancel_project") {
      const id=String(body.id||""); if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:"invalid_project_id"},400);
      const {data,error}=await supabase.rpc("crm_cancel_project",{p_project_id:id,p_reason:String(body.reason||"отменён"),p_cancel_tasks:body.cancel_tasks!==false});
      if(error)throw error;return json({ok:true,result:data});
    }
    if (body.action === "changes") {
      const type=String(body.entity_type||""),id=String(body.id||"");
      if(!["task","project"].includes(type)||!/^[a-f0-9-]{36}$/i.test(id))return json({error:"invalid_entity"},400);
      const {data,error}=await supabase.from("crm_change_log").select("id,operation,before_data,after_data,changed_at").eq("entity_type",type).eq("entity_id",id).order("changed_at",{ascending:false}).limit(25);
      if(error)throw error;return json({changes:data||[]});
    }
    if (body.action === "bulk_update_tasks") {
      const ids=Array.isArray(body.ids)?[...new Set(body.ids.filter((v:unknown)=>/^[a-f0-9-]{36}$/i.test(String(v))))]:[];
      const status=String(body.status||"");
      if(!ids.length||ids.length>150||!taskStatuses.has(status))return json({error:"invalid_bulk_update"},400);
      const {data,error}=await supabase.rpc("crm_update_tasks_bulk",{p_ids:ids,p_status:status,p_reason:String(body.reason||"").slice(0,500)});
      if(error)throw error;return json({ok:true,result:data});
    }
    if (body.action === "create_project") {
      const payload=pick(body.project||{},projectFields);
      if (!String(payload.name||"").trim()) return json({error:"name_required"},400);
      if(payload.status&&!projectStatuses.has(String(payload.status)))return json({error:"invalid_project_status"},400);
      if (!payload.slug) payload.slug=String(payload.name).toLowerCase().replace(/[^a-z0-9а-я]+/gi,"-").replace(/^-|-$/g,"")+"-"+Date.now();
      const {data,error}=await supabase.from("crm_projects").insert(payload).select("*").single(); if(error)throw error; return json({project:data});
    }
    if (body.action === "update_project") {
      const patch={...pick(body.patch||{},projectFields),updated_at:new Date().toISOString()};
      if(patch.status&&!projectStatuses.has(String(patch.status)))return json({error:"invalid_project_status"},400);
      if(patch.status==="cancelled")return json({error:"use_cancel_project"},400);
      const {data,error}=await supabase.from("crm_projects").update(patch).eq("id",String(body.id||"")).select("*").single(); if(error)throw error; return json({project:data});
    }

    if (body.action === "create_task") {
      const payload=pick(body.task||{},taskFields);
      if (!String(payload.title||"").trim()) return json({error:"title_required"},400);
      if(payload.status&&!taskStatuses.has(String(payload.status)))return json({error:"invalid_task_status"},400);
      const {data,error}=await supabase.from("crm_tasks").insert(payload).select("*").single(); if(error)throw error; return json({task:data});
    }
    if (body.action === "update_task") {
      const patch:any={...pick(body.patch||{},taskFields),updated_at:new Date().toISOString()};
      if(patch.status&&!taskStatuses.has(String(patch.status)))return json({error:"invalid_task_status"},400);
      if(patch.status==="cancelled"){
        const {data:old,error}=await supabase.from("crm_tasks").select("status,metadata").eq("id",String(body.id||"")).single();
        if(error)throw error;
        if(old.status!=="cancelled")patch.metadata={...(old.metadata||{}),cancellation:{reason:String(body.reason||"отменена вручную").slice(0,500),at:new Date().toISOString(),previous_status:old.status}};
      }
      if (patch.status==="done") patch.completed_at=new Date().toISOString();
      else if ("status" in patch) patch.completed_at=null;
      const {data,error}=await supabase.from("crm_tasks").update(patch).eq("id",String(body.id||"")).select("*").single(); if(error)throw error; return json({task:data});
    }
    if (body.action === "delete_task") {
      const {error}=await supabase.from("crm_tasks").delete().eq("id",String(body.id||"")); if(error)throw error; return json({ok:true});
    }

    if (body.action === "update_message") {
      const patch=pick(body.patch||{},messageFields);
      const {data,error}=await supabase.from("crm_messages").update(patch).eq("id",String(body.id||"")).select("*").single(); if(error)throw error; return json({message:data});
    }

    if (body.action === "queue_email") {
      const sourceId=String(body.source_message_id||"");
      const recipient=String(body.recipient||"").trim();
      const subject=String(body.subject||"").trim();
      const text=String(body.body||"").trim();
      if(!recipient||!text)return json({error:"recipient_and_body_required"},400);
      let source:any=null;
      if(sourceId){
        const r=await supabase.from("crm_messages").select("external_id,thread_id").eq("id",sourceId).single();
        source=r.data;
      }
      const {data,error}=await supabase.from("crm_outbox").insert({
        source_message_id:sourceId||null,
        reply_to_external_id:source?.external_id||null,
        thread_id:source?.thread_id||null,
        recipient,
        subject,
        body:text,
        status:"queued"
      }).select("*").single();
      if(error)throw error;
      return json({outbox:data});
    }

    if (body.action === "activities") {
      const {data,error}=await supabase.from("crm_activities").select("*").eq("lead_id",String(body.id||"")).order("happened_at",{ascending:false}); if(error)throw error; return json({activities:data||[]});
    }
    if (body.action === "add_activity") {
      const id=String(body.id||""), text=String(body.body||"").trim();
      if(!id||!text)return json({error:"id_and_body_required"},400);
      const {data,error}=await supabase.from("crm_activities").insert({lead_id:id,activity_type:String(body.activity_type||"note"),body:text}).select("*").single(); if(error)throw error;
      await supabase.from("crm_leads").update({updated_at:new Date().toISOString()}).eq("id",id);
      return json({activity:data});
    }

    return json({error:"unknown_action"},400);
  } catch(error) {
    console.error(error);
    return json({error:"server_error",detail:String((error as any)?.message||error)},500);
  }
});