const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let adminSession;try{adminSession=JSON.parse(localStorage.getItem('hw-session')||'null');}catch{}
const message=(m,type='info')=>{const el=document.getElementById('adminMessage');if(!el)return;el.textContent=m||'';el.dataset.state=type;};
async function call(path,method='GET',body){if(!adminSession)throw Error('Entre na sua conta para acessar a administração.');const r=await fetch('/api/admin/'+path,{method,headers:{Authorization:'Bearer '+adminSession.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{};}catch{data={detail:raw||'O servidor retornou uma resposta inválida.'};}if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Confira os campos e tente novamente.');return data;}
const names={products:'Produtos',product_sizes:'Estoque',orders:'Pedidos',profiles:'Clientes',payments:'Pagamentos',coupons:'Cupons','store-reviews':'Avaliações',analytics:'Dados & Insights'};
const fields={products:['nome','slug','preco','preco_promocional','ativo'],product_sizes:['product_id','tamanho','estoque'],orders:['codigo','nome_cliente','status','review_required','total','rastreio'],profiles:['nome_completo','telefone','total_spent','orders_count','role'],payments:['codigo_pedido','cliente','metodo','status','valor','criado_em'],coupons:['codigo','tipo','valor','ativo'],'store-reviews':['cliente','nota','comentario','approved','created_at']};
let currentRows=[],page=0,current='products',stockSearchRows=null,stockSearchRequest=0,stockSearchTimer=null;
const labels={nome:'Produto',slug:'Endereço da peça',preco:'Preço',preco_promocional:'Preço promocional',ativo:'Visibilidade',product_id:'Produto',tamanho:'Tamanho',estoque:'Unidades',grupo:'Grupo',url:'Imagem',ordem:'Ordem',codigo:'Pedido',codigo_pedido:'Pedido',nome_cliente:'Cliente',cliente:'Cliente',status:'Situação',review_required:'Conferência',total:'Total',rastreio:'Rastreamento',nome_completo:'Nome',telefone:'Telefone',total_spent:'Total gasto',orders_count:'Pedidos',role:'Perfil',order_id:'Pedido',metodo:'Método',valor:'Valor',tipo:'Tipo',nota:'Nota',comentario:'Comentário',approved:'Publicação',created_at:'Data',criado_em:'Data',tecido:'Tecido',caimento:'Caimento',destaque:'Em destaque',lancamento:'Lançamento'};
const statusLabels={aguardando_pagamento:'Aguardando pagamento',pagamento_aprovado:'Pagamento aprovado',preparando:'Em preparação',enviado:'Enviado',entregue:'Entregue',recebido:'Recebido pelo cliente',cancelado:'Cancelado',pending:'Pendente',in_process:'Em análise',authorized:'Autorizado',approved:'Aprovado',rejected:'Recusado',cancelled:'Cancelado',refunded:'Estornado',charged_back:'Em contestação',admin:'Administrador',cliente:'Cliente'};
const icons={products:'▧',product_sizes:'▤',orders:'▱',profiles:'◎',payments:'◈',coupons:'◇','store-reviews':'☆',analytics:'◉'};
let productNames={};
let paymentFilter='all',reviewFilter='all';
async function loadAllOrders(){
 const all=[];let offset=0,batch=[];
 do{batch=await call('orders?offset='+offset);if(!Array.isArray(batch))throw Error('Não foi possível carregar os pedidos para relacionar os pagamentos.');all.push(...batch);offset+=batch.length;}while(batch.length===100&&offset<50000);
 return all;
}
function renderAnalytics(){
 return call('analytics').then(data=>{
  const cards=[
   ['Pedidos registrados',data.orders_total,'#60a5fa'],
   ['Pedidos cancelados',data.cancelled_orders,'#f87171'],
   ['Pagamentos aprovados',data.approved_payments,'#4ade80'],
   ['Pagamentos cancelados',data.cancelled_payments,'#fb923c'],
   ['Recebido em pagamentos',currency(data.gross_received),'#f0d878'],
   ['Estornos registrados',currency(data.refunds_total),'#c4b5fd'],
   ['Receita líquida recebida',currency(data.net_received),'#2dd4bf']
  ];
  document.getElementById('adminContent').innerHTML='<div class="panel-heading"><div><p class="nav-caption">INTELIGÊNCIA COMERCIAL</p><h2>Dados & Insights <span class="count-badge">Dados reais</span></h2><p class="panel-subtitle">Indicadores calculados a partir dos pedidos e pagamentos registrados.</p></div><button class="btn-outline" id="refreshAnalytics">Atualizar dados ↻</button></div><div class="analytics-grid">'+cards.map(([label,value,color])=>'<article class="analytics-card" style="--metric-color:'+color+'"><span>'+escapeHTML(label)+'</span><strong>'+escapeHTML(value)+'</strong></article>').join('')+'</div><section class="analytics-products"><div class="dashboard-card-head"><div><h3>Produtos mais vendidos</h3><p>Quantidade de unidades em pedidos pagos e não cancelados</p></div></div>'+(data.top_products&&data.top_products.length?'<div class="analytics-product-list">'+data.top_products.map((item,index)=>'<div class="analytics-product-row"><span class="analytics-rank">'+(index+1)+'</span><div class="analytics-product-name"><strong>'+escapeHTML(item.produto)+'</strong><small>'+Number(item.quantidade||0)+' unidade(s) vendida(s)</small></div><strong>'+currency(item.faturamento)+'</strong></div>').join('')+'</div>':'<p class="empty-table">Ainda não há vendas confirmadas para classificar os produtos.</p>')+'</section><section class="analytics-payment-status"><h3>Resumo dos pagamentos</h3><div class="analytics-status-list">'+Object.entries({Aprovados:data.approved_payments,Pendentes:data.pending_payments,Cancelados:data.cancelled_payments,Recusados:data.rejected_payments,Estornados:data.refunded_payments}).map(([label,value])=>'<div><span>'+label+'</span><strong>'+Number(value||0)+'</strong></div>').join('')+'</div><p class="quiet">Um pedido cancelado não significa que o pagamento foi estornado. O valor líquido considera apenas estornos e contestações efetivamente registrados.</p></section>';
  document.getElementById('refreshAnalytics').onclick=()=>listing('analytics');
 }).catch(error=>{document.getElementById('adminContent').innerHTML='<div class="empty-table"><h2>Não foi possível carregar os indicadores</h2><p>'+escapeHTML(error.message)+'</p><button class="btn-outline" id="retryAnalytics">Tentar novamente</button></div>';document.getElementById('retryAnalytics').onclick=()=>listing('analytics');});
}
function enhancePayments(){
 const rows=currentRows,counts={};let approvedTotal=0;
 rows.forEach(row=>{counts[row.status]=(counts[row.status]||0)+1;if(row.status==='approved')approvedTotal+=Number(row.valor||0);});
 const metrics=[['Registros',rows.length,'#60a5fa'],['Aprovados',counts.approved||0,'#4ade80'],['Em análise',Number(counts.pending||0)+Number(counts.in_process||0)+Number(counts.authorized||0),'#fbbf24'],['Cancelados',counts.cancelled||0,'#f87171'],['Valor aprovado',currency(approvedTotal),'#f0d878']];
 document.getElementById('resourceInsights').innerHTML='<div class="payment-metric-grid">'+metrics.map(([label,value,color])=>'<article style="--metric-color:'+color+'"><span>'+label+'</span><strong>'+escapeHTML(value)+'</strong></article>').join('')+'</div><div class="payment-filter-row">'+[['all','Todos'],['approved','Aprovados'],['pending','Pendentes'],['in_process','Em análise'],['cancelled','Cancelados'],['rejected','Recusados'],['refunded','Estornados']].map(([key,label])=>'<button type="button" data-payment-filter="'+key+'" aria-pressed="'+(paymentFilter===key)+'">'+label+' <b>'+(key==='all'?rows.length:counts[key]||0)+'</b></button>').join('')+'</div>';
 const apply=()=>{const q=(document.getElementById('adminSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');let shown=0;document.querySelectorAll('#adminContent tbody tr').forEach(tr=>{const status=tr.dataset.paymentStatus;const ok=(paymentFilter==='all'||status===paymentFilter||(paymentFilter==='pending'&&['pending','authorized'].includes(status)))&&tr.dataset.search.includes(q);tr.hidden=!ok;if(ok)shown++;});const empty=document.getElementById('emptyTable');if(empty){empty.hidden=shown>0;empty.textContent='Nenhum pagamento encontrado com esses filtros.';}const count=document.querySelector('#adminContent .table-tools>span');if(count)count.textContent='Mostrando '+shown+' de '+rows.length+' pagamentos';document.querySelectorAll('[data-payment-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paymentFilter===paymentFilter)));};
 document.getElementById('adminSearch').oninput=apply;document.querySelectorAll('[data-payment-filter]').forEach(b=>b.onclick=()=>{paymentFilter=b.dataset.paymentFilter;apply();});apply();
}
function enhanceStoreReviews(){
 const rows=currentRows,approved=rows.filter(r=>r.approved).length;
 document.getElementById('resourceInsights').innerHTML='<div class="review-summary-grid"><article><span>Total de avaliações</span><strong>'+rows.length+'</strong></article><article><span>Publicadas</span><strong>'+approved+'</strong></article><article><span>Aguardando análise</span><strong>'+Math.max(0,rows.length-approved)+'</strong></article></div><p class="quiet">As avaliações só podem ser enviadas por clientes que confirmaram o recebimento de um pedido.</p>';
 const apply=()=>{const q=(document.getElementById('adminSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');let shown=0;document.querySelectorAll('#adminContent tbody tr').forEach(tr=>{const ok=(reviewFilter==='all'||tr.dataset.reviewApproved===reviewFilter)&&tr.dataset.search.includes(q);tr.hidden=!ok;if(ok)shown++;});const empty=document.getElementById('emptyTable');if(empty){empty.hidden=shown>0;empty.textContent='Nenhuma avaliação encontrada.';}const count=document.querySelector('#adminContent .table-tools>span');if(count)count.textContent='Mostrando '+shown+' de '+rows.length+' avaliações';};
 document.getElementById('adminSearch').oninput=apply;apply();
}

function cellValue(key,value){if(value===null||value===undefined||value==='')return '<span class="muted">—</span>';if(['preco','preco_promocional','total','valor','total_spent'].includes(key))return currency(value);if(key==='created_at'||key==='criado_em')return escapeHTML(dateTime(value));if(key==='orders_count')return `<span class="count-badge">${Number(value)||0}</span>`;if(key==='ativo')return `<span class="status-pill ${value?'positive':'neutral'}">${value?'Publicado':'Oculto'}</span>`;if(key==='approved')return `<span class="status-pill ${value?'positive':'warning'}">${value?'Publicada':'Aguardando análise'}</span>`;if(key==='review_required')return value?'<span class="status-pill warning">Revisar estoque</span>':'—';if(key==='status'||key==='role')return `<span class="status-pill ${key==='status'?'payment-'+escapeHTML(value):''}">${escapeHTML(statusLabels[value]||value)}</span>`;if(key==='metodo')return escapeHTML(({pix:'Pix',cartao:'Cartão',boleto:'Boleto'}[value]||value));if(key==='product_id')return escapeHTML(productNames[value]||value);return escapeHTML(value);}
async function listing(resource,offset=0){try{
 current=resource;page=offset;document.querySelectorAll('[data-resource]').forEach(b=>{const active=b.dataset.resource===resource;b.classList.toggle('active',active);active?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});
 if(resource==='analytics'){await renderAnalytics();message('');return;}
 if(resource==='profiles')currentRows=await call('customers/summary');
 else if(resource==='payments'){
  const [payments,orders]=await Promise.all([call('payments?offset='+offset),loadAllOrders()]);
  const byId=new Map(orders.map(o=>[String(o.id),o]));
  currentRows=(payments||[]).map(p=>{const o=byId.get(String(p.order_id))||{};return {...p,codigo_pedido:o.codigo||String(p.order_id||'').slice(0,8),cliente:o.nome_cliente||'Cliente'};});
 }else if(resource==='store-reviews')currentRows=await call('store-reviews?offset='+offset);
 else currentRows=await call(resource+'?offset='+offset);
 if(resource==='orders'&&offset===0){let batch=currentRows.slice(),nextOffset=batch.length;while(batch.length===100&&nextOffset<10000){batch=await call(resource+'?offset='+nextOffset);currentRows.push(...batch);nextOffset+=batch.length;}}
 if(resource==='products')currentRows.forEach(p=>productNames[p.id]=p.nome);
 const cols=fields[resource];document.getElementById('adminContent').innerHTML=`<div class="panel-heading"><div><p class="nav-caption">GERENCIAR COLEÇÃO E VENDAS</p><h2>${names[resource]} <span class="count-badge">${currentRows.length}</span></h2></div>${resource==='products'?'<button class="btn-gold" id="newProduct">+ Adicionar produto</button>':''}</div><div class="table-tools"><label>Buscar nesta página<input type="search" id="adminSearch" placeholder="Digite para filtrar…"></label><span>Mostrando ${currentRows.length} registros</span></div><div id="resourceInsights"></div><div id="editor"></div><div class="admin-table"><table><thead><tr>${cols.map(c=>`<th scope="col">${labels[c]||escapeHTML(c)}</th>`).join('')}${['products','product_sizes','store-reviews'].includes(resource)?'<th scope="col">Ações</th>':resource==='profiles'?'<th scope="col">WhatsApp</th>':''}</tr></thead><tbody>${currentRows.map((r,i)=>`<tr data-search="${escapeHTML(cols.map(c=>c==='product_id'?(productNames[r[c]]||r[c]):r[c]).join(' ').toLocaleLowerCase('pt-BR'))}" ${resource==='payments'?`data-payment-status="${escapeHTML(r.status)}"`:''} ${resource==='store-reviews'?`data-review-approved="${r.approved?'true':'false'}"`:''}>${cols.map(c=>`<td>${cellValue(c,r[c])}</td>`).join('')}${resource==='products'?`<td><button class="row-action" data-edit="${i}">Editar ↗</button></td>`:resource==='product_sizes'?`<td><button class="row-action" data-stock="${i}">Ajustar estoque</button></td>`:resource==='store-reviews'?`<td><button class="row-action" data-review-toggle="${i}" data-review-id="${escapeHTML(r.id)}">${r.approved?'Ocultar':'Publicar'}</button></td>`:resource==='profiles'?`<td>${String(r.telefone||'').replace(/\\D/g,'')?`<a class="row-action whatsapp-action" href="https://wa.me/${String(r.telefone).replace(/\\D/g,'')}" target="_blank" rel="noopener">Abrir WhatsApp ↗</a>`:'<span class="muted">Sem telefone</span>'}</td>`:''}</tr>`).join('')}</tbody></table></div><p id="emptyTable" class="empty-table" ${currentRows.length?'hidden':''}>${currentRows.length?'Nenhum resultado para esta busca.':'Ainda não há registros por aqui.'}</p><div class="table-footer"><span>Página ${Math.floor(offset/100)+1}</span><div><button class="btn-outline" id="previous" ${offset===0?'disabled':''}>← Anterior</button><button class="btn-outline" id="next" ${resource==='orders'||currentRows.length<100?'disabled':''}>Próxima →</button></div></div>`;
 if(resource==='payments')enhancePayments();
 if(resource==='store-reviews')enhanceStoreReviews();
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
document.addEventListener('click',async e=>{
 const reviewButton=e.target.closest('[data-review-toggle]');
 if(reviewButton){
  const row=currentRows[Number(reviewButton.dataset.reviewToggle)];if(!row)return;
  reviewButton.disabled=true;
  try{await call('store-reviews/'+encodeURIComponent(row.id),'PATCH',{approved:!row.approved});await listing('store-reviews',page);message(row.approved?'Avaliação ocultada.':'Avaliação publicada.','success');}
  catch(error){message(error.message,'error');reviewButton.disabled=false;}
 }
});
document.addEventListener('click',e=>{const a=e.target.closest('[data-edit]');if(a)editProduct(currentRows[Number(a.dataset.edit)]);const s=e.target.closest('[data-stock]');if(s){const row=currentRows[Number(s.dataset.stock)];document.getElementById('editor').innerHTML=`<form id="stockForm"><label>Estoque para ${escapeHTML(row.tamanho)}<input name="stock" type="number" min="0" step="1" value="${row.estoque}" required></label><button class="btn-gold">Salvar estoque</button></form>`;document.getElementById('stockForm').onsubmit=async ev=>{ev.preventDefault();try{await call('sizes/'+row.id,'PUT',{product_id:row.product_id,tamanho:row.tamanho,estoque:Number(new FormData(ev.target).get('stock'))});listing('product_sizes');}catch(err){message(err.message);}};}});
document.addEventListener('click',e=>{const button=e.target.closest('[data-order]');if(!button)return;
 const order=currentRows[Number(button.dataset.order)];
 const next={pagamento_aprovado:'preparando',preparando:'enviado',enviado:'entregue',entregue:'recebido'}[order.status];if(!next)return;
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
