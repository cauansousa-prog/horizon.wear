/* Horizon Wear — botão "Produtos" do menu.
   Ao clicar em "Produtos", vai direto para a coleção completa.
   O submenu de categorias continua disponível ao passar o mouse (computador) ou ao navegar pelo teclado.
   Não altera banco de dados, pagamentos nem login. */
(function(){
'use strict';

function all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}

function setOpen(li,on){
 var b=li.querySelector('.drop-btn');
 li.classList.toggle('open',on);
 if(b)b.setAttribute('aria-expanded',on?'true':'false');
}
function closeAll(){all('.has-drop').forEach(function(li){setOpen(li,false);});}

function canHover(){
 return typeof window.matchMedia==='function'&&window.matchMedia('(hover:hover) and (min-width:1100px)').matches;
}

function init(){
 all('.has-drop').forEach(function(li){
  var b=li.querySelector('.drop-btn');
  if(!b)return;

  /* Clique: abre a coleção completa (substitui o comportamento antigo de só abrir/fechar o submenu). */
  b.onclick=function(e){
   e.preventDefault();e.stopPropagation();
   closeAll();
   if(typeof window.showPage==='function')window.showPage('produtos','todos');
  };

  /* Computador: o submenu abre ao passar o mouse. */
  li.addEventListener('mouseenter',function(){if(canHover())setOpen(li,true);});
  li.addEventListener('mouseleave',function(){if(canHover())setOpen(li,false);});

  /* Teclado: o submenu abre ao focar e fecha ao sair. */
  li.addEventListener('focusin',function(){if(canHover())setOpen(li,true);});
  li.addEventListener('focusout',function(e){if(!li.contains(e.relatedTarget))setOpen(li,false);});
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
