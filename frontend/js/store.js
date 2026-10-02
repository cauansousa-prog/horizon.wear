const money = value => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeImage = value => {if(!value)return '/img/logo-icone.png';try {const u=new URL(value,location.origin);return ['https:','http:'].includes(u.protocol)?esc(u.href):'/img/logo-icone.png';} catch{return '/img/logo-icone.png';}};
let products=[], categories=[], cart=[], activeFilter='todos', searchQuery='', session=null, refreshPromise=null, mutation=Promise.resolve(), catalogState='loading';
try {session=JSON.parse(localStorage.getItem('hw-session')||'null');} catch {localStorage.removeItem('hw-session');}
const storageCart=()=>{try {const v=JSON.parse(localStorage.getItem('hw-cart')||'[]');return Array.isArray(v)?v.filter(i=>typeof i.size_id==='string'&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=99).slice(0,100):[];}catch{return [];}};
function saveSession(value){session=value;value?localStorage.setItem('hw-session',JSON.stringify(value)):localStorage.removeItem('hw-session');}
async function api(path,options={},retry=true){
  const publicRead=(!options.method||options.method==='GET')&&/^\/api\/(products(?:[/?]|$)|categories(?:[/?]|$)|reviews\/)/.test(path);
  if(!publicRead && session?.refresh_token && session.expires_at*1000<Date.now()+30000 && !path.startsWith('/api/auth/')) {
    if(!refreshPromise) refreshPromise=fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}).then(async r=>{if(!r.ok)throw Error('Sua sessão expirou. Entre novamente.');saveSession(await r.json());}).finally(()=>refreshPromise=null);
    try{await refreshPromise;}catch(e){saveSession(null);throw e;}
  }
  const headers={'Content-Type':'application/json',...(!publicRead&&session?{Authorization:`Bearer ${session.access_token}`}:{})};
  const controller=publicRead?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),15000):null;
  let r;try{r=await fetch(path,{...options,...(controller?{signal:controller.signal}:{}),headers:{...headers,...options.headers}});}catch(e){if(e.name==='AbortError')throw Error('A coleção demorou para responder. Tente novamente.');throw e;}finally{if(timer)clearTimeout(timer);}
  let data;try{data=await r.json();}catch{data=null;}
  if(!r.ok){if(r.status===401&&!path.startsWith('/api/auth/'))saveSession(null);throw Error(typeof data?.detail==='string'?data.detail:'Não foi possível concluir. Confira os dados e tente novamente.');}
  return data;
}
function showToast(message){const t=document.getElementById('toast');document.getElementById('toastMsg').textContent=message;t.classList.add('show');clearTimeout(window.hwToastTimer);window.hwToastTimer=setTimeout(()=>t.classList.remove('show'),4500);}
function showPage(page,filter){
 document.querySelectorAll('main[id^="page-"]').forEach(el=>el.hidden=true);
 document.querySelectorAll('main[id^="page-"]').forEach(el=>el.style.display='none');
 const el=document.getElementById('page-'+page);if(!el)return;el.hidden=false;el.style.display='block';
 if(page!=='produto'){history.replaceState(null,'','/#'+page);document.title='Horizon Wear | '+({home:'Moda masculina premium',produtos:'Coleção',conta:'Minha conta',cadastro:'Criar conta',checkout:'Finalizar compra',sobre:'Sobre nós',contato:'Contato',privacidade:'Privacidade',trocas:'Trocas e devoluções'}[page]||'Coleção');}
 document.querySelectorAll('#navList li').forEach(li=>li.classList.toggle('active',li.dataset.page===page));
 toggleNavigation(false);window.scrollTo(0,0);
 if(page==='produtos'){if(filter)activeFilter=filter;document.getElementById('catalogSearch').value=searchQuery;renderProducts();}
 if(page==='conta')renderAccount();
 if(page==='cadastro')renderSignup();
 if(page==='checkout')openCheckout(true);
}
function goHome(){location.href='/';}
function toggleSearch(){document.getElementById('searchBar').classList.toggle('open');document.getElementById('searchInput').focus();}
function handleSearchInput(value){searchQuery=value.trim().toLocaleLowerCase('pt-BR');showPage('produtos');}
function handleCatalogSearch(value){searchQuery=value.trim().toLocaleLowerCase('pt-BR');renderProducts();}
function clearCatalogFilters(){activeFilter='todos';searchQuery='';document.getElementById('catalogSearch').value='';document.getElementById('searchInput').value='';document.getElementById('sizeFilter').value='';document.getElementById('maxPrice').value='';document.getElementById('availableFilter').checked=false;renderProducts();}
function setFilter(key){activeFilter=key;renderProducts();}
function renderFilters(){document.getElementById('filtersRow').innerHTML=['todos','roupas','calcados','relogios','acessorios'].map((key,i)=>`<button class="filter-chip ${key===activeFilter?'active':''}" data-filter="${key}">${['Todos','Roupas','Calçados','Relógios','Acessórios'][i]}</button>`).join('');}
function price(p){return p.preco_promocional ?? p.preco;}
function imageFor(p){return [...(p.product_images||[])].sort((a,b)=>a.ordem-b.ordem)[0]?.url||'/img/logo-icone.png';}
function productCardHTML(p){const available=p.product_sizes?.some(s=>s.estoque>0);return `<article class="product-card"><a class="product-media" href="/produto/${encodeURIComponent(p.slug)}">${p.lancamento?'<span class="tag-novo">NOVA COLEÇÃO</span>':''}<img loading="lazy" decoding="async" src="${safeImage(imageFor(p))}" alt="${esc(p.nome)}" width="500" height="600"></a><div class="product-info"><span class="cat">${esc(p.categories?.nome)}</span><h3><a href="/produto/${encodeURIComponent(p.slug)}">${esc(p.nome)}</a></h3><div class="price-row"><span class="price">${p.preco_promocional!=null?`<del>${money(p.preco)}</del> `:''}${money(price(p))}</span></div><span class="stock-note ${available?'available':''}">${available?'Disponível em estoque':'Indisponível no momento'}</span><a class="add-cart-btn" href="/produto/${encodeURIComponent(p.slug)}">${available?'Escolher tamanho':'Ver detalhes'} <span aria-hidden="true">↗</span></a></div></article>`;}
function renderProducts(){
 if(catalogState!=='ready'){document.getElementById('resultsCount').textContent=catalogState==='loading'?'Carregando coleção…':'Coleção temporariamente indisponível';document.getElementById('productGrid').innerHTML=catalogState==='loading'?'<p class="catalog-loading" role="status">Carregando produtos…</p>':'<div class="catalog-error" role="alert"><p>Não foi possível carregar a coleção agora.</p><button class="btn-outline" onclick="loadCatalog()">Tentar novamente</button></div>';document.getElementById('emptyState').style.display='none';return;}
 renderFilters();let list=products.filter(p=>(activeFilter==='todos'||p.categories?.grupo===activeFilter||p.categories?.slug===activeFilter)&&(!searchQuery||`${p.nome} ${p.descricao} ${p.categories?.nome}`.toLocaleLowerCase('pt-BR').includes(searchQuery)));
 const size=document.getElementById('sizeFilter')?.value;const available=document.getElementById('availableFilter')?.checked;const max=Number(document.getElementById('maxPrice')?.value||0);
 if(size)list=list.filter(p=>p.product_sizes?.some(s=>s.tamanho===size));if(available)list=list.filter(p=>p.product_sizes?.some(s=>s.estoque>0));if(max)list=list.filter(p=>Number(price(p))<=max);
 const sort=document.getElementById('sortProducts')?.value;if(sort==='price')list.sort((a,b)=>price(a)-price(b));if(sort==='price-desc')list.sort((a,b)=>price(b)-price(a));if(sort==='sales')list.sort((a,b)=>b.vendas_total-a.vendas_total);
 document.getElementById('resultsCount').textContent=`${list.length} ${list.length===1?'peça':'peças'}`;document.getElementById('productGrid').innerHTML=list.map(productCardHTML).join('');document.getElementById('emptyState').style.display=list.length?'none':'block';
}
async function loadCatalog(){
 catalogState='loading';
 const track=document.getElementById('arrivalsTrack');track.setAttribute('aria-busy','true');
 track.innerHTML='<p class="catalog-loading" role="status">Carregando sua próxima escolha…</p>';
 try{
  const categoryRequest=api('/api/categories').catch(()=>[]);
  const loaded=[];let offset=0;while(true){const page=await api('/api/products?offset='+offset);if(!Array.isArray(page))throw Error('Não foi possível carregar a coleção.');loaded.push(...page);if(page.length<100)break;offset+=100;}
  products=loaded;categories=await categoryRequest;catalogState='ready';
  if(!categories.length)categories=[...new Map(products.filter(p=>p.categories).map(p=>[p.categories.id,{...p.categories,imagem_url:imageFor(p)}])).values()];
  document.getElementById('catGrid').innerHTML=categories.map(c=>`<a class="cat-card" href="#produtos" data-category="${esc(c.slug)}"><img loading="lazy" src="${safeImage(c.imagem_url)}" alt="${esc(c.nome)}" width="400" height="300"><div class="cat-overlay"><h3>${esc(c.nome)}</h3><span>EXPLORAR ↗</span></div></a>`).join('');
  const selected=[...products].sort((a,b)=>Number(b.destaque)-Number(a.destaque));
  track.innerHTML=selected.slice(0,8).map(productCardHTML).join('')||'<p class="catalog-loading">Nossa coleção está sendo preparada. Volte em breve.</p>';
  document.getElementById('sizeFilter').innerHTML='<option value="">Todos os tamanhos</option>'+[...new Set(products.flatMap(p=>(p.product_sizes||[]).map(s=>s.tamanho)))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(s=>`<option>${esc(s)}</option>`).join('');renderProducts();
 }catch(e){catalogState='error';const message='<div class="catalog-error" role="alert"><p>Não foi possível carregar a coleção agora.</p><button class="btn-outline" onclick="loadCatalog()">Tentar novamente</button></div>';track.innerHTML=message;renderProducts();}
 finally{track.setAttribute('aria-busy','false');}
}
async function renderProduct(slug){
 showPage('produto');const el=document.getElementById('productDetail');el.textContent='Carregando a peça…';
 try{const p=await api('/api/products/'+encodeURIComponent(slug));document.title=p.nome+' | Horizon Wear';
 el.innerHTML=`<div class="detail-gallery">${[...(p.product_images||[])].sort((a,b)=>a.ordem-b.ordem).map(i=>`<img src="${safeImage(i.url)}" alt="${esc(p.nome)}" loading="lazy">`).join('')||`<img src="/img/logo-icone.png" alt="Horizon Wear">`}</div><div class="detail-copy"><a class="detail-back" href="/#produtos">← Voltar à coleção</a><p class="eyebrow">${esc(p.categories?.nome)}</p><h1>${esc(p.nome)}</h1><p class="detail-price">${p.preco_promocional!=null?`<del>${money(p.preco)}</del> `:''}${money(price(p))}</p><p>${esc(p.descricao)}</p><dl><dt>Tecido</dt><dd>${esc(p.tecido||'Consulte nossa equipe')}</dd><dt>Caimento</dt><dd>${esc(p.caimento||'Consulte nossa equipe')}</dd></dl><form id="addProduct"><fieldset class="size-picker"><legend>Escolha o tamanho</legend><div class="size-options">${p.product_sizes.map(s=>`<label class="size-option"><input type="radio" name="size" value="${esc(s.id)}" required ${s.estoque<1?'disabled':''}><span>${esc(s.tamanho)}</span>${s.estoque<1?'<small>Esgotado</small>':''}</label>`).join('')}</div></fieldset><label>Quantidade<input name="quantity" type="number" min="1" max="99" value="1" required></label><button class="btn-gold" ${p.product_sizes.every(s=>s.estoque<1)?'disabled':''}>Adicionar ao carrinho</button></form><p class="quiet">Disponibilidade confirmada ao adicionar. Frete calculado no checkout.</p><div id="productReviews"></div></div>`;
 try{const reviews=await api('/api/reviews/'+p.id);document.getElementById('productReviews').innerHTML='<h3>Avaliações</h3>'+(reviews.length?reviews.map(r=>`<article class="order-row"><strong>${r.nota}/5</strong><p>${esc(r.comentario)}</p></article>`).join(''):'<p>Esta peça ainda não recebeu avaliações.</p>');}catch{document.getElementById('productReviews').textContent='Avaliações indisponíveis no momento.';}
 document.getElementById('addProduct').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit],button.btn-gold');if(button.disabled)return;button.disabled=true;button.textContent='Adicionando…';try{const f=new FormData(e.target),id=f.get('size'),qty=Number(f.get('quantity')),old=cart.find(i=>i.size_id===id)?.quantity||0;await changeItem(id,old+qty);}finally{button.disabled=false;button.textContent='Adicionar ao carrinho';}};
 }catch(e){el.textContent=e.message;}
}
function toggleCart(open){
 const panel=document.getElementById('cartSidebar'),overlay=document.getElementById('overlay');if(!panel||!overlay)return;
 const shouldOpen=Boolean(open);
 if(shouldOpen)panel.inert=false;
 panel.classList.toggle('open',shouldOpen);overlay.classList.toggle('open',shouldOpen);document.body.classList.toggle('cart-open',shouldOpen);
 if(shouldOpen){toggleNavigation(false);renderCart().catch(e=>showToast(e.message));requestAnimationFrame(()=>panel.querySelector('.cart-header button')?.focus());}
 else{if(panel.contains(document.activeElement))document.querySelector('[aria-label="Carrinho"]')?.focus();panel.inert=true;}
}
function changeItem(id,quantity){mutation=mutation.catch(()=>{}).then(async()=>{
 try{const next=cart.filter(i=>i.size_id!==id);if(quantity>0)next.push({size_id:id,quantity});
 if(quantity>0)await api('/api/cart/quote',{method:'POST',body:JSON.stringify({items:next})});
 if(session)await api('/api/cart/items/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({size_id:id,quantity:Math.max(0,quantity)})});
 cart=next;if(!session)localStorage.setItem('hw-cart',JSON.stringify(cart));await renderCart();showToast(quantity?'Carrinho atualizado.':'Item removido.');
 }catch(e){showToast(e.message);}});return mutation;}
async function renderCart(){
 document.getElementById('cartCount').textContent=cart.reduce((a,i)=>a+i.quantity,0);const el=document.getElementById('cartItems');document.getElementById('cartFooter').style.display=cart.length?'block':'none';
 if(!cart.length){el.innerHTML='<div class="cart-empty"><p>Seu próximo favorito está na coleção.</p><button class="btn-outline" onclick="toggleCart(false);showPage(\'produtos\')">Explorar peças</button></div>';return;}
 try{const q=await api('/api/cart/quote',{method:'POST',body:JSON.stringify({items:cart})});
 el.innerHTML=q.items.map(i=>`<article class="cart-item"><img src="${safeImage(imageFor(i.product))}" alt="${esc(i.product.nome)}"><div class="cart-item-info"><h5>${esc(i.product.nome)}</h5><span>${esc(i.size)}</span><div class="qty-row"><button aria-label="Diminuir quantidade" data-qty="${i.quantity-1}" data-size="${esc(i.size_id)}">−</button><span>${i.quantity}</span><button aria-label="Aumentar quantidade" data-qty="${i.quantity+1}" data-size="${esc(i.size_id)}" ${i.quantity>=i.stock?'disabled':''}>+</button></div><button class="text-button" data-qty="0" data-size="${esc(i.size_id)}">Remover</button></div><span class="cart-item-price">${money(i.subtotal)}</span></article>`).join('');document.getElementById('cartTotal').textContent=money(q.subtotal);
 }catch(e){el.innerHTML=`<p>${esc(e.message)}</p><p>Remova o item indisponível para continuar.</p>`+cart.map(i=>`<button class="btn-outline" data-size="${esc(i.size_id)}" data-qty="0">Remover item (${i.quantity} un.)</button>`).join('');document.getElementById('cartFooter').style.display='none';}
}
async function loadCart(){
 if(session){try{cart=await api('/api/cart');}catch(e){if(session)throw e;cart=storageCart();}}
 else cart=storageCart();
 await renderCart();
}
async function mergeCart(){
 const guest=storageCart();const remote=await api('/api/cart');
 for(const item of guest){const qty=Math.max(item.quantity,remote.find(r=>r.size_id===item.size_id)?.quantity||0);await api('/api/cart/items/'+item.size_id,{method:'PUT',body:JSON.stringify({...item,quantity:qty})});}
 localStorage.removeItem('hw-cart');await loadCart();
}
function input(label,name,type='text',required=true){return `<label>${label}<input name="${name}" type="${type}" ${required?'required':''} ${type==='password'?'minlength="8" autocomplete="current-password"':''}></label>`;}
async function renderAccount(){
 const el=document.getElementById('accountContent');
 document.getElementById('accountTitle').hidden=!session;
 if(!session){el.innerHTML=authLayout(false)+deviceOrdersHTML();
 const login=document.getElementById('loginForm');login.onsubmit=async e=>{e.preventDefault();const button=login.querySelector('[type="submit"]');button.disabled=true;try{const values=Object.fromEntries(new FormData(login));values.email=String(values.email||'').trim().toLowerCase();const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify(values)});saveSession(data);try{await mergeCart();}catch(err){showToast('Você entrou. '+err.message);}renderAccount();}catch(err){showToast(err.message);}finally{button.disabled=false;}};
 document.getElementById('recoverPassword').onclick=async()=>{try{const email=new FormData(login).get('email');if(!email)return showToast('Preencha seu e-mail primeiro.');const result=await api('/api/auth/recover',{method:'POST',body:JSON.stringify({email})});showToast(result.message);}catch(err){showToast(err.message);}};return;}
 el.textContent='Carregando sua conta…';try{const [profile,addresses,orders]=await Promise.all([api('/api/users/me'),api('/api/addresses'),api('/api/orders')]);
 el.innerHTML=`<div class="account-heading"><h2>Olá, ${esc(profile.full_name)}</h2><button id="logout" class="text-button">Sair da conta</button></div><div class="account-grid"><form id="profileForm"><h3>Seus dados</h3><label>Nome<input name="nome_completo" value="${esc(profile.full_name)}" minlength="2" maxlength="120" autocomplete="name" required></label><label>Telefone<input name="telefone" value="${esc(profile.phone)}" type="tel" maxlength="25" autocomplete="tel"></label><button class="btn-outline">Salvar dados</button></form><section><h3>Seus endereços</h3>${addresses.length?addresses.map(a=>`<article class="address-row"><strong>${esc(a.destinatario)}</strong><p>${esc(a.rua)}, ${esc(a.numero)} · ${esc(a.cidade)}/${esc(a.estado)}</p><button class="text-button" data-delete-address="${esc(a.id)}">Remover</button></article>`).join(''):'<p>Adicione um endereço para facilitar suas próximas compras.</p>'}<details><summary>Adicionar endereço</summary><form id="addressForm">${[['Destinatário','destinatario'],['CEP (somente números)','cep'],['Rua','rua'],['Número','numero'],['Bairro','bairro'],['Cidade','cidade'],['Estado (UF)','estado'],['Telefone','telefone']].map(([a,b])=>input(a,b)).join('')}${input('Complemento','complemento','text',false)}<button class="btn-gold">Salvar endereço</button></form></details></section></div><section class="orders-list"><h2>Seus pedidos</h2>${orders.length?orders.map(o=>`<article class="order-row"><strong>${esc(o.codigo)}</strong><p>${esc((o.payments||[]).some(p=>p.status==='approved')?'Pagamento aprovado':(o.review_required?'Pagamento em revisão de estoque':(({recebido:'Pedido recebido',pagamento_aprovado:'Pagamento aprovado',preparando:'Preparando pedido',enviado:'Pedido enviado',entregue:'Pedido entregue',cancelado:'Pedido cancelado'})[o.status]||o.status)))} · ${money(o.total)}</p><p>${new Date(o.created_at).toLocaleDateString('pt-BR')}</p>${o.order_items.map(i=>`<p>${esc(i.nome_produto)} · ${esc(i.tamanho)} · ${i.quantidade} un.</p>`).join('')}${o.rastreio?`<p>Rastreio: ${esc(o.rastreio)}</p>`:''}</article>`).join(''):'<p>Seus pedidos aparecerão aqui depois da primeira compra.</p>'}</section>${profile.role==='admin'?'<a class="btn-outline" href="/admin.html">Abrir administração</a>':''}`;
 el.insertAdjacentHTML('beforeend',deviceOrdersHTML());
 document.getElementById('logout').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST'});}catch{}localStorage.setItem('hw-cart',JSON.stringify(cart));saveSession(null);cart=storageCart();renderCart();renderAccount();};
 document.getElementById('profileForm').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button');form.querySelectorAll('input').forEach(i=>i.value=i.value.trim());if(!form.reportValidity())return;button.disabled=true;button.textContent='Salvando…';try{await api('/api/users/me',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await renderAccount();const saved=document.getElementById('profileForm');if(saved)saved.insertAdjacentHTML('beforeend','<p role="status" class="quiet">Nome e telefone salvos.</p>');showToast('Nome e telefone salvos.');}catch(err){showToast(err.message);}finally{button.disabled=false;button.textContent='Salvar dados';}};
 document.getElementById('addressForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/addresses',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});renderAccount();}catch(err){showToast(err.message);}};
 }catch(e){if(!session){renderAccount();return;}el.textContent=e.message;}
}
document.addEventListener('click',async e=>{
 const f=e.target.closest('[data-filter]');if(f)setFilter(f.dataset.filter);
 const c=e.target.closest('[data-category]');if(c){e.preventDefault();showPage('produtos',c.dataset.category);}
 const q=e.target.closest('[data-size][data-qty]');if(q)changeItem(q.dataset.size,Number(q.dataset.qty));
 const a=e.target.closest('[data-delete-address]');if(a){try{await api('/api/addresses/'+a.dataset.deleteAddress,{method:'DELETE'});renderAccount();}catch(err){showToast(err.message);}}
});
async function startStore(){
 const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('access_token')){saveSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});const recovery=hash.get('type')==='recovery';history.replaceState(null,'','/#conta');if(recovery){showPage('conta');document.getElementById('accountContent').innerHTML=`<form id="newPassword">${input('Nova senha','password','password')}<button class="btn-gold">Salvar senha</button></form>`;document.getElementById('newPassword').onsubmit=async e=>{e.preventDefault();try{await api('/api/auth/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});renderAccount();showToast('Senha atualizada.');}catch(err){showToast(err.message);}};await loadCatalog();await loadCart();return;}}
 await loadCatalog();try{await loadCart();}catch(e){showToast(e.message);}
 if(location.pathname.startsWith('/produto/'))await renderProduct(decodeURIComponent(location.pathname.split('/').pop()));else showPage(['produtos','sobre','privacidade','trocas','contato','conta','cadastro','checkout'].includes(location.hash.slice(1))?location.hash.slice(1):'home');
}
function toggleNavigation(open){
 const expanded=typeof open==='boolean'?open:!document.body.classList.contains('nav-open');
 document.body.classList.toggle('nav-open',expanded);
 const button=document.querySelector('.nav-toggle');button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'Fechar menu':'Abrir menu');
}
document.addEventListener('click',e=>{if(!e.target.closest('header.main'))toggleNavigation(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.body.classList.contains('cart-open')){toggleCart(false);document.querySelector('[aria-label="Carrinho"]').focus();}else if(document.body.classList.contains('nav-open')){toggleNavigation(false);document.querySelector('.nav-toggle').focus();}}});
window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(document.getElementById('page-'+page))showPage(page);});
window.addEventListener('storage',e=>{if(e.key==='hw-cart'&&!session){cart=storageCart();renderCart();}});
function authLayout(signup){return `<div class="auth-layout"><aside class="auth-visual"><div><p class="eyebrow">HORIZON WEAR</p><h2>Seu estilo.<br>Sua essência.</h2><p>Peças que acompanham o seu jeito de viver.</p></div></aside><div class="auth-panel"><a class="auth-back" href="/#home" onclick="showPage('home');return false;">← Voltar à loja</a><p class="eyebrow">${signup?'FAÇA PARTE':'BEM-VINDO DE VOLTA'}</p><h1>${signup?'Crie sua conta.':'Seu próximo horizonte começa aqui.'}</h1><p class="auth-intro">${signup?'Salve seus dados e acompanhe cada pedido em um só lugar.':'Entre para acompanhar seus pedidos e suas peças favoritas.'}</p><form id="${signup?'signupForm':'loginForm'}">${signup?input('Nome completo','nome_completo'):''}${input('E-mail','email','email')}${input('Senha','password','password')}${signup?'<p class="quiet">Use pelo menos 8 caracteres.</p>':'<button type="button" class="text-button" id="recoverPassword">Esqueci minha senha</button>'}<button type="submit" class="btn-gold auth-submit">${signup?'Criar minha conta':'Entrar'} <span aria-hidden="true">→</span></button></form><p class="auth-switch">${signup?'Já tem uma conta?':'Ainda não tem uma conta?'} <a href="#${signup?'conta':'cadastro'}" onclick="showPage('${signup?'conta':'cadastro'}');return false;">${signup?'Entrar':'Criar conta'}</a></p></div></div>`;}
function renderSignup(){
 if(session){showPage('conta');return;}
 document.getElementById('signupContent').innerHTML=authLayout(true);
 const form=document.getElementById('signupForm');form.elements.password.autocomplete='new-password';form.elements.nome_completo.autocomplete='name';
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{const data=await api('/api/auth/signup',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});if(data.access_token){saveSession(data);try{await mergeCart();}catch{}showPage('conta');showToast('Conta criada. Você já entrou.');}else{showToast('Não foi possível iniciar sua sessão. Tente entrar com seus dados.');}}catch(err){showToast(err.message);}finally{button.disabled=false;}};
}


function deviceOrdersHTML(){
 let orders;try{orders=JSON.parse(localStorage.getItem('hw-orders-history')||'[]');if(!localStorage.getItem('hw-orders-history')&&orders.length)localStorage.setItem('hw-orders-history',JSON.stringify(orders));}catch{return '';}
 if(!Array.isArray(orders)||!orders.length)return '';
 return `<section class="orders-list device-orders"><h2>Compras deste dispositivo</h2><p class="quiet">Pagamentos aprovados.</p>${orders.slice(0,20).map(o=>`<article class="order-row"><strong>${esc(o.code)}</strong><p>Pagamento aprovado · ${money(o.total)}</p><p>${new Date(o.created_at).toLocaleDateString('pt-BR')}</p>${(o.items||[]).map(i=>`<p>${esc(i.nome_produto)} · ${esc(i.tamanho)} · ${Number(i.quantidade)} un.</p>`).join('')}</article>`).join('')}</section>`;
}
