/* Concilia a aba Pagamentos com Dados & Insights.
   - Pedidos cancelados sem registro de pagamento aparecem como "Cancelado".
   - Pedidos aguardando pagamento sem registro aparecem como "Pendente".
   - Pedido cancelado que ainda tem pagamento aprovado recebe o aviso "Pedido cancelado".
   Só altera a exibição: nenhum valor recebido e nenhum dado do banco é modificado. */
(function(){
 if(typeof call!=='function'||typeof loadAllOrders!=='function')return;
 const original=call;
 const state={loaded:false,cancelledCodes:new Set(),cancelledOrders:0,cancelledPaid:0};
 async function analyze(){
  const orders=await loadAllOrders();
  const ids=new Set();let off=0;
  for(;;){
   const page=await original('payments?offset='+off)||[];
   page.forEach(p=>ids.add(String(p.order_id)));
   if(page.length<100||off>=10000)break;
   off+=100;
  }
  const extra=[];
  state.cancelledCodes=new Set();state.cancelledPaid=0;
  orders.forEach(o=>{
   const has=ids.has(String(o.id));
   const row=status=>({id:status+'-'+o.id,order_id:o.id,status,metodo:o.metodo||null,valor:o.total,criado_em:o.created_at});
   if(o.status==='cancelado'){
    state.cancelledCodes.add(o.codigo);
    if(has)state.cancelledPaid++;else extra.push(row('cancelled'));
   }else if(o.status==='aguardando_pagamento'&&!has){
    extra.push(row('pending'));
   }
  });
  state.cancelledOrders=state.cancelledCodes.size;
  state.loaded=true;
  return extra;
 }
 window.call=async function(path,...rest){
  const data=await original(path,...rest);
  try{
   if((rest[0]||'GET')!=='GET')return data;
   if(path==='payments?offset=0'&&Array.isArray(data)){
    const extra=await analyze();
    return data.concat(extra).sort((a,b)=>String(b.criado_em||'').localeCompare(String(a.criado_em||'')));
   }
   if(path==='analytics'&&data&&typeof data==='object'){
    const extra=await analyze();
    data.cancelled_payments=Number(data.cancelled_payments||0)+extra.filter(r=>r.status==='cancelled').length;
    data.pending_payments=Number(data.pending_payments||0)+extra.filter(r=>r.status==='pending').length;
   }
  }catch(e){}
  return data;
 };
 const root=document.getElementById('adminContent');
 function decorate(){
  if(!root||!state.loaded)return;
  root.querySelectorAll('tbody tr[data-payment-status="approved"]').forEach(tr=>{
   const code=tr.cells[0]&&tr.cells[0].textContent.trim();
   const cell=tr.cells[3];
   if(cell&&state.cancelledCodes.has(code)&&!cell.querySelector('[data-cancel-flag]'))
    cell.insertAdjacentHTML('beforeend',' <span class="status-pill warning" data-cancel-flag>Pedido cancelado</span>');
  });
  const grid=root.querySelector('.payment-metric-grid');
  if(grid&&!grid.querySelector('[data-cancel-card]'))
   grid.insertAdjacentHTML('beforeend','<article data-cancel-card style="--metric-color:#f87171"><span>Pedidos cancelados</span><strong>'+state.cancelledOrders+'</strong></article>');
  const note=Array.from(root.querySelectorAll('p')).find(p=>p.textContent.indexOf('Um pedido cancelado não significa')>=0);
  if(note&&!note.dataset.cancelNote&&state.cancelledPaid>0){
   note.dataset.cancelNote='1';
   note.insertAdjacentHTML('beforeend',' <strong>Atenção:</strong> '+state.cancelledPaid+' pedido(s) cancelado(s) ainda consta(m) com pagamento aprovado. Confira se é necessário estornar.');
  }
 }
 if(root)new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
})();
