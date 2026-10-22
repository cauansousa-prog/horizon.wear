(async()=>{
'use strict';
const $=s=>document.querySelector(s), db=window.AurelDB, client=db.client;
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s||'').replace(/\D/g,'');
function validCPF(value){const n=digits(value);if(n.length!==11||/^([0-9])\1{10}$/.test(n))return false;for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(n[i])*(t+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(n[t]))return false;}return true;}
function orderCode(){const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');return 'AG-'+date+'-'+Math.random().toString(36).slice(2,8).toUpperCase();}
let user=null,cart=[],products=[];
try{
 await db.ready;
 cart=JSON.parse(localStorage.getItem('aurel-cart-photo-v1')||'[]');
 products=await db.catalogue([]);
 const available=new Map(products.map(p=>[p.id,p]));
 cart=cart.filter(x=>x&&available.has(Number(x.id))&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=20&&available.get(Number(x.id)).sizes.includes(x.size)&&available.get(Number(x.id)).colors.includes(x.color));
 cart=cart.map(x=>({...x,id:Number(x.id)}));
 const auth=await db.request(); user=auth.user;
 if(user){$('#checkoutForm').elements.name.value=user.name||'';$('#checkoutForm').elements.email.value=user.email||'';}
}catch(e){$('#checkoutMessage').textContent='Não foi possível carregar o catálogo agora. Atualize a página.';$('#checkoutMessage').classList.add('is-error');}
function drawSummary(){
 if(!cart.length){$('#checkoutItems').innerHTML='<p>Sua sacola está vazia. <a href="pesquisa.html">Escolha uma peça</a> antes de continuar.</p>';$('#checkoutTotal').textContent='';$('#checkoutForm').querySelector('[type=submit]').disabled=true;return;}
 $('#checkoutItems').innerHTML=cart.map(x=>{const p=products.find(p=>p.id===x.id);return '<div class="summary-item"><span>'+esc(p.name)+'<small>'+esc(x.color)+' · Tam. '+esc(x.size)+' · '+x.qty+' un.</small></span><strong>'+money(p.price*x.qty)+'</strong></div>';}).join('');
 $('#checkoutTotal').innerHTML='<span>Total do pedido</span><strong>'+money(cart.reduce((t,x)=>t+products.find(p=>p.id===x.id).price*x.qty,0))+'</strong>';
}
drawSummary();
$('#checkoutForm').elements.cpf.addEventListener('input',e=>{const n=digits(e.target.value).slice(0,11);e.target.value=n.length>9?n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6,9)+'-'+n.slice(9):n.length>6?n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6):n.length>3?n.slice(0,3)+'.'+n.slice(3):n;});
$('#checkoutForm').elements.cep.addEventListener('input',e=>{const n=digits(e.target.value).slice(0,8);e.target.value=n.length>5?n.slice(0,5)+'-'+n.slice(5):n;});
$('#checkoutForm').elements.state.addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,2));
$('#checkoutForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget.elements,msg=$('#checkoutMessage');msg.textContent='';msg.classList.remove('is-error');
 if(!cart.length){msg.textContent='Adicione ao menos um produto antes de finalizar.';msg.classList.add('is-error');return;}
 if(!validCPF(f.cpf.value)){msg.textContent='Confira o CPF informado.';msg.classList.add('is-error');f.cpf.focus();return;}
 const cep=digits(f.cep.value);if(cep.length!==8){msg.textContent='Informe um CEP válido com 8 dígitos.';msg.classList.add('is-error');f.cep.focus();return;}
 const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;button.textContent='Registrando pedido…';
 try{
  const payload={order_number:orderCode(),customer_name:f.name.value.trim(),customer_email:f.email.value.trim().toLowerCase(),cpf_last4:digits(f.cpf.value).slice(-4),cep,address_line:f.address.value.trim(),address_number:f.number.value.trim(),complement:f.complement.value.trim(),neighborhood:f.neighborhood.value.trim(),city:f.city.value.trim(),state:f.state.value.trim().toUpperCase(),payment_method:f.payment.value,items:cart.map(x=>({id:x.id,qty:x.qty,size:x.size,color:x.color}))};
  const {error}=await client.from('aurel_orders').insert(payload);if(error)throw error;
  if(user)await client.from('cart_items').delete().eq('user_id',user.id);
  localStorage.setItem('aurel-cart-photo-v1','[]');
  window.location.replace('index.html');
 }catch(error){msg.textContent=error.message?.includes('fetch')?'Falha de conexão ao registrar o pedido. Confira sua internet e tente novamente.':'Não foi possível registrar este pedido. Verifique se os produtos ainda estão disponíveis e tente novamente.';msg.classList.add('is-error');button.disabled=false;button.textContent='Finalizar pedido';}
});
})();