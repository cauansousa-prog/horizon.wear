/* Horizon Wear — nova tela inicial.
   Menu com "Produtos", favoritos (salvos neste navegador), categorias e lançamentos.
   Não altera banco de dados, pagamentos nem login. */
(function(){
'use strict';

/* Mostre a oferta do cupom na barra superior SOMENTE se o cupom HORIZON10
   existir e for aplicado no checkout. */
var PROMO_ENABLED=false;
var WISH_KEY='horizon-wishlist-v1';

var CATS=[
 {slug:'camisetas',nome:'Camisetas',img:'img/cat-camisetas.jpg',pos:'50% 40%'},
 {slug:'calcas',nome:'Calças',img:'img/cat-calcas.jpg',pos:'50% 45%'},
 {slug:'blusas',nome:'Blusas',img:'img/cat-blusas.jpg',pos:'50% 45%'},
 {slug:'chapeus',nome:'Chapéus',img:'img/cat-chapeus.jpg',pos:'50% 55%'},
 {slug:'relogios',nome:'Relógios',img:'img/catalog/metal-watch.jpg',pos:'50% 50%'},
 {slug:'calcados',nome:'Calçados',img:'img/cat-calcados.jpg',pos:'50% 60%'},
 {slug:'acessorios',nome:'Acessórios',img:'img/cat-acessorios.jpg',pos:'50% 55%'}
];

function $(s,r){return (r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function html(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}
function getProducts(){return typeof products!=='undefined'&&Array.isArray(products)?products:[];}
function getState(){return typeof catalogState!=='undefined'?catalogState:undefined;}
function getFilter(){return typeof activeFilter!=='undefined'?activeFilter:'todos';}

/* ---------- Filtros virtuais: Blusas e Chapéus ---------- */
var VIRTUAL={
 blusas:function(p){var s=p.categories&&p.categories.slug;return s==='moletons'||s==='camisas'||s==='jaquetas';},
 chapeus:function(p){var s=(p.categories&&p.categories.slug)||'';return /bon[eé]|chap[eé]u|bucket|\bcap\b|viseira/i.test((p.nome||'')+' '+s);}
};
var baseMatch=window.matchesCategory;
if(typeof baseMatch==='function'){
 window.matchesCategory=function(p){
  var f=getFilter();
  if(VIRTUAL[f])return VIRTUAL[f](p);
  return baseMatch(p);
 };
}

/* ---------- Favoritos ---------- */
function readWish(){try{var a=JSON.parse(localStorage.getItem(WISH_KEY));return Array.isArray(a)?a:[];}catch(e){return [];}}
function writeWish(a){try{localStorage.setItem(WISH_KEY,JSON.stringify(a));}catch(e){}}
function isWished(slug){return readWish().indexOf(slug)>-1;}
function paintHeart(btn){
 var on=isWished(btn.getAttribute('data-slug'));
 btn.setAttribute('aria-pressed',on?'true':'false');
 btn.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos');
 btn.innerHTML='<i class="'+(on?'fa-solid':'fa-regular')+' fa-heart" aria-hidden="true"></i>';
}
function updateCount(){var n=readWish().length;var el=$('#wishCount');if(el)el.textContent=String(n);}
function applySlug(slug){
 var a=readWish(),i=a.indexOf(slug);
 if(i>-1)a.splice(i,1);else a.push(slug);
 writeWish(a);updateCount();
 $$('.wish-heart').forEach(function(b){if(b.getAttribute('data-slug')===slug)paintHeart(b);});
 renderWishPanel();
}
window.hwSetFavoriteSlugs=function(slugs){
 writeWish(Array.isArray(slugs)?slugs:[]);updateCount();
 $$('.wish-heart').forEach(paintHeart);renderWishPanel();
};
function toggleSlug(slug){
 if(typeof window.hwToggleFavorite==='function'){
  window.hwToggleFavorite(slug).then(function(done){if(!done)applySlug(slug);})
   .catch(function(err){if(typeof window.showToast==='function')window.showToast(err.message||'Não foi possível salvar o favorito.');});
  return;
 }
 applySlug(slug);
}
function slugOf(card){
 var a=$('.product-media',card)||$('a[href^="/produto/"]',card);
 var h=a&&a.getAttribute('href')||'';
 var m=h.match(/\/produto\/([^/?#]+)/);
 return m?decodeURIComponent(m[1]):'';
}
function decorate(){
 $$('.product-card').forEach(function(card){
  var tag=$('.tag-novo',card);if(tag&&tag.textContent!=='NOVO')tag.textContent='NOVO';
  if(card.getAttribute('data-wish'))return;
  var slug=slugOf(card);if(!slug)return;
  card.setAttribute('data-wish','1');
  var b=document.createElement('button');b.type='button';b.className='wish-heart';b.setAttribute('data-slug',slug);
  paintHeart(b);card.appendChild(b);
 });
}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('.wish-heart');
 if(!b)return;
 e.preventDefault();e.stopPropagation();
 toggleSlug(b.getAttribute('data-slug'));
},true);

function ensurePanel(){
 if($('#wishPanel'))return;
 var wrap=document.createElement('div');
 wrap.innerHTML='<div class="wish-overlay" id="wishOverlay"></div>'+
  '<aside class="wish-panel" id="wishPanel" aria-hidden="true" aria-label="Favoritos">'+
  '<div class="wish-head"><h2>Meus favoritos</h2><button type="button" class="wish-close" id="wishClose" aria-label="Fechar favoritos">&times;</button></div>'+
  '<div class="wish-list" id="wishList"></div></aside>';
 while(wrap.firstChild)document.body.appendChild(wrap.firstChild);
 $('#wishOverlay').addEventListener('click',function(){window.toggleWishlist(false);});
 $('#wishClose').addEventListener('click',function(){window.toggleWishlist(false);});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){window.toggleWishlist(false);closeDrop();}});
}
function renderWishPanel(){
 var box=$('#wishList');if(!box)return;
 var slugs=readWish();
 var products=getProducts();
 var state=getState();
 if(!slugs.length){
  box.innerHTML='<div class="wish-empty"><i class="fa-regular fa-heart" aria-hidden="true"></i><p>Você ainda não favoritou nenhuma peça.</p><button type="button" id="wishExplore">Explorar peças</button></div>';
  var ex=$('#wishExplore');if(ex)ex.addEventListener('click',function(){window.toggleWishlist(false);if(typeof window.showPage==='function')window.showPage('produtos','todos');});
  return;
 }
 if(state!=='ready'){box.innerHTML='<p class="wish-empty">Carregando seus favoritos…</p>';return;}
 var mf=typeof money==='function'?money:null,pf=typeof price==='function'?price:null,imf=typeof imageFor==='function'?imageFor:null,sf=typeof safeImage==='function'?safeImage:null;
 var items=slugs.map(function(s){return products.filter(function(p){return p.slug===s;})[0];}).filter(Boolean);
 if(!items.length){box.innerHTML='<p class="wish-empty">Essas peças não estão mais disponíveis.</p>';return;}
 box.innerHTML=items.map(function(p){
  var img=imf?imf(p):'';img=sf?sf(img):img;
  var pr=(mf&&pf)?mf(pf(p)):'';
  return '<div class="wish-item"><a href="/produto/'+encodeURIComponent(p.slug)+'"><img src="'+html(img)+'" alt="'+html(p.nome)+'" loading="lazy"></a>'+
   '<div><a href="/produto/'+encodeURIComponent(p.slug)+'">'+html(p.nome)+'</a><span class="wish-price">'+html(pr)+'</span></div>'+
   '<button type="button" class="wish-remove" data-remove="'+html(p.slug)+'" aria-label="Remover '+html(p.nome)+' dos favoritos"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div>';
 }).join('');
 $$('.wish-remove',box).forEach(function(b){b.addEventListener('click',function(){toggleSlug(b.getAttribute('data-remove'));});});
}
window.toggleWishlist=function(open){
 ensurePanel();
 var on=typeof open==='boolean'?open:!document.body.classList.contains('wish-open');
 document.body.classList.toggle('wish-open',on);
 var p=$('#wishPanel');if(p)p.setAttribute('aria-hidden',on?'false':'true');
 if(on){renderWishPanel();var c=$('#wishClose');if(c)c.focus();}
};

/* ---------- Menu "Produtos" ---------- */
function closeDrop(){$$('.has-drop').forEach(function(li){li.classList.remove('open');var b=$('.drop-btn',li);if(b)b.setAttribute('aria-expanded','false');});}
function bindDrop(){
 $$('.has-drop').forEach(function(li){
  var b=$('.drop-btn',li);if(!b)return;
  b.onclick=function(e){
   e.preventDefault();e.stopPropagation();
   var open=b.getAttribute('aria-expanded')!=='true';
   closeDrop();
   if(open){li.classList.add('open');b.setAttribute('aria-expanded','true');}
  };
  $$('.drop-menu a',li).forEach(function(a){a.addEventListener('click',closeDrop);});
 });
 document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.has-drop'))closeDrop();});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrop();});
}
function syncNav(){
 var visible=$$('main[id^="page-"]').filter(function(m){return !m.hidden&&m.style.display!=='none';})[0];
 var page=visible?visible.id.replace('page-',''):'home';
 var f=getFilter();
 var key=null;
 if(page==='home')key='inicio';
 else if(page==='produtos')key=(f==='novidades')?'lancamentos':(f==='acessorios')?'acessorios':(f==='calcados')?'calcados':'produtos';
 else if(page==='sobre')key='sobre';
 else if(page==='contato')key='contato';
 $$('#navList>li').forEach(function(li){li.classList.toggle('active',!!key&&li.getAttribute('data-nav-key')===key);});
 if(page==='produtos'){
  var T={blusas:'Blusas',chapeus:'Chapéus',novidades:'Lançamentos'};
  if(T[f]){var h=$('#catalogTitle');if(h&&h.textContent!==T[f]+'.')h.textContent=T[f]+'.';document.title=T[f]+' | Horizon Wear';}
 }
}
['showPage','routeStore','renderProducts'].forEach(function(name){
 var orig=window[name];
 if(typeof orig!=='function')return;
 window[name]=function(){
  var r=orig.apply(this,arguments);
  if(name!=='renderProducts')closeDrop();
  if(r&&typeof r.then==='function')return r.then(function(v){syncNav();return v;});
  syncNav();return r;
 };
});

/* ---------- Categorias ---------- */
function renderCats(){
 var gd=$('#catGrid');if(!gd)return;
 gd.innerHTML=CATS.map(function(c){
  return '<a class="cat-card mk-cat" href="/colecao/'+c.slug+'" data-category="'+c.slug+'">'+
   '<img loading="lazy" src="'+c.img+'" alt="'+c.nome+'" width="1100" height="619" style="object-position:'+c.pos+'">'+
   '<div class="mk-cat-ov"><h3>'+c.nome+'</h3><span class="mk-more">VER MAIS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div></a>';
 }).join('');
}

/* ---------- Lançamentos ---------- */
function renderLaunches(){
 var track=$('#arrivalsTrack');if(!track)return;
 if(getState()!=='ready')return;
 if(track.querySelector('[data-mk-sentinel]'))return;
 var products=getProducts();
 if(typeof productCardHTML!=='function')return;
 var pc=productCardHTML;
 var fresh=products.filter(function(p){return p.lancamento;});
 var rest=products.filter(function(p){return !p.lancamento;}).sort(function(a,b){return Number(b.destaque)-Number(a.destaque);});
 var list=fresh.concat(rest).slice(0,8);
 if(!list.length)return;
 track.innerHTML=list.map(pc).join('')+'<span data-mk-sentinel hidden></span>';
}

/* ---------- Barra superior ---------- */
function syncTopbar(){
 var promo=$('#tbPromo'),tag=$('#tbTag');
 if(promo)promo.hidden=!PROMO_ENABLED;
 if(tag)tag.hidden=PROMO_ENABLED;
 $$('.tb-ship').forEach(function(s){
  var cap=$('.tb-cap',s),rest=$('.tb-rest',s);
  if(cap&&rest)rest.hidden=!/gr[aá]tis/i.test(cap.textContent);
 });
}

/* ---------- Observadores (reagem quando a loja redesenha) ---------- */
function watch(el,fn,opts){
 if(!el||typeof MutationObserver==='undefined')return;
 new MutationObserver(function(){fn();}).observe(el,opts);
}

var started=false;
ready(function(){
 if(started)return;started=true;
 ensurePanel();bindDrop();updateCount();syncTopbar();renderCats();syncNav();decorate();
 watch($('#catGrid'),function(){if(!$('#catGrid .mk-cat'))renderCats();},{childList:true});
 watch($('#arrivalsTrack'),function(){renderLaunches();decorate();if(document.body.classList.contains('wish-open'))renderWishPanel();},{childList:true});
 var lbls=$$('[data-shipping-label]');lbls.forEach(function(l){watch(l,syncTopbar,{childList:true,characterData:true,subtree:true});});
 if(typeof MutationObserver!=='undefined'){
  var pend=false;
  new MutationObserver(function(){
   if(pend)return;pend=true;
   (window.requestAnimationFrame||setTimeout)(function(){pend=false;decorate();});
  }).observe(document.body,{childList:true,subtree:true});
 }
 window.addEventListener('storage',function(e){if(e.key===WISH_KEY){updateCount();$$('.wish-heart').forEach(paintHeart);renderWishPanel();}});
});
})();

