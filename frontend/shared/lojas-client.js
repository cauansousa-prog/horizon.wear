/* Cliente compartilhado: somente a API FastAPI recebe as credenciais do banco. */
window.HorizonHub=(()=>{
 const sessionKey='hw-session';
 function session(){try{return JSON.parse(localStorage.getItem(sessionKey)||'null');}catch{return null;}}
 let refreshing=null;
 async function request(path,options={},authenticated=false){
  let current=session();
  if(authenticated&&!current?.access_token)throw Error('Entre na sua conta para continuar.');
  if(authenticated&&current.refresh_token&&(current.expires_at||0)*1000<Date.now()+30000){
   if(!refreshing)refreshing=fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:current.refresh_token})}).then(async r=>{if(!r.ok)throw Error('Entre novamente na sua conta.');const data=await r.json();localStorage.setItem(sessionKey,JSON.stringify(data));}).finally(()=>refreshing=null);
   await refreshing;current=session();
  }
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+current.access_token}:{}),...options.headers}});
  let data;try{data=await response.json();}catch{throw Error('O servidor não respondeu. Tente novamente.');}
  if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Não foi possível concluir. Confira os dados.');
  return data;
 }
 async function authenticate(action,body){const data=await request('/api/auth/'+action,{method:'POST',body:JSON.stringify(body)});if(!data.access_token)throw Error('Não foi possível iniciar sua sessão.');localStorage.setItem(sessionKey,JSON.stringify(data));return data.user;}
 function store(slug){
  if(!['academia','construcao'].includes(slug))throw Error('Loja não cadastrada na central.');
  const base='/api/lojas/'+slug,key='hub-cart-'+slug,historyKey='hub-demo-orders-'+slug;
  function cart(){try{const items=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(items)?items:[];}catch{return [];}}
  return Object.freeze({slug,products:()=>request(base+'/products'),
   orders:()=>request(base+'/orders',{},true),adminProducts:()=>request(base+'/admin/products',{},true),
   saveProduct:(product,id)=>request(base+'/admin/products'+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:JSON.stringify(product)},true),
   cart,quote:items=>request(base+'/quote',{method:'POST',body:JSON.stringify({items:items||cart()})}),
   async addToCart(product_id,quantity=1){if(!Number.isInteger(quantity)||quantity<1)throw Error('Quantidade inválida.');const items=cart(),existing=items.find(i=>i.product_id===product_id);if(existing)existing.quantity+=quantity;else items.push({product_id,quantity});await request(base+'/quote',{method:'POST',body:JSON.stringify({items})});localStorage.setItem(key,JSON.stringify(items));return items;},
   removeFromCart:id=>localStorage.setItem(key,JSON.stringify(cart().filter(i=>i.product_id!==id))),
   clearCart:()=>localStorage.removeItem(key),
   async simulate(method='pix'){
    const items=cart(),attemptKey='hub-attempt-'+slug,fingerprint=JSON.stringify({items,method});let attempt;
    try{attempt=JSON.parse(sessionStorage.getItem(attemptKey)||'null');}catch{}
    if(!attempt||attempt.fingerprint!==fingerprint){attempt={fingerprint,key:crypto.randomUUID()};sessionStorage.setItem(attemptKey,JSON.stringify(attempt));}
    const result=await request(base+'/checkout/simulate',{method:'POST',headers:{'Idempotency-Key':attempt.key},body:JSON.stringify({items,method})});
    let history;try{history=JSON.parse(localStorage.getItem(historyKey)||'[]');}catch{history=[];}if(!Array.isArray(history))history=[];
    localStorage.setItem(historyKey,JSON.stringify([{...result,created_at:new Date().toISOString()},...history.filter(o=>o.order_id!==result.order_id)].slice(0,20)));
    localStorage.removeItem(key);sessionStorage.removeItem(attemptKey);return result;
   }
  });
 }
 return Object.freeze({store,session,login:(email,password)=>authenticate('login',{email,password}),
  signup:(nome_completo,email,password)=>authenticate('signup',{nome_completo,email,password}),
  profile:()=>request('/api/users/me',{},true),saveProfile:body=>request('/api/users/me',{method:'PATCH',body:JSON.stringify(body)},true),
  async logout(){try{await request('/api/auth/logout',{method:'POST'},true);}finally{localStorage.removeItem(sessionKey);}}
 });
})();
