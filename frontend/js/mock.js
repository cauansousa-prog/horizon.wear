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
function toggleSlug(slug){
 var a=readWish(),i=a.indexOf(slug);
 if(i>-1)a.splice(i,1);else a.push(slug);
 writeWish(a);updateCount();
 $$('.wish-heart').forEach(function(b){if(b.getAttribute('data-slug')===slug)paintHeart(b);});
 renderWishPanel();
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
  b.addEventListener('click',function(e){
   e.stopPropagation();
   var open=!li.classList.contains('open');closeDrop();
   li.classList.toggle('open',open);b.setAttribute('aria-expanded',open?'true':'false');
  });
  $$('.drop-menu a',li).forEach(function(a){a.addEventListener('click',closeDrop);});
 });
 document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.has-drop'))closeDrop();});
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
