/* Pagamentos cancelados: pedidos cancelados que não têm linha na tabela de pagamentos
   passam a aparecer na aba Pagamentos e na contagem de Dados & Insights.
   Não altera valores recebidos nem nenhum dado do banco; só a exibição. */
(function(){
 if(typeof call!=='function'||typeof loadAllOrders!=='function')return;
 const original=call;
 async function missingCancelled(){
  const orders=await loadAllOrders();
  const ids=new Set();let off=0;
  for(;;){
   const page=await original('payments?offset='+off)||[];
   page.forEach(p=>ids.add(String(p.order_id)));
   if(page.length<100||off>=10000)break;
   off+=100;
  }
  return orders.filter(o=>o.status==='cancelado'&&!ids.has(String(o.id))).map(o=>({
   id:'cancelado-'+o.id,order_id:o.id,status:'cancelled',metodo:o.metodo||null,valor:o.total,criado_em:o.created_at
  }));
 }
 window.call=async function(path,...rest){
  const data=await original(path,...rest);
  try{
   if((rest[0]||'GET')!=='GET')return data;
   if(path==='payments?offset=0'&&Array.isArray(data)){
    const extra=await missingCancelled();
    return data.concat(extra).sort((a,b)=>String(b.criado_em||'').localeCompare(String(a.criado_em||'')));
   }
   if(path==='analytics'&&data&&typeof data==='object'){
    const extra=await missingCancelled();
    data.cancelled_payments=Number(data.cancelled_payments||0)+extra.length;
   }
  }catch(e){}
  return data;
 };
})();
