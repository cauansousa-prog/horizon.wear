
/* ============ DATA ============ */
const WHATSAPP_NUMBER = "5585981033964";

const products = [
  {id:1, name:"Camiseta Slim Fit Preta", cat:"camisetas", group:"roupas", price:129.90, img:"https://images.unsplash.com/photo-1782171059800-52b324c6ca3b?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", novo:true},
  {id:2, name:"Camiseta Estampada Rock", cat:"camisetas", group:"roupas", price:139.90, img:"https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:3, name:"Calça Alfaiataria Bege", cat:"calças", group:"roupas", price:189.90, img:"https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:4, name:"Calça Jogger Preta", cat:"calças", group:"roupas", price:159.90, img:"https://images.unsplash.com/photo-1518292309104-b0ee1cfba4cc?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fENhbCVDMyVBN2ElMjBKb2dnZXIlMjBQcmV0YXxlbnwwfHwwfHx8MA%3D%3D", novo:false},
  {id:5, name:"Moletom Canguru Cinza", cat:"blusas", group:"roupas", price:219.90, img:"https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80&auto=format&fit=crop", novo:true},
  {id:6, name:"Blusa Estampada Premium", cat:"blusas", group:"roupas", price:149.90, img:"https://images.unsplash.com/photo-1522050664457-3cc2d06a2dac?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:7, name:"Tênis Urban Preto e Marrom", cat:"tênis", group:"calcados", price:279.90, img:"https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:8, name:"Sapato Social Couro", cat:"sapatos", group:"calcados", price:249.90, img:"https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:9, name:"Relógio Atemporal Couro Edition", cat:"relógios", group:"relogios", price:349.90, img:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&q=80&auto=format&fit=crop", novo:true},
  {id:10, name:"Relógio Classic Bronze", cat:"relógios", group:"relogios", price:299.90, img:"https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:11, name:"Boné Aba Curva", cat:"chapéus", group:"acessorios", price:89.90, img:"https://images.unsplash.com/photo-1445282804813-123ac28fe498?w=500&q=80&auto=format&fit=crop", novo:true},
  {id:12, name:"Chapéu Bucket Preto", cat:"chapéus", group:"acessorios", price:79.90, img:"https://images.unsplash.com/photo-1559510838-a61984e57aa5?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:13, name:"Corrente Prateada", cat:"correntes", group:"acessorios", price:99.90, img:"https://images.unsplash.com/photo-1619182597083-17bda72c1d56?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:14, name:"Perfume Bleu de Chanel", cat:"perfumes", group:"acessorios", price:159.90, img:"https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=500&q=80&auto=format&fit=crop", novo:false},
  {id:15, name:"Jaqueta Couro Preta", cat:"jaquetas", group:"roupas", price:259.90, img:"https://images.unsplash.com/photo-1615818867864-4f1b2cba50da?w=500&q=80&auto=format&fit=crop", novo:true},
  {id:16, name:"Camisa Social Branca", cat:"camisas", group:"roupas", price:179.90, img:"https://media.istockphoto.com/id/2169550665/pt/foto/smiling-man-posing-in-white-shirt-against-dark-background.webp?a=1&b=1&s=612x612&w=0&k=20&c=0EfRLpvrkllYg-xiJutdmHSRJSDxzS1dz8zAFcscUN8=", novo:false},
  {id:17, name:"Óculos de Sol", cat:"óculos", group:"acessorios", price:149.90, img:"https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=80&auto=format&fit=crop", novo:true},
  {id:18, name:"Tênis Casual Branco", cat:"tênis", group:"calcados", price:289.90, img:"https://images.unsplash.com/flagged/photo-1556637640-2c80d3201be8?w=500&q=80&auto=format&fit=crop", novo:false},
];

const categories = [
  {name:"CAMISETAS", key:"camisetas", group:"roupas", img:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80&auto=format&fit=crop"},
  {name:"CALÇAS", key:"calças", group:"roupas", img:"https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=80&auto=format&fit=crop"},
  {name:"BLUSAS", key:"blusas", group:"roupas", img:"https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80&auto=format&fit=crop"},
  {name:"CHAPÉUS", key:"chapéus", group:"acessorios", img:"https://images.unsplash.com/photo-1640921866341-9f4f7fe4e64a?w=400&q=80&auto=format&fit=crop"},
  {name:"RELÓGIOS", key:"relógios", group:"relogios", img:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&q=80&auto=format&fit=crop"},
  {name:"CALÇADOS", key:"calçados", group:"calcados", img:"https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80&auto=format&fit=crop"},
  {name:"ACESSÓRIOS", key:"acessórios", group:"acessorios", img:"https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80&auto=format&fit=crop"},
];

const filterGroups = [
  {key:"todos", label:"Todos"},
  {key:"roupas", label:"Roupas"},
  {key:"calcados", label:"Calçados"},
  {key:"relogios", label:"Relógios"},
  {key:"acessorios", label:"Acessórios"},
];

/* ============ STATE ============ */
let cart = [];              // {id, qty}
let activeFilter = "todos";
let searchQuery = "";

/* ============ HELPERS ============ */
function formatBRL(v){ return "R$ " + v.toFixed(2).replace(".", ","); }
function findProduct(id){ return products.find(p => p.id === id); }

/* ============ NAVIGATION ============ */
function showPage(page, filter){
  document.querySelectorAll('main[id^="page-"]').forEach(el => el.style.display = 'none');
  document.getElementById('page-' + page).style.display = 'block';
  document.querySelectorAll('#navList li').forEach(li => li.classList.remove('active'));
  const navLi = document.querySelector('#navList li[data-page="' + page + '"]');
  if(navLi) navLi.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
  if(page === 'produtos'){
    if(filter) activeFilter = filter;
    renderProducts();
  }
}

/* ============ RENDER: CATEGORIES (home) ============ */
function renderCategories(){
  const grid = document.getElementById('catGrid');
  grid.innerHTML = categories.map(c => `
    <a class="cat-card" href="#" onclick="showPage('produtos','${c.group}');return false;">
      <img src="${c.img}" alt="${c.name}">
      <div class="cat-overlay"><h3>${c.name}</h3><span>VER MAIS</span></div>
    </a>
  `).join('');
}

/* ============ RENDER: ARRIVALS (home) ============ */
function renderArrivals(){
  const track = document.getElementById('arrivalsTrack');
  const novos = products.filter(p => p.novo);
  track.innerHTML = novos.map(p => productCardHTML(p)).join('');
}

/* ============ RENDER: PRODUCT GRID (produtos page) ============ */
function renderFilters(){
  const row = document.getElementById('filtersRow');
  row.innerHTML = filterGroups.map(f => `
    <button class="filter-chip ${f.key===activeFilter?'active':''}" onclick="setFilter('${f.key}')">${f.label}</button>
  `).join('');
}
function setFilter(key){
  activeFilter = key;
  renderProducts();
}
function handleSearchInput(val){
  searchQuery = val.toLowerCase().trim();
  if(document.getElementById('page-produtos').style.display === 'none'){
    showPage('produtos', activeFilter);
  } else {
    renderProducts();
  }
}
function renderProducts(){
  renderFilters();
  let list = products.filter(p => activeFilter === 'todos' || p.group === activeFilter);
  if(searchQuery){
    list = list.filter(p => p.name.toLowerCase().includes(searchQuery) || p.cat.toLowerCase().includes(searchQuery));
  }
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  document.getElementById('resultsCount').textContent = list.length + (list.length===1 ? ' produto encontrado' : ' produtos encontrados');
  if(list.length === 0){
    grid.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = list.map(p => productCardHTML(p)).join('');
  }
}
function productCardHTML(p){
  return `
    <div class="product-card">
      <div class="product-media">
        ${p.novo ? '<span class="tag-novo">NOVO</span>' : ''}
        <img src="${p.img}" alt="${p.name}">
      </div>
      <div class="product-info">
        <span class="cat">${p.cat}</span>
        <h4>${p.name}</h4>
        <div class="price-row">
          <span class="price">${formatBRL(p.price)}<small>6x de ${formatBRL(p.price/6)}</small></span>
        </div>
        <button class="add-cart-btn" id="add-${p.id}" onclick="addToCart(${p.id})">
          <i class="fa-solid fa-bag-shopping"></i> ADICIONAR AO CARRINHO
        </button>
      </div>
    </div>
  `;
}

/* ============ SEARCH BAR TOGGLE ============ */
function toggleSearch(){
  const bar = document.getElementById('searchBar');
  bar.classList.toggle('open');
  if(bar.classList.contains('open')) document.getElementById('searchInput').focus();
}

/* ============ CART LOGIC ============ */
function addToCart(id){
  const existing = cart.find(i => i.id === id);
  if(existing){ existing.qty += 1; } else { cart.push({id, qty:1}); }
  renderCart();
  showToast('Produto adicionado ao carrinho!');
  const btn = document.getElementById('add-'+id);
  if(btn){
    btn.classList.add('added');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> ADICIONADO';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> ADICIONAR AO CARRINHO';
    }, 1200);
  }
}
function changeQty(id, delta){
  const item = cart.find(i => i.id === id);
  if(!item) return;
  item.qty += delta;
  if(item.qty <= 0){ cart = cart.filter(i => i.id !== id); }
  renderCart();
}
function removeFromCart(id){
  cart = cart.filter(i => i.id !== id);
  renderCart();
}
function cartTotal(){
  return cart.reduce((sum, i) => sum + (findProduct(i.id).price * i.qty), 0);
}
function renderCart(){
  const count = cart.reduce((s,i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = count;

  const itemsEl = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');

  if(cart.length === 0){
    itemsEl.innerHTML = `<div class="cart-empty"><i class="fa-solid fa-bag-shopping"></i><p>Seu carrinho está vazio.<br>Adicione produtos para continuar.</p></div>`;
    footerEl.style.display = 'none';
    return;
  }
  footerEl.style.display = 'block';

  itemsEl.innerHTML = cart.map(i => {
    const p = findProduct(i.id);
    return `
      <div class="cart-item">
        <img src="${p.img}" alt="${p.name}">
        <div class="cart-item-info">
          <h5>${p.name}</h5>
          <span class="cat">${p.cat}</span>
          <div class="qty-row">
            <button onclick="changeQty(${p.id},-1)">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty(${p.id},1)">+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;">
          <button class="remove" onclick="removeFromCart(${p.id})"><i class="fa-solid fa-trash"></i></button>
          <span class="cart-item-price">${formatBRL(p.price * i.qty)}</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotal').textContent = formatBRL(cartTotal());
  updateCheckoutLink();
}
function toggleCart(open){
  document.getElementById('cartSidebar').classList.toggle('open', open);
  document.getElementById('overlay').classList.toggle('open', open);
}
function updateCheckoutLink(){
  if(cart.length === 0) return;
  let msg = "Olá! Gostaria de finalizar meu pedido na Horizon Wear:%0A%0A";
  cart.forEach(i => {
    const p = findProduct(i.id);
    msg += `• ${p.name} (x${i.qty}) — ${formatBRL(p.price*i.qty)}%0A`;
  });
  msg += `%0ATotal: ${formatBRL(cartTotal())}`;
  document.getElementById('checkoutBtn').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

/* ============ CONTACT FORM ============ */
function submitContactForm(e){
  e.preventDefault();
  const name = document.getElementById('cName').value;
  const email = document.getElementById('cEmail').value;
  const message = document.getElementById('cMessage').value;
  const text = encodeURIComponent(`Olá, meu nome é ${name} (${email}).\n\n${message}`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  showToast('Mensagem preparada! Envie pelo WhatsApp.');
  document.getElementById('contactForm').reset();
}

/* ============ TOAST ============ */
let toastTimer;
function showToast(msg){
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ============ INIT ============ */
function initWhatsappLinks(){
  const baseMsg = encodeURIComponent("Olá! Vim pelo site da Horizon Wear e gostaria de mais informações.");
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${baseMsg}`;
  document.getElementById('waContactBtn').href = waUrl;
  document.getElementById('waFooterLink').href = waUrl;
  document.getElementById('waSocialLink').href = waUrl;
  document.getElementById('waPolicyLink').href = waUrl;

  const paymentMsg = encodeURIComponent("Olá! Gostaria de saber quais são as formas de pagamento aceitas na Horizon Wear.");
  document.getElementById('waFormasPagamentoLink').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${paymentMsg}`;
}

renderCategories();
renderArrivals();
renderFilters();
renderCart();
initWhatsappLinks();
