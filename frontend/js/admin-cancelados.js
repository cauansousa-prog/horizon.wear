/* Concilia a aba Pagamentos e o Resumo dos pagamentos com Dados & Insights.
   Fonte única dos números: /api/admin/analytics, calculado a partir das tabelas orders e payments do Supabase.
   - Os cards da aba Pagamentos repetem exatamente os indicadores de Dados & Insights.
   - Nenhum pagamento é inventado: pedido aguardando pagamento continua só na aba Pedidos,
     porque ainda não existe registro na tabela payments.
   - Pedido cancelado que ainda tem pagamento aprovado recebe o aviso "Pedido cancelado".
   Só altera a exibição: nenhum valor recebido e nenhum dado do banco é modificado. */
(function(){
 if(typeof call!=='function'||typeof loadAllOrders!=='function')return;
 const original=call;
 const state={loaded:false,analytics:null,cancelledCodes:new Set(),cancelledPaid:0};
 const money=v=>typeof currency==='function'?currency(v):String(v);
 async function analyze(){
  const orders=await loadAllOrders();
  const paidOrderIds=new Set();let off=0;
  for(;;){
   const page=await original('payments?offset='+off)||[];
   page.forEach(p=>{if(p.status==='approved')paidOrderIds.add(String(p.order_id));});
   if(page.length<100||off>=10000)break;
   off+=100;
  }
  state.cancelledCodes=new Set();state.cancelledPaid=0;
  orders.forEach(o=>{
   if(o.status!=='cancelado')return;
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
   const badge=root.querySelector('.panel-heading .count-badge');
   if(badge)badge.textContent=root.querySelectorAll('tbody tr[data-payment-status]').length;
  }
  const chip=root.querySelector('[data-payment-filter="cancelled"]');
  if(chip)chip.hidden=true;
  const note=Array.from(root.querySelectorAll('p')).find(p=>p.textContent.indexOf('Um pedido cancelado não significa')>=0);
  if(note&&!note.dataset.cancelNote&&state.cancelledPaid>0){
   note.dataset.cancelNote='1';
   note.insertAdjacentHTML('beforeend',' <strong>Atenção:</strong> '+state.cancelledPaid+' pedido(s) cancelado(s) ainda consta(m) com pagamento aprovado. Confira se é necessário estornar.');
  }
 }
 if(root)new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
})();
