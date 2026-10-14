import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import handler from "../api/nasypateli-live.js";

function fakeResponse(){
  return {
    code:200,body:"",headers:{},
    setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},
    status(c){this.code=c;return this},
    send(v){this.body=v;return this},
    end(v=""){this.body=v;return this}
  };
}
function request(method="GET",{cookie="",password="",origin="https://dashhkuns.com",action="login"}={}){
  return {method,headers:{host:"dashhkuns.com",origin,cookie},
    body:method==="POST"?{action,password}:undefined};
}
function serve(method,options){
  const res=fakeResponse();
  handler(request(method,options),res);
  return res;
}
const env={
  NASYPATELI_LIVE_PASSWORD:randomBytes(24).toString("base64url"),
  NASYPATELI_LIVE_SESSION_SECRET:randomBytes(48).toString("base64url")
};
const prev={NASYPATELI_LIVE_PASSWORD:process.env.NASYPATELI_LIVE_PASSWORD,
NASYPATELI_LIVE_SESSION_SECRET:process.env.NASYPATELI_LIVE_SESSION_SECRET};
test.after(()=>{
  for(const key of Object.keys(prev)){
    if(prev[key]===undefined) delete process.env[key];
    else process.env[key]=prev[key];
  }
});

test("missing secrets fail closed even for HTTP GET",()=>{
  delete process.env.NASYPATELI_LIVE_PASSWORD;
  delete process.env.NASYPATELI_LIVE_SESSION_SECRET;
  const res=serve("GET");
  assert.equal(res.code,503);
  assert.match(res.body,/пароль не настроен/);
  assert.match(res.headers["x-robots-tag"],/noindex/);
  assert.match(res.headers["cache-control"],/no-store/);
});

test("unauthenticated GET cannot access stage or dashboard, emits secure noindex page",()=>{
  Object.assign(process.env,env);
  const res=serve("GET");
  assert.equal(res.code,200);
  assert.match(res.body,/вход по паролю/);
  assert.doesNotMatch(res.body,/id="character"/);
  assert.match(res.headers["content-security-policy"],/script-src 'nonce-/);
  assert.match(res.headers["x-robots-tag"],/noindex/);
  assert.equal(res.headers["x-frame-options"],"DENY");
  assert.match(res.headers["cache-control"],/no-store/);
});

test("login uses timing-safe password verification and secure signed cookie",()=>{
  const wrong=serve("POST",{password:"wrong"});
  assert.equal(wrong.code,200);
  assert.match(wrong.body,/неверный пароль/);
  assert.ok(!wrong.headers["set-cookie"]);

  const ok=serve("POST",{password:env.NASYPATELI_LIVE_PASSWORD});
  assert.equal(ok.code,303);
  assert.equal(ok.headers.location,"/nasypateli-live");
  const session=ok.headers["set-cookie"];
  assert.match(session,/HttpOnly/);
  assert.match(session,/Secure/);
  assert.match(session,/SameSite=Strict/);
  assert.match(session,/Path=\/nasypateli-live/);
  assert.doesNotMatch(session,/fbR7HYSt2Gz5JYGUpYxEXp/);
  const rawCookie=session.split(";")[0];

  const allowed=serve("GET",{cookie:rawCookie});
  assert.equal(allowed.code,200);
  assert.match(allowed.body,/id="character"/);
  assert.match(allowed.body,/дашкунс live/);
  assert.match(allowed.body,/BroadcastChannel/);
  assert.match(allowed.body,/type="module" nonce="/);
  assert.doesNotMatch(allowed.body,/NASYPATELI_LIVE_SESSION_SECRET|EO-CEx1sZ3ADm1pn9BBjaK5baGnJWcSQm7v-EA_oX4UFQjwvKpkYff5ujoAd6d0C/);
  const parts=rawCookie.split("=");
  const chars=parts[1].split("");
  chars[chars.length-1]=chars[chars.length-1]==="A"?"B":"A";
  assert.equal(serve("GET",{cookie:parts[0]+"="+chars.join("")}).code,200);
  assert.doesNotMatch(serve("GET",{cookie:parts[0]+"="+chars.join("")}).body,/id="character"/);

  const out=serve("POST",{cookie:rawCookie,action:"logout"});
  assert.equal(out.code,303);
  assert.match(out.headers["set-cookie"],/Max-Age=0/);
});

test("blocked cross-site POST and unsupported methods",()=>{
  const bad=serve("POST",{password:env.NASYPATELI_LIVE_PASSWORD,origin:"https://attacker.example"});
  assert.equal(bad.code,403);
  assert.equal(bad.headers["set-cookie"],undefined);
  assert.equal(serve("PUT").code,405);
  assert.equal(serve("HEAD").code,200);
});

test("vercel config maps private URL only to password-guarded function",async()=>{
  const fs=await import("node:fs/promises");
  const root=new URL("../vercel.json",import.meta.url);
  const v=JSON.parse(await fs.readFile(root,"utf8"));
  const route=v.rewrites.find(x=>x.source==="/nasypateli-live");
  assert.equal(route?.destination,"/api/nasypateli-live");
  assert.ok(!v.redirects?.some(x=>x.source==="/nasypateli-live"&&x.destination!=="/api/nasypateli-live"));
});
