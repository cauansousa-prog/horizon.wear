const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('frontend/js/store.js','utf8').split('function showToast')[0];
function setup(status){
 const saved=new Map([['hw-session',JSON.stringify({access_token:'expired',refresh_token:'refresh',expires_at:1})]]);
 const calls=[];
 const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,location:{origin:'https://example.test'},
  localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
  sessionStorage:{removeItem:()=>{}},fetch:async(path,options)=>{calls.push({path,options});return {ok:status===200,status,json:async()=>[]}}});
 vm.runInContext(source,context);
 return {saved,calls,run:code=>vm.runInContext(code,context)};
}
test('temporary refresh outage preserves session',async()=>{
 const c=setup(503);await assert.rejects(c.run("api('/api/cart')"),/renovar/);
 assert.ok(c.saved.has('hw-session'));assert.equal(c.calls.length,1);
});
test('invalid refresh clears session',async()=>{
 const c=setup(401);await assert.rejects(c.run("api('/api/cart')"),/expirou/);
 assert.equal(c.saved.has('hw-session'),false);
});
test('public catalogue bypasses expired session and sends no bearer',async()=>{
 const c=setup(200);await c.run("api('/api/products')");
 assert.equal(c.calls.length,1);assert.equal(c.calls[0].options.headers.Authorization,undefined);
});
