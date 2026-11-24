/* Horizon Wear — Administração: tela de Pedidos mais clara e funcional.
   Camada apenas visual e de filtros no navegador: busca por cliente (lupa), categorias de situação
   com contagem, selos coloridos, etapas do pedido e botão da próxima etapa.
   Não altera banco de dados, pagamentos nem login. A confirmação de etapa continua usando o
   mesmo fluxo e a mesma API do admin.js. */
(function(){
'use strict';

if(typeof statusLabels==='object'&&statusLabels){statusLabels.aguardando_pagamento='Aguardando pagamento';statusLabels.recebido='Recebido pelo cliente';}

var ST={
 aguardando_pagamento:{label:'Aguardando pagamento',c:'wait'},
 recebido:{label:'Recebido pelo cliente',c:'received'},
 pagamento_aprovado:{label:'Pagamento aprovado',c:'paid'},
 preparando:{label:'Em preparação',c:'prep'},
 enviado:{label:'Enviado',c:'ship'},
 entregue:{label:'Entregue',c:'done'},
 cancelado:{label:'Cancelado',c:'bad'}
};
var FLOW=['pagamento_aprovado','preparando','enviado','entregue','recebido'];
var NEXT={pagamento_aprovado:'preparando',preparando:'enviado',enviado:'entregue',entregue:'recebido'};
var CHIPS=['pagamento_aprovado','preparando','enviado','entregue','recebido'];
var OPTIONAL_CHIPS=['aguardando_pagamento','cancelado'];

var activeStatus='todos',query='';

var ICON_SEARCH='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
var ICON_TRUCK='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>';

function esc(v){return typeof escapeHTML==='function'?escapeHTML(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function money(v){return typeof currency==='function'?currency(v):String(v);}
function norm(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function info(status){return ST[status]||{label:String(status||'Pedido'),c:'wait'};}

function stepsHTML(status){
 var idx=FLOW.indexOf(status);
 if(idx<0)return '';
 return '<ol class="ord-steps" aria-hidden="true">'+FLOW.map(function(s,k){return '<li class="'+(k<idx?'is-done':k===idx?'is-now':'')+'"></li>';}).join('')+'</ol><small class="ord-stepcap">Etapa '+(idx+1)+' de '+FLOW.length+'</small>';
}

function trackHTML(o){
 var code=String(o.rastreio||'').trim();
 if(code)return '<span class="ord-track">'+ICON_TRUCK+'<span>'+esc(code)+'</span></span>';
 if(o.status==='pagamento_aprovado'||o.status==='preparando')return '<span class="ord-track ord-track--empty">Será informado no envio</span>';
 return '<span class="ord-none">—</span>';
}

function checkHTML(o){
 if(o.review_required)return '<span class="ord-review">⚠ Revisar estoque</span>';
 if(FLOW.indexOf(o.status)>-1)return '<span class="ord-ok">✓ Tudo certo</span>';
 return '<span class="ord-none">—</span>';
}

function actionHTML(o,i){
 var next=NEXT[o.status];
 if(o.review_required)return '<span class="ord-hint">Resolva o estoque primeiro</span>';
 if(next)return '<button type="button" class="ord-advance ord-advance--'+info(next).c+'" data-order="'+i+'">Avançar para '+esc(info(next).label)+' <span aria-hidden="true">→</span></button>';
 if(o.status==='entregue')return '<span class="ord-final">✓ Finalizado</span>';
 if(o.status==='aguardando_pagamento')return '<span class="ord-hint">Aguardando confirmação do pagamento</span>';
 if(o.status==='recebido')return '<span class="ord-final">✓ Recebimento confirmado</span>';
 return '<span class="ord-none">—</span>';
}

function rowHTML(o,i){
 var st=info(o.status),name=String(o.nome_cliente||'Cliente').trim()||'Cliente';
 var hay=norm([name,o.codigo,st.label,o.rastreio].join(' '));
 return '<tr class="ord-row ord-c-'+st.c+'" data-ord-status="'+esc(o.status)+'" data-ord-hay="'+esc(hay)+'">'+
  '<td class="ord-code">'+esc(o.codigo)+'</td>'+
  '<td><div class="ord-client"><span class="ord-avatar" aria-hidden="true">'+esc(name.charAt(0).toUpperCase())+'</span><span class="ord-name">'+esc(name)+'</span></div></td>'+
  '<td><span class="ord-badge"><i aria-hidden="true"></i>'+esc(st.label)+'</span>'+stepsHTML(o.status)+'</td>'+
  '<td>'+checkHTML(o)+'</td>'+
  '<td class="ord-total">'+money(o.total)+'</td>'+
  '<td>'+trackHTML(o)+'</td>'+
  '<td>'+actionHTML(o,i)+'</td></tr>';
}

function chipHTML(key,label,count,cls){
 return '<button type="button" class="ord-chip '+cls+'" data-ord-filter="'+key+'" aria-pressed="'+(activeStatus===key)+'"><i aria-hidden="true"></i>'+esc(label)+' <b>'+count+'</b></button>';
}

function applyFilter(){
 var host=document.getElementById('adminContent');if(!host)return;
 var rows=host.querySelectorAll('.ord-row'),shown=0;
 rows.forEach(function(tr){
  var ok=(activeStatus==='todos'||tr.getAttribute('data-ord-status')===activeStatus)&&(!query||tr.getAttribute('data-ord-hay').indexOf(query)>-1);
  tr.hidden=!ok;if(ok)shown++;
 });
 host.querySelectorAll('.ord-chip').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-ord-filter')===activeStatus));});
 var count=document.getElementById('ordCount');
 if(count)count.textContent='Mostrando '+shown+' de '+rows.length+' pedidos';
 var empty=document.getElementById('emptyTable');
 if(empty){
  empty.hidden=shown>0||rows.length===0;
  empty.textContent=query?'Nenhum pedido encontrado para essa busca.':'Nenhum pedido nesta situação.';
 }
}

function enhance(){
 var host=document.getElementById('adminContent');
 var tools=host&&host.querySelector('.table-tools');
 var wrap=host&&host.querySelector('.admin-table');
 if(!host||!tools||!wrap||!Array.isArray(currentRows))return;

 var counts={};
 currentRows.forEach(function(o){counts[o.status]=(counts[o.status]||0)+1;});

 tools.classList.add('ord-tools');
 tools.innerHTML='<label class="ord-search"><span class="ord-lupa">'+ICON_SEARCH+'</span><input type="search" id="adminSearch" placeholder="Buscar cliente ou nº do pedido…" autocomplete="off" aria-label="Buscar cliente ou número do pedido"></label><span id="ordCount"></span>';

 var chips=chipHTML('todos','Todos',currentRows.length,'ord-c-all')+
  CHIPS.map(function(k){return chipHTML(k,info(k).label,counts[k]||0,'ord-c-'+info(k).c);}).join('')+
  OPTIONAL_CHIPS.filter(function(k){return counts[k];}).map(function(k){return chipHTML(k,info(k).label,counts[k],'ord-c-'+info(k).c);}).join('');
 var old=host.querySelector('.ord-filters');if(old)old.remove();
 tools.insertAdjacentHTML('afterend','<div class="ord-filters" id="ordFilters" role="group" aria-label="Filtrar pedidos por situação">'+chips+'</div>');

 wrap.innerHTML='<table class="ord-table"><thead><tr><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Situação</th><th scope="col">Conferência</th><th scope="col">Total</th><th scope="col">Rastreamento</th><th scope="col">Ações</th></tr></thead><tbody>'+currentRows.map(rowHTML).join('')+'</tbody></table>';

 if(activeStatus!=='todos'&&activeStatus!=='aguardando_pagamento'&&activeStatus!=='cancelado'&&CHIPS.indexOf(activeStatus)<0)activeStatus='todos';
 var input=document.getElementById('adminSearch');
 input.value=query;
 input.oninput=function(e){query=norm(e.target.value);applyFilter();};
 applyFilter();
}

document.addEventListener('click',function(e){
 var chip=e.target.closest&&e.target.closest('[data-ord-filter]');
 if(chip){activeStatus=chip.getAttribute('data-ord-filter');applyFilter();return;}
 if(e.target.closest&&e.target.closest('.ord-advance')){
  setTimeout(function(){var ed=document.getElementById('editor');if(ed&&ed.firstElementChild)ed.scrollIntoView({behavior:'smooth',block:'center'});},60);
 }
});

var original=window.listing;
if(typeof original==='function'){
 window.listing=async function(resource){
  var result=await original.apply(this,arguments);
  if(resource==='orders'){try{enhance();}catch(error){console.error('Pedidos:',error);}}
  return result;
 };
}
})();
