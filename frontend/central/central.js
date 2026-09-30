const shops={horizon:{name:'Horizon Wear',url:'/Index.html'},academia:{name:'Academia',url:'/lojas/academia/'},construcao:{name:'Construção',url:'/lojas/construcao/'}};
const frame=document.getElementById('storeFrame'),view=document.getElementById('storeView'),welcome=document.getElementById('welcome'),loading=document.getElementById('loadStatus');
function chooseStore(slug){const shop=shops[slug];if(!shop)return;welcome.hidden=true;view.hidden=false;loading.hidden=false;document.getElementById('back').hidden=false;document.getElementById('storeNav').hidden=false;document.body.classList.add('viewing');frame.title=shop.name;frame.src=shop.url;document.title=shop.name+' | Central';document.querySelectorAll('#storeNav button').forEach(b=>b.dataset.store===slug?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));}
document.querySelectorAll('[data-store]').forEach(button=>button.addEventListener('click',()=>chooseStore(button.dataset.store)));
frame.addEventListener('load',()=>{loading.hidden=true;});
function backToCentral(){frame.removeAttribute('src');view.hidden=true;welcome.hidden=false;document.getElementById('back').hidden=true;document.getElementById('storeNav').hidden=true;document.body.classList.remove('viewing');document.title='Central — Escolha sua loja';document.querySelector('[data-store="horizon"]').focus();}
document.getElementById('back').addEventListener('click',backToCentral);
document.querySelector('.central-brand').addEventListener('click',e=>{e.preventDefault();backToCentral();});
