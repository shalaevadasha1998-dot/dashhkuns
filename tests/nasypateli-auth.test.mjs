import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import handler from '../api/nasypateli-live.js';
const keys=['NASYPATELI_LIVE_PASSWORD','NASYPATELI_LIVE_SESSION_SECRET'];
const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const fake=Object.fromEntries(keys.map(k=>[k,randomBytes(48).toString('base64url')]));
test.beforeEach(()=>Object.assign(process.env,fake));
test.after(()=>{for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}});
function request(method='GET',{cookie='',password='',origin='https://dashhkuns.com',action='login'}={}){
  return {method,headers:{host:'dashhkuns.com',origin,cookie},body:method==='POST'?{action,password}:undefined};
}
function serve(method='GET',options={}){
  const res={code:200,body:'',headers:{},
    setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;},
    status(code){this.code=code;return this;},
    send(body){this.body=body;return this;},
    end(body=''){this.body=body;return this;}
  };
  handler(request(method,options),res);return res;
}
test('missing secrets fail closed',()=>{
  for(const key of keys)delete process.env[key];
  const res=serve();assert.equal(res.code,503);
  assert.doesNotMatch(res.body,/id="character"/);
  assert.match(res.headers['cache-control'],/no-store/);
});
test('anonymous browser gets only a noindex login page',()=>{
  const res=serve();assert.equal(res.code,200);
  assert.match(res.body,/вход по паролю/);
  assert.doesNotMatch(res.body,/id="character"/);
  assert.match(res.headers['content-security-policy'],/script-src 'nonce-/);
  assert.match(res.headers['x-robots-tag'],/noindex/);
  assert.equal(res.headers['x-frame-options'],'DENY');
  assert.match(res.headers['cache-control'],/no-store/);
});
test('synthetic login creates an authenticated session; tampering is rejected',()=>{
  const wrong=serve('POST',{password:'deliberately-incorrect'});
  assert.equal(wrong.code,200);assert.match(wrong.body,/неверный пароль/);
  assert.ok(!wrong.headers['set-cookie']);assert.doesNotMatch(wrong.body,/id="character"/);
  const ok=serve('POST',{password:fake.NASYPATELI_LIVE_PASSWORD});
  assert.equal(ok.code,303);assert.equal(ok.headers.location,'/nasypateli-live/app');
  const session=ok.headers['set-cookie'];
  assert.match(session,/HttpOnly/);assert.match(session,/Secure/);
  assert.match(session,/SameSite=Strict/);assert.match(session,/Path=\/nasypateli-live/);
  assert.ok(!session.includes(fake.NASYPATELI_LIVE_PASSWORD));
  const cookie=session.split(';')[0];
  const authenticated=serve('GET',{cookie});
  assert.equal(authenticated.code,200);assert.match(authenticated.body,/id="character"/);
  assert.match(authenticated.body,/BroadcastChannel/);
  assert.match(authenticated.body,/type="module" nonce="/);
  for(const key of keys)assert.ok(!authenticated.body.includes(fake[key]));
  const last=cookie.at(-1);const tampered=cookie.slice(0,-1)+(last==='A'?'B':'A');
  const rejected=serve('GET',{cookie:tampered});
  assert.equal(rejected.code,200);assert.doesNotMatch(rejected.body,/id="character"/);
  const logout=serve('POST',{cookie,action:'logout'});
  assert.equal(logout.code,303);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
});
test('cross-origin requests and unsupported methods are rejected',()=>{
  const res=serve('POST',{password:fake.NASYPATELI_LIVE_PASSWORD,origin:'https://invalid.example'});
  assert.equal(res.code,403);assert.ok(!res.headers['set-cookie']);
  assert.equal(serve('PUT').code,405);assert.equal(serve('HEAD').code,200);
});
test('static entry and protected function are separate routes',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.rewrites.find(r=>r.source==='/nasypateli-live')?.destination,'/nasypateli-login.html');
  assert.equal(config.rewrites.find(r=>r.source==='/nasypateli-live/app')?.destination,'/api/nasypateli-live');
  const page=await readFile(new URL('../nasypateli-login.html',import.meta.url),'utf8');
  assert.match(page,/form method="post" action="\/nasypateli-live\/app"/);
  assert.doesNotMatch(page,/id="character"|NASYPATELI_LIVE_PASSWORD/);
  const headers=config.headers.find(h=>h.source==='/nasypateli-live')?.headers||[];
  assert.match(headers.find(h=>h.key==='X-Robots-Tag')?.value||'',/noindex/);
});
