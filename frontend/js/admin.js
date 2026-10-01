const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let adminSession;try{adminSession=JSON.parse(localStorage.getItem('hw-session')||'null');}catch{}
const message=m=>document.getElementById('adminMessage').textContent=m;
async function call(path,method='GET',body){if(!adminSession)throw Error('Entre na sua conta para acessar a administração.');const r=await fetch('/api/admin/'+path,{method,headers:{Authorization:'Bearer '+adminSession.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Confira os campos e tente novamente.');return data;}
const names={products:'Produtos',product_sizes:'Estoque',categories:'Categorias',product_images:'Imagens',orders:'Pedidos',profiles:'Clientes',payments:'Pagamentos',coupons:'Cupons',reviews:'Avaliações'};
const fields={products:['nome','slug','preco','preco_promocional','ativo'],product_sizes:['product_id','tamanho','estoque'],categories:['nome','slug','grupo'],product_images:['product_id','url','ordem'],orders:['codigo','nome_cliente','status','review_required','total','rastreio'],profiles:['nome_completo','telefone','role'],payments:['order_id','metodo','status','valor'],coupons:['codigo','tipo','valor','ativo'],reviews:['product_id','nota','comentario']};
let currentRows=[],page=0,current='products';
const labels={nome:'Produto',slug:'Endereço da peça',preco:'Preço',preco_promocional:'Preço promocional',ativo:'Visibilidade',product_id:'Produto',tamanho:'Tamanho',estoque:'Unidades',grupo:'Grupo',url:'Imagem',ordem:'Ordem',codigo:'Pedido',nome_cliente:'Cliente',status:'Situação',review_required:'Conferência',total:'Total',rastreio:'Rastreamento',nome_completo:'Nome',telefone:'Telefone',role:'Perfil',order_id:'Pedido',metodo:'Método',valor:'Valor',tipo:'Tipo',nota:'Nota',comentario:'Comentário',tecido:'Tecido',caimento:'Caimento',destaque:'Em destaque',lancamento:'Lançamento'};
const statusLabels={recebido:'Recebido',pagamento_aprovado:'Pagamento aprovado',preparando:'Em preparação',enviado:'Enviado',entregue:'Entregue',cancelado:'Cancelado',pending:'Pendente',approved:'Aprovado',admin:'Administrador',cliente:'Cliente'};
const icons={products:'▧',product_sizes:'▤',categories:'◫',product_images:'▣',orders:'▱',profiles:'◎',payments:'◈',coupons:'◇',reviews:'☆'};
let productNames={};
function cellValue(key,value){if(value===null||value===undefined||value==='')return '<span class="muted">—</span>';if(['preco','preco_promocional','total','valor'].includes(key))return currency(value);if(key==='ativo')return `<span class="status-pill ${value?'positive':'neutral'}">${value?'Publicado':'Oculto'}</span>`;if(key==='review_required')return value?'<span class="status-pill">Revisar estoque</span>':'—';if(key==='status'||key==='role')return `<span class="status-pill">${escapeHTML(statusLabels[value]||value)}</span>`;if(key==='product_id')return escapeHTML(productNames[value]||value);return escapeHTML(value);}
async function listing(resource,offset=0){try{
 current=resource;page=offset;document.querySelectorAll('[data-resource]').forEach(b=>{const active=b.dataset.resource===resource;b.classList.toggle('active',active);active?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});
 currentRows=await call(resource+'?offset='+offset);if(resource==='products')currentRows.forEach(p=>productNames[p.id]=p.nome);
 const cols=fields[resource];document.getElementById('adminContent').innerHTML=`<div class="panel-heading"><div><p class="nav-caption">GERENCIAR COLEÇÃO E VENDAS</p><h2>${names[resource]} <span class="count-badge">${currentRows.length}</span></h2></div>${resource==='products'?'<button class="btn-gold" id="newProduct">+ Adicionar produto</button>':''}</div><div class="table-tools"><label>Buscar nesta página<input type="search" id="adminSearch" placeholder="Digite para filtrar…"></label><span>Mostrando ${currentRows.length} registros</span></div><div id="editor"></div><div class="admin-table"><table><thead><tr>${cols.map(c=>`<th scope="col">${labels[c]||escapeHTML(c)}</th>`).join('')}${['products','product_sizes'].includes(resource)?'<th scope="col">Ações</th>':''}</tr></thead><tbody>${currentRows.map((r,i)=>`<tr data-search="${escapeHTML(cols.map(c=>c==='product_id'?(productNames[r[c]]||r[c]):r[c]).join(' ').toLocaleLowerCase('pt-BR'))}">${cols.map(c=>`<td>${cellValue(c,r[c])}</td>`).join('')}${resource==='products'?`<td><button class="row-action" data-edit="${i}">Editar ↗</button></td>`:resource==='product_sizes'?`<td><button class="row-action" data-stock="${i}">Ajustar estoque</button></td>`:''}</tr>`).join('')}</tbody></table></div><p id="emptyTable" class="empty-table" ${currentRows.length?'hidden':''}>${currentRows.length?'Nenhum resultado para esta busca.':'Ainda não há registros por aqui.'}</p><div class="table-footer"><span>Página ${Math.floor(offset/100)+1}</span><div><button class="btn-outline" id="previous" ${offset===0?'disabled':''}>← Anterior</button><button class="btn-outline" id="next" ${currentRows.length<100?'disabled':''}>Próxima →</button></div></div>`;
 if(resource==='orders'){
  const head=document.querySelector('#adminContent thead tr');head.insertAdjacentHTML('beforeend','<th scope="col">Ações</th>');
  document.querySelectorAll('#adminContent tbody tr').forEach((tr,i)=>{
   const order=currentRows[i],allowed=!order.review_required&&['pagamento_aprovado','preparando','enviado'].includes(order.status);
   tr.insertAdjacentHTML('beforeend',`<td>${allowed?`<button class="row-action" data-order="${i}">Avançar pedido</button>`:''}</td>`);
  });
 }
 document.getElementById('adminSearch').oninput=e=>{let visible=0;document.querySelectorAll('[data-search]').forEach(row=>{row.hidden=!row.dataset.search.includes(e.target.value.toLocaleLowerCase('pt-BR'));if(!row.hidden)visible++;});document.getElementById('emptyTable').hidden=visible>0;};
 document.getElementById('previous').onclick=()=>listing(current,Math.max(0,page-100));document.getElementById('next').onclick=()=>listing(current,page+100);if(resource==='products')document.getElementById('newProduct').onclick=()=>editProduct();message('');
 }catch(e){message(e.message);}}
async function editProduct(p={}){try{const categories=await call('categories');document.getElementById('editor').innerHTML=`<form class="admin-form" id="productForm"><button type="button" class="editor-close wide" onclick="document.getElementById('editor').innerHTML=''">Fechar edição ×</button><h3 class="wide">${p.id?'Editar produto':'Novo produto'}</h3>${['nome','slug','tecido','caimento'].map(n=>`<label>${labels[n]||n}<input name="${n}" value="${escapeHTML(p[n])}" ${['nome','slug'].includes(n)?'required':''}></label>`).join('')}<label>Categoria<select name="categoria_id">${categories.map(c=>`<option value="${c.id}" ${c.id===p.categoria_id?'selected':''}>${escapeHTML(c.nome)}</option>`).join('')}</select></label>${['preco','preco_promocional'].map(n=>`<label>${labels[n]||n}<input type="number" step="0.01" min="0.01" name="${n}" value="${escapeHTML(p[n])}" ${n==='preco'?'required':''}></label>`).join('')}<label class="wide">Descrição<textarea name="descricao">${escapeHTML(p.descricao)}</textarea></label>${['ativo','destaque','lancamento'].map(n=>`<label>${labels[n]||n}<input type="checkbox" name="${n}" ${p[n]?'checked':''}></label>`).join('')}<button class="btn-gold">Salvar produto</button></form>`;document.getElementById('productForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));for(const k of ['ativo','destaque','lancamento'])data[k]=e.target.elements[k].checked;data.preco_promocional=data.preco_promocional||null;try{await call('products'+(p.id?'/'+p.id:''),p.id?'PUT':'POST',data);await listing('products');message('Produto salvo.');}catch(err){message(err.message);}};}catch(e){message(e.message);}}
document.addEventListener('click',e=>{const a=e.target.closest('[data-edit]');if(a)editProduct(currentRows[Number(a.dataset.edit)]);const s=e.target.closest('[data-stock]');if(s){const row=currentRows[Number(s.dataset.stock)];document.getElementById('editor').innerHTML=`<form id="stockForm"><label>Estoque para ${escapeHTML(row.tamanho)}<input name="stock" type="number" min="0" step="1" value="${row.estoque}" required></label><button class="btn-gold">Salvar estoque</button></form>`;document.getElementById('stockForm').onsubmit=async ev=>{ev.preventDefault();try{await call('sizes/'+row.id,'PUT',{product_id:row.product_id,tamanho:row.tamanho,estoque:Number(new FormData(ev.target).get('stock'))});listing('product_sizes');}catch(err){message(err.message);}};}});
document.addEventListener('click',e=>{const button=e.target.closest('[data-order]');if(!button)return;
 const order=currentRows[Number(button.dataset.order)];
 const next={pagamento_aprovado:'preparando',preparando:'enviado',enviado:'entregue'}[order.status];if(!next)return;
 const editor=document.getElementById('editor');
 editor.innerHTML=`<form id="fulfillmentForm" class="admin-form"><h3>Pedido ${escapeHTML(order.codigo)}</h3><p>Próxima etapa: ${escapeHTML(statusLabels[next])}</p><label>Rastreio${next==='enviado'?' (obrigatório)':''}<input name="rastreio" value="${escapeHTML(order.rastreio||'')}" ${next==='enviado'?'required':''}></label><button class="btn-gold">Confirmar etapa</button></form>`;
 document.getElementById('fulfillmentForm').onsubmit=async event=>{event.preventDefault();try{await call('orders/'+order.id+'/fulfillment','PATCH',{status:next,rastreio:new FormData(event.target).get('rastreio')});await listing('orders',page);message('Pedido atualizado.');}catch(err){message(err.message);}};
});
const paymentLabels={pix:'Pix',cartao:'Cartão',boleto:'Boleto',confirmado:'Confirmado'};
const dateTime=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const revenuePeriodLabels={day:'Dia',week:'Semana',month:'Mês',year:'Ano'};
let selectedRevenuePeriod='month',dashboardBusy=false,dashboardTimer=null;

function purchaseItems(items){
 const safe=Array.isArray(items)?items:[];
 if(!safe.length)return '<span class="muted">Itens do pedido</span>';
 const first=safe.slice(0,2).map(i=>`${escapeHTML(i.nome_produto)} · ${Number(i.quantidade)||0} un.`).join('<br>');
 return first+(safe.length>2?`<br><span class="muted">+${safe.length-2} item(ns)</span>`:'');
}
function dashboardHTML(d){
 const recent=Array.isArray(d.recent_purchases)?d.recent_purchases:[];
 return `
 <article><span class="metric-icon">▱</span><p>Total de pedidos</p><strong>${d.orders}</strong><small>Desde o início da loja</small></article>
 <article><span class="metric-icon green">✓</span><p>Compras pagas</p><strong>${d.paid_orders}</strong><small>Confirmadas pelo Mercado Pago</small></article>
 <article class="revenue-card"><span class="metric-icon">↗</span><p>Faturamento confirmado</p><strong>${currency(d.revenue)}</strong><small>Somente pagamentos aprovados</small></article>
 <article class="orders-card"><p>Andamento dos pedidos</p>${Object.entries(d.statuses||{}).length?Object.entries(d.statuses).map(([status,count])=>`<div class="admin-status"><span>${escapeHTML(statusLabels[status]||status)}</span><meter min="0" max="${Math.max(d.orders,1)}" value="${count}">${count}</meter><b>${count}</b></div>`).join(''):'<div class="empty-metric">Sua próxima venda começa na vitrine.</div>'}</article>
 <article class="revenue-chart-card">
   <div class="dashboard-card-head revenue-head"><div><p>Faturamento</p><small>Pagamentos aprovados e reconciliados com o Mercado Pago</small></div><div class="revenue-periods" role="group" aria-label="Período do gráfico">${Object.entries(revenuePeriodLabels).map(([key,label])=>`<button type="button" data-revenue-period="${key}" class="${key===selectedRevenuePeriod?'active':''}">${label}</button>`).join('')}</div></div>
   <div id="revenueChart" class="annual-revenue-chart" role="img" aria-label="Gráfico de faturamento"><p class="loading-state">Carregando gráfico…</p></div>
   <div class="chart-summary"><p id="revenuePeriodTotal"></p><p id="revenuePeriodOrders"></p></div>
 </article>
 <article class="recent-purchases-card">
   <div class="dashboard-card-head"><div><p>Compras recentes</p><small>Últimas compras com pagamento confirmado</small></div><button class="row-action" id="viewAllOrders">Ver todos os pedidos ↗</button></div>
   <div class="recent-purchases">${recent.length?recent.map(order=>`<div class="purchase-row"><div><strong>${escapeHTML(order.codigo||'Pedido')}</strong><span>${escapeHTML(order.nome_cliente||'Cliente')}</span></div><div class="purchase-items">${purchaseItems(order.items)}</div><div><span class="payment-method">${escapeHTML(paymentLabels[order.metodo]||order.metodo||'Pagamento')}</span><small>${escapeHTML(dateTime(order.approved_at))}</small></div><strong class="purchase-total">${currency(order.total)}</strong></div>`).join(''):'<div class="empty-metric">As compras pagas aparecerão aqui automaticamente.</div>'}</div>
 </article>`;
}
async function loadRevenueChart(period=selectedRevenuePeriod){
 try{
  selectedRevenuePeriod=period;
  document.querySelectorAll('[data-revenue-period]').forEach(button=>button.classList.toggle('active',button.dataset.revenuePeriod===period));
  const chart=document.getElementById('revenueChart');
  if(chart)chart.innerHTML='<p class="loading-state">Atualizando faturamento…</p>';
  const data=await call('revenue/chart?period='+encodeURIComponent(period));
  const total=document.getElementById('revenuePeriodTotal');
  const count=document.getElementById('revenuePeriodOrders');
  if(total)total.innerHTML=`<span>${escapeHTML(data.label)}</span><strong>${currency(data.total)}</strong>`;
  if(count)count.textContent=`${Number(data.orders)||0} compra(s) paga(s) no período`;
  if(!chart)return;
  if(!window.Plotly){chart.innerHTML='<p class="empty-metric">O gráfico não carregou. Atualize a página para tentar novamente.</p>';return;}
  await Plotly.react(chart,data.figure.data,data.figure.layout,{displayModeBar:false,responsive:true,locale:'pt-BR'});
 }catch(error){const chart=document.getElementById('revenueChart');if(chart)chart.innerHTML=`<p class="empty-metric">${escapeHTML(error.message)}</p>`;}
}
async function loadDashboard(quiet=false){
 if(dashboardBusy)return;dashboardBusy=true;
 try{
  const d=await call('dashboard');
  document.getElementById('dashboard').innerHTML=dashboardHTML(d);
  document.getElementById('viewAllOrders')?.addEventListener('click',()=>listing('orders'));
  document.querySelectorAll('[data-revenue-period]').forEach(button=>button.addEventListener('click',()=>loadRevenueChart(button.dataset.revenuePeriod)));
  await loadRevenueChart(selectedRevenuePeriod);
  if(!quiet)message('');
 }catch(error){if(!quiet)message(error.message);}
 finally{dashboardBusy=false;}
}

(async()=>{try{
 document.getElementById('adminNav').innerHTML=Object.entries(names).map(([k,n])=>`<button data-resource="${k}"><span aria-hidden="true">${icons[k]}</span>${n}</button>`).join('');
 document.getElementById('adminNav').onclick=e=>{const b=e.target.closest('[data-resource]');if(b)listing(b.dataset.resource);};
 await loadDashboard();
 await listing('products');
 dashboardTimer=setInterval(()=>loadDashboard(true),30000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadDashboard(true);});
}catch(e){message(e.message);document.getElementById('adminContent').innerHTML='<div class="empty-table"><h2>Acesse sua conta de administrador</h2><p>Entre na sua conta para gerenciar a loja.</p><a class="btn-gold" href="/#conta">Ir para o login</a></div>';}})();