/* ===== Minha conta (novo layout) =====
   Mesmas chamadas de API e regras de antes; só muda a apresentação. */
(function(){
'use strict';
var baseRender=window.renderAccount;
if(typeof baseRender!=='function')return;

function h(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDate(v){try{return new Date(v).toLocaleDateString('pt-BR');}catch(e){return '';}}
function money2(v){return typeof money==='function'?money(v):String(v);}

function statusOf(o){
 var approved=(o.payments||[]).some(function(p){return p.status==='approved';});
 var map={recebido:['Pedido recebido','info'],pagamento_aprovado:['Pagamento aprovado','ok'],preparando:['Preparando pedido','info'],enviado:['Em transporte','ship'],entregue:['Entregue','ok'],cancelado:['Pedido cancelado','bad']};
 if(o.status==='enviado'||o.status==='entregue'||o.status==='cancelado')return map[o.status];
 if(approved)return map.pagamento_aprovado;
 if(o.review_required)return ['Pagamento em revisão de estoque','info'];
 return map[o.status]||[String(o.status||'Pedido'),'info'];
}
function thumbFor(item){
 var list=(typeof products!=='undefined'&&Array.isArray(products))?products:[];
 var p=list.filter(function(x){return x.nome===item.nome_produto;})[0];
 var src='img/logo-icone.png';
 try{if(p&&typeof imageFor==='function'){src=imageFor(p)||src;if(typeof safeImage==='function')src=safeImage(src);}}catch(e){}
 return src;
}
function orderHTML(o,i){
 var items=o.order_items||[];
 var st=statusOf(o);
 var canCancel=o.status!=='recebido'&&o.status!=='cancelado';
 var paid=(o.payments||[]).some(function(p){return p.status==='approved';});
 var mini=items.slice(1,3).map(function(it){return '<img src="'+h(thumbFor(it))+'" alt="" loading="lazy">';}).join('');
 var more=items.length>3?'<span>+'+(items.length-3)+'</span>':'';
 var first=items[0]?thumbFor(items[0]):'img/logo-icone.png';
 var detail=items.map(function(it){return '<p>'+h(it.nome_produto)+' · '+h(it.tamanho)+' · '+h(it.quantidade)+' un.</p>';}).join('')+(o.rastreio?'<p>Rastreio: '+h(o.rastreio)+'</p>':'');
 if(canCancel)detail+='<div class="acct-order-actions"><button type="button" class="acct-cancel" data-cancel-order="'+h(o.id)+'">Cancelar pedido</button>'+(paid?'<small>O pagamento aprovado não é estornado automaticamente. O atendimento precisará analisar a devolução.</small>':'<small>Disponível enquanto o pedido não estiver como recebido.</small>')+'</div>';
 else if(o.status==='cancelado')detail+='<p class="acct-cancelled">Este pedido foi cancelado.</p>';
 else detail+='<p class="acct-received">Recebimento confirmado. Obrigado pela compra!</p>';
 return '<article class="acct-order" data-order-row'+(i>2?' hidden':'')+'>'+
  '<img class="acct-thumb" src="'+h(first)+'" alt="" loading="lazy">'+
  '<div class="acct-order-info"><strong>Pedido #'+h(o.codigo)+'</strong><span>Realizado em '+h(fmtDate(o.created_at))+'</span><div class="acct-mini">'+mini+more+'</div></div>'+
  '<div class="acct-order-status"><span class="chip chip--'+st[1]+'">'+h(st[0])+'</span>'+(o.rastreio?'<small>Rastreio: '+h(o.rastreio)+'</small>':'')+'</div>'+
  '<div class="acct-order-end"><strong>'+h(money2(o.total))+'</strong><button type="button" class="acct-btn" data-order-toggle aria-expanded="false">Ver detalhes <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>'+
  '<div class="acct-detail" hidden>'+detail+'</div>'+
  '</article>';
}
function reviewHTML(state){
 if(state&&state.unavailable)return '<section class="acct-review" id="acct-review"><div><p class="eyebrow">SUA EXPERIÊNCIA</p><h3>Avaliação da Horizon Wear</h3><p>A área de avaliações está temporariamente indisponível. Você ainda pode usar sua conta normalmente.</p></div></section>';
 var review=state&&state.review;
 if(review&&review.approved)return '<section class="acct-review" id="acct-review"><div><p class="eyebrow">SUA EXPERIÊNCIA</p><h3>Avaliação da Horizon Wear</h3><p>Obrigado por compartilhar sua experiência com a loja.</p></div><div class="acct-review-state"><strong>✓ Sua avaliação foi publicada</strong><div class="acct-review-stars" aria-label="Nota '+Number(review.nota)+' de 5">'+('★'.repeat(Number(review.nota))+'☆'.repeat(5-Number(review.nota)))+'</div><p>'+h(review.comentario||'')+'</p></div></section>';
 if(!(state&&state.eligible))return '<section class="acct-review" id="acct-review"><div><p class="eyebrow">SUA EXPERIÊNCIA</p><h3>Avalie a Horizon Wear</h3><p>Depois que um pedido for marcado como recebido, você poderá avaliar a loja.</p></div><p class="acct-review-locked">A avaliação será liberada após a confirmação do recebimento.</p></section>';
 return '<section class="acct-review" id="acct-review"><div><p class="eyebrow">SUA EXPERIÊNCIA</p><h3>Avalie a Horizon Wear</h3><p>Sua opinião ajuda a melhorar nossos produtos e atendimento.</p></div><form id="acctReviewForm" class="acct-review-form"><label>Nota<select name="nota" required><option value="">Selecione uma nota</option>'+[5,4,3,2,1].map(function(n){return '<option value="'+n+'" '+(review&&Number(review.nota)===n?'selected':'')+'>'+n+' estrela(s)'+(n===5?' · Excelente':n===4?' · Muito bom':n===3?' · Bom':n===2?' · Regular':' · Precisa melhorar')+'</option>';}).join('')+'</select></label><label>Comentário <span class="quiet">· opcional</span><textarea name="comentario" rows="3" maxlength="2000" placeholder="Conte como foi sua experiência com a Horizon Wear.">'+h(review&&review.comentario||'')+'</textarea></label><button type="submit" class="acct-btn acct-review-submit">'+(review?'Atualizar avaliação':'Enviar avaliação')+'</button><small>'+(review?'Sua avaliação está aguardando análise.':'A avaliação será enviada para análise antes da publicação.')+'</small></form></section>';
}
function addressHTML(a){
 return '<article class="acct-addr"><i class="fa-solid fa-house" aria-hidden="true"></i><div><strong>'+h(a.destinatario)+'</strong><p>'+h(a.rua)+', '+h(a.numero)+(a.bairro?' - '+h(a.bairro):'')+'</p><p>'+h(a.cidade)+' - '+h(a.estado)+(a.cep?', '+h(a.cep):'')+'</p><button type="button" class="text-button" data-delete-address="'+h(a.id)+'">Remover</button></div></article>';
}

window.renderAccount=async function(){
 var logged=(typeof session!=='undefined')&&session;
 if(!logged)return baseRender();
 var el=document.getElementById('accountContent');if(!el)return;
 var title=document.getElementById('accountTitle');if(title)title.hidden=true;
 el.textContent='Carregando sua conta…';
 try{
  var r=await Promise.all([api('/api/users/me'),api('/api/addresses'),api('/api/orders'),api('/api/reviews/store').catch(function(){return {review:null,eligible:false,unavailable:true};})]);
  var profile=r[0],addresses=r[1],orders=r[2],reviewState=r[3];
  window.__hwAccountOrders=orders;
  var since=profile.created_at?new Date(profile.created_at).getFullYear():null;
  var addrForm=[['Destinatário','destinatario'],['CEP (somente números)','cep'],['Rua','rua'],['Número','numero'],['Bairro','bairro'],['Cidade','cidade'],['Estado (UF)','estado'],['Telefone','telefone']].map(function(x){return input(x[0],x[1]);}).join('')+input('Complemento','complemento','text',false);
  el.innerHTML='<div class="acct">'+
   '<aside class="acct-side"><div class="acct-avatar"><img src="img/logo-icone.png" alt=""></div>'+
    '<div><h2 class="acct-name">'+h(profile.full_name)+'</h2>'+(since?'<p class="acct-since">Cliente desde '+since+'</p>':'')+'</div>'+
    '<nav class="acct-nav" aria-label="Minha conta">'+
     '<button type="button" class="on" data-acct="top"><i class="fa-solid fa-house" aria-hidden="true"></i> Minha conta</button>'+
     '<button type="button" data-acct="orders"><i class="fa-solid fa-box" aria-hidden="true"></i> Meus pedidos</button>'+
     '<button type="button" data-acct="addresses"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Meus endereços</button>'+
     '<button type="button" data-acct="payments"><i class="fa-regular fa-credit-card" aria-hidden="true"></i> Métodos de pagamento</button>'+
     '<button type="button" data-acct="wish"><i class="fa-regular fa-heart" aria-hidden="true"></i> Favoritos</button>'+
     '<button type="button" data-acct="support"><i class="fa-solid fa-headset" aria-hidden="true"></i> Suporte</button>'+
    '</nav>'+
    '<button type="button" id="logout" class="acct-logout"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sair da conta</button></aside>'+
   '<div class="acct-main">'+
    '<section class="acct-hero"><h1>Olá, <em>'+h(profile.full_name)+'!</em></h1><p>Gerencie seus dados, acompanhe seus pedidos e aproveite uma experiência ainda melhor.</p><span class="acct-rule"></span></section>'+
    '<div class="acct-cards">'+
     '<form id="profileForm" class="acct-card"><div class="acct-card-head"><h3><i class="fa-regular fa-user" aria-hidden="true"></i> Seus dados</h3><button type="button" class="acct-btn" id="acctEdit"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button></div>'+
      '<label>Nome<input name="nome_completo" value="'+h(profile.full_name)+'" minlength="2" maxlength="120" autocomplete="name" required readonly></label>'+
      '<label>Telefone<input name="telefone" value="'+h(profile.phone)+'" type="tel" maxlength="25" autocomplete="tel" readonly></label>'+
      '<button class="acct-btn acct-save" id="acctSave" hidden>Salvar dados</button></form>'+
     '<section class="acct-card" id="acct-addresses"><div class="acct-card-head"><h3><i class="fa-solid fa-box-open" aria-hidden="true"></i> Seus endereços</h3><button type="button" class="acct-btn" id="acctManage">Gerenciar <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>'+
      (addresses.length?addresses.map(addressHTML).join(''):'<p class="acct-empty">Adicione um endereço para facilitar suas próximas compras.</p>')+
      '<details id="acctAddrDetails"><summary>Adicionar endereço</summary><form id="addressForm">'+addrForm+'<button class="btn-gold">Salvar endereço</button></form></details></section>'+
    '</div>'+
    '<section class="acct-card acct-orders" id="acct-orders"><div class="acct-card-head"><h3><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Seu histórico de pedidos</h3></div>'+
      (orders.length?orders.map(orderHTML).join('')+(orders.length>3?'<div class="acct-all"><button type="button" class="acct-btn" id="acctAllOrders">Ver todos os pedidos <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>':''):'<p class="acct-empty">Seus pedidos aparecerão aqui depois da primeira compra.</p>')+
    '</section>'+
    reviewHTML(reviewState)+
    '<section class="acct-support" id="acct-support"><img src="img/logo-vertical.png" alt="Horizon Wear"><div><h3><i class="fa-solid fa-headset" aria-hidden="true"></i> Ainda tem dúvidas?</h3><p>Nossa equipe está pronta para te ajudar!</p><button type="button" class="acct-btn" id="acctSupport">Falar com o suporte <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div></section>'+
    (profile.role==='admin'?'<a class="acct-btn acct-admin" href="/admin.html">Abrir administração</a>':'')+
   '</div></div>';
  el.insertAdjacentHTML('beforeend',typeof deviceOrdersHTML==='function'?deviceOrdersHTML():'');

  var q=function(s){return el.querySelector(s);};
  q('#logout').onclick=async function(e){if(e)e.preventDefault();var button=q('#logout');if(button){button.disabled=true;button.textContent='Saindo…';}if(typeof window.hwLogout==='function'){await window.hwLogout();return;}saveSession(null);cart=storageCart();renderCart();await window.renderAccount();};
  var form=q('#profileForm'),edit=q('#acctEdit'),save=q('#acctSave');
  edit.onclick=function(){var on=form.querySelector('input').readOnly;form.querySelectorAll('input').forEach(function(i){i.readOnly=!on;});save.hidden=!on;edit.innerHTML=on?'Cancelar':'<i class="fa-solid fa-pen" aria-hidden="true"></i> Editar';if(on)form.querySelector('input').focus();};
  form.onsubmit=async function(e){e.preventDefault();form.querySelectorAll('input').forEach(function(i){i.value=i.value.trim();});if(!form.reportValidity())return;save.disabled=true;save.textContent='Salvando…';
   try{await api('/api/users/me',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});showToast('Nome e telefone salvos.');await window.renderAccount();}
   catch(err){showToast(err.message);save.disabled=false;save.textContent='Salvar dados';}};
  q('#addressForm').onsubmit=async function(e){e.preventDefault();try{await api('/api/addresses',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});window.renderAccount();}catch(err){showToast(err.message);}};
  q('#acctManage').onclick=function(){var d=q('#acctAddrDetails');d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});};
  q('#acctSupport').onclick=function(){if(typeof showPage==='function')showPage('contato');};
  var all=q('#acctAllOrders');if(all)all.onclick=function(){el.querySelectorAll('[data-order-row]').forEach(function(r){r.hidden=false;});all.parentNode.remove();};
  var reviewForm=q('#acctReviewForm');
  if(reviewForm)reviewForm.onsubmit=async function(e){
   e.preventDefault();if(!reviewForm.reportValidity())return;
   var button=reviewForm.querySelector('[type="submit"]');button.disabled=true;button.textContent='Enviando…';
   try{var values=Object.fromEntries(new FormData(reviewForm));values.nota=Number(values.nota);await api('/api/reviews/store',{method:reviewState.review?'PATCH':'POST',body:JSON.stringify(values)});showToast('Sua avaliação foi enviada para análise.');await window.renderAccount();}
   catch(err){showToast(err.message);button.disabled=false;button.textContent=reviewState.review?'Atualizar avaliação':'Enviar avaliação';}
  };
  el.onclick=async function(e){
   var cancel=e.target.closest&&e.target.closest('[data-cancel-order]');
   if(cancel){
    var orderId=cancel.getAttribute('data-cancel-order');
    var order=(window.__hwAccountOrders||[]).find(function(o){return o.id===orderId;});
    var paid=order&&(order.payments||[]).some(function(p){return p.status==='approved';});
    var warning=paid?'\\n\\nO pagamento aprovado não será estornado automaticamente. O atendimento precisará analisar a devolução.':'';
    if(!window.confirm('Deseja realmente cancelar este pedido?'+warning))return;
    cancel.disabled=true;cancel.textContent='Cancelando…';
    try{await api('/api/orders/'+encodeURIComponent(orderId)+'/cancel',{method:'POST',body:JSON.stringify({motivo:'Solicitado pelo cliente'})});showToast('Pedido cancelado.');await window.renderAccount();}
    catch(err){showToast(err.message);cancel.disabled=false;cancel.textContent='Cancelar pedido';}
    return;
   }
   var t=e.target.closest&&e.target.closest('[data-order-toggle]');
   if(t){var box=t.closest('.acct-order').querySelector('.acct-detail');var open=box.hidden;box.hidden=!open;t.setAttribute('aria-expanded',open?'true':'false');return;}
   var n=e.target.closest&&e.target.closest('[data-acct]');if(!n)return;
   var k=n.getAttribute('data-acct');
   el.querySelectorAll('[data-acct]').forEach(function(b){b.classList.toggle('on',b===n);});
   if(k==='top')el.scrollIntoView({behavior:'smooth',block:'start'});
   else if(k==='orders')q('#acct-orders').scrollIntoView({behavior:'smooth',block:'start'});
   else if(k==='addresses')q('#acct-addresses').scrollIntoView({behavior:'smooth',block:'start'});
   else if(k==='support')q('#acct-support').scrollIntoView({behavior:'smooth',block:'center'});
   else if(k==='wish'&&typeof window.toggleWishlist==='function')window.toggleWishlist(true);
   else if(k==='payments'&&typeof showPage==='function')showPage('ajuda');
  };
 }catch(err){
  if(typeof session==='undefined'||!session){return window.renderAccount();}
  el.textContent=err.message;
 }
};
})();
