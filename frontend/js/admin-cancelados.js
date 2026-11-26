/* Aba Pagamentos, Resumo dos pagamentos e barras de andamento sempre iguais ao Dados & Insights.
   Fonte única: /api/admin/analytics (calculado a partir de orders e payments do Supabase).
   - Cards da aba Pagamentos = mesmos 7 indicadores do Dados & Insights.
   - Pedidos cancelados é um filtro da mesma tabela (não abre mais uma tela separada).
   - Nenhum pagamento é inventado.
   - Atualização automática a cada 15 s e ao voltar para a aba, sem cache.
   Só altera a exibição; nenhum dado do banco é modificado. */
(function(){
 if(typeof call!=='function'||typeof loadAllOrders!=='function'||typeof listing!=='function')return;
 const original=call;
 const state={loaded:false,analytics:null,cancelledRows:[],cancelledCodes:new Set(),cancelledPaid:0};
 const money=v=>typeof currency==='function'?currency(v):String(v);
 const esc=v=>typeof escapeHTML==='function'?escapeHTML(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=v=>typeof dateTime==='function'?dateTime(v):new Date(v).toLocaleString('pt-BR');

 /* Nunca usar resposta antiga do navegador nas chamadas do painel. */
 const nativeFetch=window.fetch.bind(window);
 window.fetch=function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  if(url.indexOf('/api/admin/')>=0)init=Object.assign({},init||{},{cache:'no-store'});
  return nativeFetch(input,init);
 };

 async function analyze(){
  const orders=await loadAllOrders();
  const paidOrderIds=new Set();let off=0;
  for(;;){
   const page=await original('payments?offset='+off)||[];
   page.forEach(p=>{if(p.status==='approved')paidOrderIds.add(String(p.order_id));});
   if(page.length<100||off>=10000)break;
   off+=100;
  }
  state.cancelledRows=[];state.cancelledCodes=new Set();state.cancelledPaid=0;
  orders.forEach(o=>{
   if(o.status!=='cancelado')return;
   state.cancelledRows.push(o);
   state.cancelledCodes.add(o.codigo);
   if(paidOrderIds.has(String(o.id)))state.cancelledPaid++;
  });
  state.loaded=true;
 }
 window.call=async function(path,...rest){
  const data=await original(path,...rest);
  try{
   if((rest[0]||'GET')!=='GET')return data;
   if(path==='analytics'&&data&&typeof data==='object'){
    state.analytics=data;
    await analyze();
   }else if(path==='payments?offset=0'&&Array.isArray(data)){
    state.analytics=await original('analytics');
    await analyze();
   }
  }catch(e){}
  return data;
 };

 const root=document.getElementById('adminContent');
 let pf='all',pq='';
 function metricCards(a){
  return [
   ['Pedidos registrados',a.orders_total,'#60a5fa'],
   ['Pedidos cancelados',a.cancelled_orders,'#f87171'],
   ['Pagamentos aprovados',a.approved_payments,'#4ade80'],
   ['Pagamentos cancelados',a.cancelled_payments,'#fb923c'],
   ['Recebido em pagamentos',money(a.gross_received),'#f0d878'],
   ['Estornos registrados',money(a.refunds_total),'#c4b5fd'],
   ['Receita líquida recebida',money(a.net_received),'#2dd4bf']
  ].map(([label,value,color])=>'<article style="--metric-color:'+color+'"><span>'+label+'</span><strong>'+value+'</strong></article>').join('');
 }
 const FILTERS=[['all','Todos'],['approved','Aprovados'],['pending','Pendentes'],['rejected','Recusados'],['refunded','Estornados'],['order_cancelled','Pedidos cancelados']];
 function match(tr,f){
  const s=tr.dataset.paymentStatus;
  if(f==='all')return s!=='order_cancelled';
  if(f==='order_cancelled')return tr.dataset.orderCancelled==='1';
  if(f==='pending')return ['pending','in_process','authorized'].indexOf(s)>=0;
  if(f==='refunded')return ['refunded','charged_back'].indexOf(s)>=0;
  return s===f;
 }
 function setupFilters(bar){
  bar.dataset.synced='1';
  const tbody=root.querySelector('.admin-table tbody');
  if(!tbody)return;
  const payRows=Array.from(tbody.querySelectorAll('tr[data-payment-status]'));
  const paidCodes=new Set();
  payRows.forEach(tr=>{
   const code=tr.cells[0]&&tr.cells[0].textContent.trim();
   paidCodes.add(code);
   if(state.cancelledCodes.has(code))tr.dataset.orderCancelled='1';
  });
  state.cancelledRows.filter(o=>!paidCodes.has(o.codigo)).forEach(o=>{
   tbody.insertAdjacentHTML('beforeend','<tr data-payment-status="order_cancelled" data-order-cancelled="1" data-search="'+esc((o.codigo+' '+(o.nome_cliente||'')+' cancelado').toLowerCase())+'"><td>'+esc(o.codigo)+'</td><td>'+esc(o.nome_cliente||'Cliente')+'</td><td>—</td><td><span class="status-pill warning">Pedido cancelado</span></td><td>'+money(o.total)+'</td><td>'+esc(when(o.created_at))+'</td></tr>');
  });
  const rows=()=>Array.from(tbody.querySelectorAll('tr'));
  const count=f=>rows().filter(tr=>match(tr,f)).length;
  const apply=()=>{
   let shown=0;
   rows().forEach(tr=>{
    const ok=match(tr,pf)&&(tr.dataset.search||'').indexOf(pq)>=0;
    tr.hidden=!ok;if(ok)shown++;
   });
   bar.innerHTML=FILTERS.map(([k,l])=>'<button type="button" data-pf="'+k+'" aria-pressed="'+(pf===k)+'">'+l+' <b>'+count(k)+'</b></button>').join('');
   const empty=root.querySelector('#emptyTable');
   if(empty){empty.hidden=shown>0;}
   const info=root.querySelector('.table-tools>span');
   if(info)info.textContent='Mostrando '+shown+' de '+count(pf)+(pf==='order_cancelled'?' pedidos cancelados':' pagamentos');
  };
  bar.onclick=e=>{const b=e.target.closest('[data-pf]');if(b){pf=b.dataset.pf;apply();}};
  const input=root.querySelector('#adminSearch');
  if(input){input.value=pq;input.oninput=e=>{pq=String(e.target.value||'').trim().toLocaleLowerCase('pt-BR');apply();};}
  const badge=root.querySelector('.panel-heading .count-badge');
  if(badge)badge.textContent=count('all');
  apply();
 }
 function decorate(){
  if(!root||!state.loaded)return;
  root.querySelectorAll('tbody tr[data-payment-status="approved"]').forEach(tr=>{
   const code=tr.cells[0]&&tr.cells[0].textContent.trim();
   const cell=tr.cells[3];
   if(cell&&state.cancelledCodes.has(code)&&!cell.querySelector('[data-cancel-flag]'))
    cell.insertAdjacentHTML('beforeend',' <span class="status-pill warning" data-cancel-flag>Pedido cancelado</span>');
  });
  const grid=root.querySelector('.payment-metric-grid');
  if(grid&&state.analytics&&grid.dataset.synced!=='1'){
   grid.dataset.synced='1';
   grid.innerHTML=metricCards(state.analytics);
  }
  const bar=root.querySelector('.payment-filter-row');
  if(bar&&bar.dataset.synced!=='1')setupFilters(bar);
  const note=Array.from(root.querySelectorAll('p')).find(p=>p.textContent.indexOf('Um pedido cancelado não significa')>=0);
  if(note&&!note.dataset.cancelNote&&state.cancelledPaid>0){
   note.dataset.cancelNote='1';
   note.insertAdjacentHTML('beforeend',' <strong>Atenção:</strong> '+state.cancelledPaid+' pedido(s) cancelado(s) ainda consta(m) com pagamento aprovado. Confira se é necessário estornar.');
  }
 }
 if(root)new MutationObserver(decorate).observe(root,{childList:true,subtree:true});

 /* Atualização automática: barras de andamento, cards, Resumo e listas. */
 let busy=false;
 const LIVE=['analytics','payments','orders','profiles'];
 async function refresh(){
  if(busy||document.hidden)return;
  busy=true;
  try{
   const editor=document.getElementById('editor');
   const typing=document.activeElement&&document.activeElement.id==='adminSearch';
   if(typeof loadDashboard==='function')await loadDashboard(true);
   if(typeof current!=='undefined'&&LIVE.indexOf(current)>=0&&!(editor&&editor.children.length)&&!typing){
    const y=window.scrollY;
    await listing(current,typeof page!=='undefined'?page:0);
    window.scrollTo(0,y);
   }
  }catch(e){}finally{busy=false;}
 }
 setInterval(refresh,15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('focus',refresh);
})();
