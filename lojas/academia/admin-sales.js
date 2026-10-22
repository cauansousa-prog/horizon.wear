(()=>{'use strict';
const $=s=>document.querySelector(s), client=window.AurelDB.client;
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let orders=[];
function clear(){orders=[];$('#orderRows').replaceChildren();$('#salesOrderCount').textContent='0';$('#salesTotal').textContent=money(0);$('#ordersEmpty').hidden=false;drawDays([]);drawProducts([]);drawRevenue([]);}
function canvasBase(canvas){const ctx=canvas.getContext('2d'),ratio=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=250;canvas.width=w*ratio;canvas.height=h*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);return{ctx,w,h};}
function drawDays(data){
 const {ctx,w,h}=canvasBase($('#salesByDay')),pad={l:44,r:12,t:15,b:34},today=new Date();today.setHours(0,0,0,0);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()-6+i);const key=d.toISOString().slice(0,10);return{key,label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),value:data.filter(o=>o.created_at.slice(0,10)===key).reduce((s,o)=>s+Number(o.total),0)};});
 const max=Math.max(10,...days.map(x=>x.value)),cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
 ctx.font='11px Arial';ctx.strokeStyle='#393939';ctx.fillStyle='#aaa';ctx.lineWidth=1;
 for(let i=0;i<4;i++){const y=pad.t+ch*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(money(max*(1-i/3)).replace(',00',''),2,y+4);}
 ctx.strokeStyle='#9fc2ff';ctx.fillStyle='#9fc2ff';ctx.lineWidth=2;ctx.beginPath();
 days.forEach((d,i)=>{const x=pad.l+(cw/(days.length-1))*i,y=pad.t+ch-(d.value/max)*ch;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.beginPath();if(i<days.length-1)ctx.moveTo(x,y);});
 ctx.beginPath();days.forEach((d,i)=>{const x=pad.l+(cw/(days.length-1))*i,y=pad.t+ch-(d.value/max)*ch;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
 ctx.fillStyle='#aaa';days.forEach((d,i)=>ctx.fillText(d.label,pad.l+(cw/(days.length-1))*i-10,h-10));
}
function drawProducts(data){
 const {ctx,w,h}=canvasBase($('#salesByProduct')),totals=new Map();
 for(const o of data)for(const item of o.items||[])totals.set(item.name,(totals.get(item.name)||0)+Number(item.qty||0));
 const list=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,6),labelW=Math.min(150,w*.42),barW=w-labelW-35,rowH=32;
 if(!list.length){ctx.fillStyle='#aaa';ctx.font='13px Arial';ctx.fillText('Sem itens vendidos para exibir.',12,28);return;}
 const max=Math.max(...list.map(x=>x[1]));ctx.font='11px Arial';
 list.forEach(([name,value],i)=>{const y=18+i*rowH;ctx.fillStyle='#bbb';ctx.fillText(name.length>21?name.slice(0,19)+'…':name,8,y+11);ctx.fillStyle='#242a33';ctx.fillRect(labelW,y,barW,12);ctx.fillStyle='#9fc2ff';ctx.fillRect(labelW,y,barW*value/max,12);ctx.fillStyle='#fff';ctx.fillText(String(value),labelW+barW+8,y+11);});
}
function drawRevenue(data){
 const {ctx,w,h}=canvasBase($('#salesByRevenueProduct')),totals=new Map();
 for(const order of data)for(const item of order.items||[])totals.set(item.name,(totals.get(item.name)||0)+Number(item.line_total||Number(item.price||0)*Number(item.qty||0)));
 const list=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,6),labelW=Math.min(155,w*.43),barW=Math.max(50,w-labelW-65),rowH=32;
 if(!list.length){ctx.fillStyle='#94a3b8';ctx.font='13px Arial';ctx.fillText('Sem faturamento para exibir.',12,28);return;}
 const max=Math.max(...list.map(x=>x[1]));ctx.font='11px Arial';
 list.forEach(([name,value],i)=>{const y=18+i*rowH;ctx.fillStyle='#b9c5d5';ctx.fillText(name.length>20?name.slice(0,18)+'…':name,8,y+11);ctx.fillStyle='#202a39';ctx.fillRect(labelW,y,barW,12);ctx.fillStyle='#61d5cb';ctx.fillRect(labelW,y,barW*value/max,12);ctx.fillStyle='#e5edf8';ctx.fillText(money(value),labelW+barW+7,y+11);});
}
function render(){
 const sales=orders.filter(o=>o.order_status!=='cancelado');
 $('#salesOrderCount').textContent=orders.length;$('#salesTotal').textContent=money(sales.reduce((n,o)=>n+Number(o.total),0));
 $('#orderRows').innerHTML=orders.map(o=>{
 const items=(o.items||[]).map(i=>esc(i.name)+' × '+Number(i.qty)+'<small>'+esc(i.color)+' · Tam. '+esc(i.size)+' · '+money(i.line_total)+'</small>').join('');
 const addr=esc(o.address_line)+', '+esc(o.address_number)+(o.complement?' · '+esc(o.complement):'')+'<small>'+esc(o.neighborhood)+' · '+esc(o.city)+'/'+esc(o.state)+' · CEP '+esc(o.cep)+'</small><small>CPF: ***.***.***-'+esc(o.cpf_last4)+'</small>';
 const label={pix:'Pix',cartao:'Cartão',boleto:'Boleto'}[o.payment_method]||'Não informado';
 const date=new Date(o.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
 return '<tr><td><strong>'+esc(o.order_number)+'</strong></td><td><strong>'+esc(o.customer_name)+'</strong><small>'+esc(o.customer_email)+'</small><div class="order-address">'+addr+'</div></td><td><div class="order-items">'+items+'</div></td><td><span class="demo-tag">'+label+'</span><small>Sem cobrança</small></td><td><strong>'+money(o.total)+'</strong></td><td>'+date+'</td><td><select class="order-status" data-order="'+esc(o.id)+'" aria-label="Atualizar situação do pedido '+esc(o.order_number)+'">'+[['registrado','Registrado'],['separando','Separando'],['enviado','Enviado'],['concluido','Concluído'],['cancelado','Cancelado']].map(([v,l])=>'<option value="'+v+'" '+(o.order_status===v?'selected':'')+'>'+l+'</option>').join('')+'</select></td></tr>';
 }).join('');
 $('#ordersEmpty').hidden=orders.length>0;drawDays(sales);drawProducts(sales);drawRevenue(sales);
}
async function load(){
 const button=$('#refreshSales');button.disabled=true;
 try{const {data,error}=await client.from('aurel_orders').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;orders=data||[];render();}
 catch(e){$('#adminMessage').textContent='Não foi possível carregar os pedidos. Confira a conexão com o banco.';$('#adminMessage').classList.add('is-error');}
 finally{button.disabled=false;}
}
$('#refreshSales').addEventListener('click',load);
$('#orderRows').addEventListener('change',async e=>{const select=e.target.closest('[data-order]');if(!select)return;select.disabled=true;const {error}=await client.from('aurel_orders').update({order_status:select.value}).eq('id',select.dataset.order);if(error){$('#adminMessage').textContent='Não foi possível atualizar a situação do pedido.';$('#adminMessage').classList.add('is-error');}else{const o=orders.find(x=>x.id===select.dataset.order);if(o)o.order_status=select.value;}select.disabled=false;});
window.addEventListener('resize',()=>{if(orders.length)render();});
window.AurelSalesAdmin={load,clear,render};
})();