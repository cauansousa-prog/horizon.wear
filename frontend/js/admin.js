const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let adminSession;try{adminSession=JSON.parse(localStorage.getItem('hw-session')||'null');}catch{}
const message=(m,type='info')=>{const el=document.getElementById('adminMessage');if(!el)return;el.textContent=m||'';el.dataset.state=type;};
async function call(path,method='GET',body){if(!adminSession)throw Error('Entre na sua conta para acessar a administração.');const r=await fetch('/api/admin/'+path,{method,headers:{Authorization:'Bearer '+adminSession.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{};}catch{data={detail:raw||'O servidor retornou uma resposta inválida.'};}if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Confira os campos e tente novamente.');return data;}
const names={products:'Produtos',product_sizes:'Estoque',categories:'Categorias',product_images:'Imagens',orders:'Pedidos',profiles:'Clientes',payments:'Pagamentos',coupons:'Cupons',reviews:'Avaliações'};
const fields={products:['nome','slug','preco','preco_promocional','ativo'],product_sizes:['product_id','tamanho','estoque'],categories:['nome','slug','grupo'],product_images:['product_id','url','ordem'],orders:['codigo','nome_cliente','status','review_required','total','rastreio'],profiles:['nome_completo','telefone','role'],payments:['order_id','metodo','status','valor'],coupons:['codigo','tipo','valor','ativo'],reviews:['product_id','nota','comentario']};
let currentRows=[],page=0,current='products',stockSearchRows=null,stockSearchRequest=0,stockSearchTimer=null;
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
 document.getElementById('adminSearch').oninput=e=>{
  const query=e.target.value.trim().toLocaleLowerCase('pt-BR');
  if(resource!=='product_sizes'){
   let visible=0;document.querySelectorAll('[data-search]').forEach(row=>{row.hidden=!row.dataset.search.includes(query);if(!row.hidden)visible++;});
   document.getElementById('emptyTable').hidden=visible>0;return;
  }
  clearTimeout(stockSearchTimer);
  const request=++stockSearchRequest;
  if(!query){document.getElementById('adminContent').querySelector('.table-footer').hidden=false;listing('product_sizes',0);return;}
  stockSearchTimer=setTimeout(async()=>{
   try{
    const loadAll=async(name)=>{
     const all=[];let start=0,batch=[];
     do{batch=await call(name+'?offset='+start);if(!Array.isArray(batch))throw Error('Resposta inválida ao pesquisar o estoque.');all.push(...batch);start+=100;}while(batch.length===100&&start<50000);
     return all;
    };
    const [allSizes,allProducts]=await Promise.all([loadAll('product_sizes'),loadAll('products')]);
    if(request!==stockSearchRequest)return;
    allProducts.forEach(p=>productNames[p.id]=p.nome);
    stockSearchRows=allSizes;
    currentRows=allSizes.filter(row=>{
     const productName=productNames[row.product_id]||'';
     return (productName+' '+row.tamanho+' '+row.estoque).toLocaleLowerCase('pt-BR').includes(query);
    });
    const tbody=document.querySelector('#adminContent tbody');
    tbody.innerHTML=currentRows.map((r,i)=>'<tr data-search="'+escapeHTML(((productNames[r.product_id]||r.product_id)+' '+r.tamanho+' '+r.estoque).toLocaleLowerCase('pt-BR'))+'">'+
     '<td>'+escapeHTML(productNames[r.product_id]||r.product_id)+'</td><td>'+escapeHTML(r.tamanho)+'</td><td>'+escapeHTML(r.estoque)+'</td>'+
     '<td><button class="row-action" data-stock="'+i+'">Ajustar estoque</button></td></tr>').join('');
    document.querySelector('#adminContent .count-badge').textContent=currentRows.length;
    document.querySelector('#adminContent .table-tools span').textContent='Encontrados '+currentRows.length+' tamanhos em todo o estoque';
    document.getElementById('emptyTable').hidden=currentRows.length>0;
    document.getElementById('emptyTable').textContent='Nenhum produto ou tamanho encontrado.';
    document.querySelector('#adminContent .table-footer').hidden=true;
   }catch(error){if(request===stockSearchRequest)message(error.message||'Não foi possível pesquisar todos os tamanhos.','error');}
  },220);
 };
 document.getElementById('previous').onclick=()=>listing(current,Math.max(0,page-100));document.getElementById('next').onclick=()=>listing(current,page+100);if(resource==='products')document.getElementById('newProduct').onclick=()=>editProduct();message('');
 }catch(e){message(e.message);}}
async function uploadProductImage(file){
 const response=await fetch('/api/admin/product-images/upload',{method:'POST',headers:{Authorization:'Bearer '+adminSession.access_token,'Content-Type':file.type},body:file});
 let data={};try{data=await response.json();}catch{}
 if(!response.ok)throw Error(data.detail||'Não foi possível enviar a imagem.');
 return data.url;
}
function normalizeProductSlug(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
}
async function editProduct(p={}){
 try{
  const creating=!p.id,categories=await call('categories'),editor=document.getElementById('editor');
  if(!Array.isArray(categories)||!categories.length){
   editor.innerHTML='<div class="admin-form"><p class="wide form-feedback is-error">Nenhuma categoria foi encontrada. Cadastre uma categoria antes de adicionar produtos.</p></div>';
   return;
  }
  const categoryOptions=categories.map(c=>'<option value="'+escapeHTML(c.id)+'" '+(c.id===p.categoria_id?'selected':'')+'>'+escapeHTML(c.nome)+'</option>').join('');
  const check=(key)=>creating&&key==='ativo'||Boolean(p[key])?'checked':'';
  editor.innerHTML=
   '<form class="admin-form product-editor" id="productForm" novalidate>'+
   '<button type="button" class="editor-close wide" id="closeProductEditor">Fechar edição ×</button>'+
   '<div class="wide product-form-heading"><span class="form-step">CATÁLOGO / PRODUTOS</span><h3>'+(p.id?'Editar produto':'Adicionar novo produto')+'</h3><p>Preencha os dados, escolha a foto e informe o estoque por tamanho.</p></div>'+
   '<label>Nome do produto<input name="nome" value="'+escapeHTML(p.nome)+'" placeholder="Ex.: Camisa Polo Zara" maxlength="160" required autocomplete="off"></label>'+
   '<label>Identificador da peça<input name="slug" value="'+escapeHTML(p.slug)+'" placeholder="camisa-polo-zara" maxlength="180" required autocomplete="off"><small>Gerado automaticamente pelo nome. Você também pode editar.</small></label>'+
   '<label>Tecido <span class="optional-label">Opcional</span><input name="tecido" value="'+escapeHTML(p.tecido)+'" placeholder="Ex.: Algodão"></label>'+
   '<label>Caimento <span class="optional-label">Opcional</span><input name="caimento" value="'+escapeHTML(p.caimento)+'" placeholder="Ex.: Regular"></label>'+
   '<label>Categoria<select name="categoria_id" required><option value="">Selecione uma categoria</option>'+categoryOptions+'</select></label>'+
   '<label>Preço de venda (R$)<input type="number" step="0.01" min="0.01" name="preco" value="'+escapeHTML(p.preco)+'" placeholder="0,00" inputmode="decimal" required></label>'+
   '<label>Preço promocional (R$) <span class="optional-label">Opcional</span><input type="number" step="0.01" min="0.01" name="preco_promocional" value="'+escapeHTML(p.preco_promocional)+'" placeholder="Deixe vazio se não houver promoção" inputmode="decimal"><small>Se preencher, precisa ser menor que o preço de venda.</small></label>'+
   (creating?'<label class="wide upload-field">Foto principal<input type="file" name="imagem_file" accept="image/jpeg,image/png,image/webp" required><small>JPG, PNG ou WebP · máximo de 4 MB</small></label><div class="wide image-preview-wrap" id="imagePreviewWrap" hidden><img class="product-image-preview" id="productImagePreview" alt="Prévia da foto do produto"><span id="imageFileName"></span></div><label class="wide stock-field">Estoque por tamanho<textarea name="estoque_tamanhos" rows="3" placeholder="P: 9, M: 11, G: 15, GG: 10" required></textarea><small>Separe por vírgula. Exemplo: P: 9, M: 11, G: 15, GG: 10</small></label>':'')+
   '<label class="wide">Descrição <span class="optional-label">Opcional</span><textarea name="descricao" rows="3" maxlength="5000" placeholder="Descreva detalhes importantes da peça...">'+escapeHTML(p.descricao)+'</textarea></label>'+
   '<div class="wide product-flags">'+
   '<label class="flag-option"><input type="checkbox" name="ativo" '+check('ativo')+'><span><strong>Visível na loja</strong><small>Disponível para os clientes.</small></span></label>'+
   '<label class="flag-option"><input type="checkbox" name="destaque" '+check('destaque')+'><span><strong>Em destaque</strong><small>Dar mais evidência na vitrine.</small></span></label>'+
   '<label class="flag-option"><input type="checkbox" name="lancamento" '+check('lancamento')+'><span><strong>Lançamento</strong><small>Identificar como novidade.</small></span></label></div>'+
   '<p class="wide form-feedback" id="productFormMessage" role="status" aria-live="polite"></p>'+
   '<div class="wide product-form-actions"><button class="btn-gold" type="submit">'+(creating?'Adicionar produto':'Salvar alterações')+'</button><button class="btn-outline" type="button" id="cancelProductEditor">Cancelar</button></div></form>';
  const form=document.getElementById('productForm'),feedback=document.getElementById('productFormMessage');
  const slugInput=form.elements.slug,nameInput=form.elements.nome;
  let slugManuallyEdited=Boolean(p.slug);
  const showFormMessage=(text,type)=>{feedback.textContent=text;feedback.className='wide form-feedback '+(type==='success'?'is-success':type==='info'?'is-info':'is-error');};
  document.getElementById('closeProductEditor').onclick=()=>{editor.innerHTML='';};
  document.getElementById('cancelProductEditor').onclick=()=>{editor.innerHTML='';};
  if(creating){
   nameInput.addEventListener('input',()=>{if(!slugManuallyEdited)slugInput.value=normalizeProductSlug(nameInput.value);});
   slugInput.addEventListener('input',()=>{slugManuallyEdited=true;const clean=normalizeProductSlug(slugInput.value);if(slugInput.value!==clean)slugInput.value=clean;});
   const imageInput=form.elements.imagem_file,previewWrap=document.getElementById('imagePreviewWrap'),preview=document.getElementById('productImagePreview');
   imageInput.addEventListener('change',()=>{
    const file=imageInput.files&&imageInput.files[0];previewWrap.hidden=!file;
    if(file){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);preview.dataset.objectUrl=URL.createObjectURL(file);preview.src=preview.dataset.objectUrl;document.getElementById('imageFileName').textContent=file.name+' · '+(file.size/1024).toFixed(0)+' KB';}
   });
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const submit=form.querySelector('[type="submit"]'),originalLabel=creating?'Adicionar produto':'Salvar alterações';
   try{
    const data=Object.fromEntries(new FormData(form));
    for(const key of ['ativo','destaque','lancamento'])data[key]=form.elements[key].checked;
    data.slug=normalizeProductSlug(data.slug);data.preco=Number(data.preco);
    data.preco_promocional=data.preco_promocional?Number(data.preco_promocional):null;
    if(!data.slug)throw Error('Informe um identificador válido para a peça.');
    if(data.preco_promocional!==null&&data.preco_promocional>=data.preco)throw Error('O preço promocional precisa ser menor que o preço de venda. Se não houver promoção, deixe esse campo vazio.');
    if(creating){
     const imageFile=form.elements.imagem_file.files&&form.elements.imagem_file.files[0];
     if(!imageFile)throw Error('Escolha a foto principal do produto.');
     if(imageFile.size>4*1024*1024)throw Error('A foto deve ter no máximo 4 MB.');
     if(!['image/jpeg','image/png','image/webp'].includes(imageFile.type))throw Error('Use uma foto JPG, PNG ou WebP.');
     const entries=String(data.estoque_tamanhos||'').split(/[,\n;]+/).map(value=>value.trim()).filter(Boolean);
     delete data.estoque_tamanhos;delete data.imagem_file;
     const sizes=entries.map(entry=>{
      const match=entry.match(/^([^:,]{1,20}):\s*(\d+)$/);
      if(!match)throw Error('Confira o estoque. Use o formato P: 9, M: 11, G: 15.');
      const quantidade=Number(match[2]),tamanho=match[1].trim().toUpperCase();
      if(!tamanho||!Number.isSafeInteger(quantidade)||quantidade>100000)throw Error('Confira os tamanhos e as quantidades informadas.');
      return{tamanho,estoque:quantidade};
     });
     if(!sizes.length)throw Error('Informe pelo menos um tamanho e a quantidade disponível.');
     if(new Set(sizes.map(size=>size.tamanho)).size!==sizes.length)throw Error('Cada tamanho deve aparecer apenas uma vez.');
     submit.disabled=true;submit.textContent='Enviando foto...';showFormMessage('Enviando a foto...','info');
     data.imagem_url=await uploadProductImage(imageFile);data.tamanhos=sizes;
    }
    submit.disabled=true;submit.textContent='Salvando...';showFormMessage('Salvando produto e atualizando o estoque...','info');
    await call('products'+(p.id?'/'+p.id:''),p.id?'PUT':'POST',data);
    await listing('products');message(creating?'Produto cadastrado com sucesso.':'Produto atualizado com sucesso.','success');
   }catch(error){
    showFormMessage(error.message||'Não foi possível salvar. Revise os dados e tente novamente.','error');
    message(error.message||'Não foi possível salvar o produto.','error');
    feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
   }finally{if(submit.isConnected){submit.disabled=false;submit.textContent=originalLabel;}}
  });
 }catch(error){
  message(error.message||'Não foi possível abrir o formulário.','error');
  const editor=document.getElementById('editor');if(editor)editor.innerHTML='<p class="form-feedback is-error">'+escapeHTML(error.message)+'</p>';
 }
}
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
 <article><span class="metric-icon green">✓</span><p>Compras pagas</p><strong>${d.paid_orders}</strong><small>Pagamentos aprovados no sistema</small></article>
 <article class="revenue-card"><span class="metric-icon">↗</span><p>Faturamento</p><strong>${currency(d.revenue)}</strong><small>Total de pagamentos aprovados</small></article>
 <article class="orders-card"><p>Andamento dos pedidos</p>${Object.entries(d.statuses||{}).length?Object.entries(d.statuses).map(([status,count])=>`<div class="admin-status"><span>${escapeHTML(statusLabels[status]||status)}</span><meter min="0" max="${Math.max(d.orders,1)}" value="${count}">${count}</meter><b>${count}</b></div>`).join(''):'<div class="empty-metric">Sua próxima venda começa na vitrine.</div>'}</article>
 <article class="revenue-chart-card">
   <div class="dashboard-card-head revenue-head"><div><p>Faturamento</p><small>Compras aprovadas no sistema</small></div><div class="revenue-head-actions"><div class="revenue-periods" role="group" aria-label="Período do gráfico">${Object.entries(revenuePeriodLabels).map(([key,label])=>`<button type="button" data-revenue-period="${key}" class="${key===selectedRevenuePeriod?'active':''}">${label}</button>`).join('')}</div><div class="chart-export-actions"><button type="button" data-export-revenue="csv">Baixar CSV</button><button type="button" data-export-revenue="xlsx">Baixar XLSX</button></div></div></div>
   <div id="revenueChart" class="annual-revenue-chart" role="img" aria-label="Gráfico de faturamento"><p class="loading-state">Carregando gráfico…</p></div>
   <div class="chart-summary"><p id="revenuePeriodTotal"></p><p id="revenuePeriodOrders"></p></div>
 </article>
 <article class="recent-purchases-card">
   <div class="dashboard-card-head"><div><p>Compras recentes</p><small>Últimas compras com pagamento confirmado</small></div><button class="row-action" id="viewAllOrders">Ver todos os pedidos ↗</button></div>
   <div class="recent-purchases">${recent.length?recent.map(order=>`<div class="purchase-row"><div><strong>${escapeHTML(order.codigo||'Pedido')}</strong><span>${escapeHTML(order.nome_cliente||'Cliente')}</span></div><div class="purchase-items">${purchaseItems(order.items)}</div><div><span class="payment-method">${escapeHTML(paymentLabels[order.metodo]||order.metodo||'Pagamento')}</span><small>${escapeHTML(dateTime(order.approved_at))}</small></div><strong class="purchase-total">${currency(order.total)}</strong></div>`).join(''):'<div class="empty-metric">As compras pagas aparecerão aqui automaticamente.</div>'}</div>
 </article>`;
}
async function downloadRevenue(format){
 if(!adminSession)throw Error('Entre na sua conta para acessar a administração.');
 const button=document.querySelector('[data-export-revenue="'+format+'"]');
 if(button)button.disabled=true;
 try{
  const response=await fetch('/api/admin/revenue/export?period='+encodeURIComponent(selectedRevenuePeriod)+'&format='+encodeURIComponent(format),{headers:{Authorization:'Bearer '+adminSession.access_token}});
  if(!response.ok){let data={};try{data=await response.json();}catch{}throw Error(data.detail||'Não foi possível baixar o arquivo.');}
  const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='faturamento-'+selectedRevenuePeriod+'.'+format;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  message('Arquivo baixado com sucesso.');
 }finally{if(button)button.disabled=false;}
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
  if(total)total.innerHTML=`<span>Faturamento · ${escapeHTML(data.label)}</span><strong>${currency(data.total)}</strong>`;
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
  document.querySelectorAll('[data-export-revenue]').forEach(button=>button.addEventListener('click',()=>downloadRevenue(button.dataset.exportRevenue).catch(error=>message(error.message))));
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
