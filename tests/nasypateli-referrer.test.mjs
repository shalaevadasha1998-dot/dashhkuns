import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import handler from '../api/nasypateli-live.js';

test('form pages preserve same-origin Origin without admitting null origins',async()=>{
  const keys=['NASYPATELI_LIVE_PASSWORD','NASYPATELI_LIVE_SESSION_SECRET'];
  const before=keys.map(k=>process.env[k]);
  for(const key of keys)process.env[key]=randomBytes(48).toString('base64url');
  function check(method,origin){
    const r={headers:{},statusCode:0,body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.statusCode=n;return this;},send(s){this.body=s;},end(){}};
    handler({method,headers:{host:'example.test',origin},body:{action:'login',password:'wrong'}},r);return r;
  }
  try{
    const page=await readFile(new URL('../nasypateli-login.html',import.meta.url),'utf8');
    assert.match(page,/<meta name="referrer" content="same-origin">/);
    assert.equal(check('GET').headers['referrer-policy'],'same-origin');
    assert.equal(check('POST','https://example.test').statusCode,200);
    assert.equal(check('POST','null').statusCode,403);
    assert.equal(check('POST','https://attacker.example').statusCode,403);
  }finally{keys.forEach((key,i)=>{if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];});}
});
