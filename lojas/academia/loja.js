(async () => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    heart:
      '<path d="M20.8 4.6a5.3 5.3 0 0 0-7.5 0L12 5.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.9a5.3 5.3 0 0 0 0-7.5Z"/>',
    bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    minus: '<path d="M4 12h16"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    sliders:
      '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="19" r="2"/>',
    compare: '<path d="M7 3v18M17 3v18M3 7l4-4 4 4m2 10 4 4 4-4"/>',
    ruler: '<path d="m3 16 13-13 5 5L8 21l-5-5Zm3-3 3 3m1-7 3 3m1-7 3 3"/>',
    zoom: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    share: '<path d="M12 16V2m-4 4 4-4 4 4M5 10H3v12h18V10h-2"/>',
    download: '<path d="M12 2v13m-5-5 5 5 5-5M3 16v6h18v-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>',
    layers: '<path d="m12 3 10 6-10 6L2 9l10-6ZM3 14l9 5 9-5"/>',
    lock: '<rect x="5" y="10" width="14" height="12" rx="1"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    move: '<path d="M4 8h15l-4-4m5 12H5l4 4"/>',
  };
  const icon = (n) =>
    n === "arrow"
      ? ""
      : `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.check}</svg>`;
  const hydrate = (root = document) =>
    $$("i[data-icon]", root).forEach(
      (el) => (el.outerHTML = icon(el.dataset.icon)),
    );
  const money = (n) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const norm = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const colors = {
    Preto: "#222222",
    Branco: "#eeeeee",
    Azul: "#64b7d5",
    Laranja: "#ec642b",
  };
  const fallbackProducts = [
    {
      id: 1,
      name: "Legging Flow",
      category: "Leggings",
      audience: "Feminino",
      price: 159.9,
      colors: ["Preto"],
      sizes: ["PP", "P", "M", "G", "GG"],
      tag: "ESSENCIAL",
      photo: "https://images.unsplash.com/photo-1616279968481-f8717a710ef6?auto=format&fit=crop&w=1200&q=85",
      position: "50% 82%",
      zoom: 1.45,
      description:
        "Legging preta de cintura alta e comprimento até o tornozelo. Linhas simples para combinar com o seu ritmo.",
    },
    {
      id: 2,
      name: "Top Essential",
      category: "Tops",
      audience: "Feminino",
      price: 89.9,
      colors: ["Preto"],
      sizes: ["PP", "P", "M", "G"],
      tag: "TREINO",
      photo: "https://images.unsplash.com/photo-1609899517237-77d357b047cf?auto=format&fit=crop&w=1200&q=85",
      position: "50% 28%",
      zoom: 1.5,
      description:
        "Top esportivo preto de alças finas. Um essencial para usar com legging e montar uma combinação monocromática.",
    },
    {
      id: 3,
      name: "Short Training",
      category: "Shorts",
      audience: "Masculino",
      price: 109.9,
      colors: ["Preto"],
      sizes: ["P", "M", "G", "GG"],
      tag: "EM MOVIMENTO",
      photo: "https://images.unsplash.com/photo-1606335544665-96055053b5c0?auto=format&fit=crop&w=1200&q=85",
      position: "64% 12%",
      zoom: 1,
      description:
        "Short esportivo escuro com detalhes em vermelho. Uma proposta para compor o visual dos seus treinos.",
    },
    {
      id: 4,
      name: "Camiseta Everyday",
      category: "Camisetas",
      audience: "Unissex",
      price: 99.9,
      colors: ["Branco"],
      sizes: ["PP", "P", "M", "G", "GG"],
      tag: "ESSENCIAL",
      photo: "https://images.unsplash.com/photo-1592632789004-57d4354f2499?auto=format&fit=crop&w=1200&q=85",
      position: "50% 45%",
      zoom: 1,
      description:
        "Camiseta branca de manga curta e gola redonda. Uma base versátil para o treino leve e o cotidiano.",
    },
    {
      id: 6,
      name: "Conjunto Studio",
      category: "Conjuntos",
      audience: "Feminino",
      price: 249.9,
      colors: ["Preto"],
      sizes: ["P", "M", "G"],
      tag: "LOOK COMPLETO",
      photo: "https://images.unsplash.com/photo-1770026136368-0873a0833a20?auto=format&fit=crop&w=1200&q=85",
      position: "50% 50%",
      zoom: 1,
      description:
        "Top de alças finas e legging preta em uma composição coordenada. Um visual completo, do seu jeito.",
    },
    {
      id: 7,
      name: "Camiseta Graphic",
      category: "Camisetas",
      audience: "Masculino",
      price: 119.9,
      colors: ["Preto"],
      sizes: ["P", "M", "G", "GG"],
      tag: "LIFESTYLE",
      photo: "https://images.unsplash.com/photo-1618355281686-2b622387ada4?auto=format&fit=crop&w=1200&q=85",
      position: "50% 49%",
      zoom: 1.12,
      description:
        "Camiseta preta com estampa gráfica branca, manga curta e modelagem reta. Personalidade para os momentos fora do treino.",
    },
    {
      id: 8,
      name: "Legging Energy",
      category: "Leggings",
      audience: "Feminino",
      price: 179.9,
      colors: ["Laranja"],
      sizes: ["P", "M", "G", "GG"],
      tag: "MAIS ENERGIA",
      photo: "https://images.unsplash.com/photo-1675026482188-8102367ecc16?auto=format&fit=crop&w=1200&q=85",
      position: "45% 50%",
      zoom: 1,
      description:
        "Legging em tom alaranjado para trazer cor à sua combinação esportiva. Use com peças neutras para destacar o visual.",
    },
    {
      id: 10,
      name: "Top Pulse",
      category: "Tops",
      audience: "Feminino",
      price: 99.9,
      colors: ["Azul"],
      sizes: ["PP", "P", "M", "G", "GG"],
      tag: "AUREL ACTIVE",
      photo: "https://images.unsplash.com/photo-1768929096134-f45af7839e83?auto=format&fit=crop&w=1200&q=85",
      position: "7% 30%",
      zoom: 1.15,
      description:
        "Top esportivo azul de alças largas. Uma opção para combinar com peças pretas e brancas na sua rotina de movimento.",
    },
  ];

  const products = await window.AurelDB.catalogue(fallbackProducts);

  const categories = ["Todas", ...new Set(products.map(p => p.category))];
  const availableSizes = [...new Set(["PP", "P", "M", "G", "GG", ...products.flatMap(p => p.sizes)])];
  for (const color of products.flatMap(p => p.colors)) {
    if (!Object.hasOwn(colors, color)) Object.defineProperty(colors, color, { value: "#888888", enumerable: true });
  }
  const catalogMaxPrice = Math.max(300, ...products.map(p => Math.ceil(p.price / 10) * 10));
  if ($("#maxPrice")) $("#maxPrice").max = catalogMaxPrice;
  const product = (id) => products.find((p) => p.id === Number(id));
  const urlOf = (id) => `produto.html?id=${id}`;
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const ids = (key) => {
    const v = read(key, []);
    return Array.isArray(v)
      ? [...new Set(v.filter((id) => !!product(id)))]
      : [];
  };
  let favorites = new Set(ids("aurel-favorites-v1"));
  let compared = ids("aurel-compare-v1").slice(0, 3);
  let recent = ids("aurel-recent-v1").slice(0, 6);
  let cart = read("aurel-cart-photo-v1", []);
  cart = Array.isArray(cart)
    ? cart.filter(
        (x) =>
          x &&
          product(x.id)?.sizes.includes(x.size) &&
          product(x.id)?.colors.includes(x.color) &&
          Number.isInteger(x.qty) &&
          x.qty >= 1 &&
          x.qty <= 20,
      )
    : [];
  let detail = null,
    toastTimer,
    undoAction = null;
  const state = {
    category: "Todas",
    audience: new Set(),
    sizes: new Set(),
    colors: new Set(),
    maxPrice: catalogMaxPrice,
    query: "",
    sort: "featured",
    onlyFavorites: false,
  };
  const searchPage = document.body.classList.contains("page-search");
  const hasCatalogue = !!$("#productGrid");
  function toast(message, action = null, label = "Desfazer") {
    const el = $("#toast");
    if (!el) return;
    (document.querySelector("dialog[open]") || document.body).append(el);
    el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" id="toastAction">${esc(label)}</button>` : ""}`;
    undoAction = action;
    el.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => {
        el.classList.remove("visible");
        undoAction = null;
      },
      action ? 10000 : 3500,
    );
  }
  function persist() {
    try {
      localStorage.setItem(
        "aurel-favorites-v1",
        JSON.stringify([...favorites]),
      );
      localStorage.setItem("aurel-cart-photo-v1", JSON.stringify(cart));
      localStorage.setItem("aurel-compare-v1", JSON.stringify(compared));
      localStorage.setItem("aurel-recent-v1", JSON.stringify(recent));
    } catch {
      toast("O navegador não permitiu salvar suas escolhas.");
    }
    updateCounts();
    window.AurelDB.savePreferences(favorites, cart);
  }
  function updateCounts() {
    const total = cart.reduce((n, x) => n + x.qty, 0);
    $("#cartCount").textContent = total;
    $("#favoriteCount").textContent = favorites.size;
    $("#favoriteCount").hidden = !favorites.size;
    $("#cartToggle").setAttribute(
      "aria-label",
      `Abrir sacola, ${total} ${total === 1 ? "item" : "itens"}`,
    );
    $("#favoriteToggle").setAttribute(
      "aria-pressed",
      hasCatalogue && state.onlyFavorites,
    );
    $$("[data-favorite]").forEach((b) => {
      const p = product(b.dataset.favorite);
      const saved = favorites.has(p.id);
      b.setAttribute("aria-pressed", saved);
      b.setAttribute(
        "aria-label",
        `${saved ? "Remover dos" : "Adicionar aos"} favoritos: ${p.name}`,
      );
    });
    $$("[data-compare]").forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        compared.includes(Number(b.dataset.compare)),
      ),
    );
    const bar = $("#compareBar");
    bar.hidden = !compared.length;
    document.body.classList.toggle("has-compare", !!compared.length);
    $("#compareCount").textContent = compared.length;
    $("#comparePreview").textContent = compared
      .map((id) => product(id).name)
      .join(" · ");
    $("#openCompare").disabled = compared.length < 2;
    if ($("#compareDialog").open) renderCompare();
  }
  function showDialog(id) {
    const d = $(id);
    if (d && !d.open) d.showModal();
  }
  function closeMenu() {
    $("#mobileNav").hidden = true;
    $("#menuToggle").setAttribute("aria-expanded", "false");
    $("#menuToggle").setAttribute("aria-label", "Abrir menu");
  }
  function showInfo(title, body) {
    $("#infoContent").innerHTML =
      `<span class="eyebrow">AUREL GYM</span><h2 id="infoTitle">${esc(title)}</h2>${body}`;
    showDialog("#infoDialog");
  }
  function matchesQuery(p, q) {
    return norm(q)
      .trim()
      .split(/\s+/)
      .every((term) =>
        norm([p.name, p.category, p.audience, ...p.colors].join(" ")).includes(
          term,
        ),
      );
  }
  function match(p, ignoreCategory = false) {
    return (
      (ignoreCategory ||
        state.category === "Todas" ||
        p.category === state.category) &&
      (!state.audience.size || state.audience.has(p.audience)) &&
      (!state.sizes.size || p.sizes.some((v) => state.sizes.has(v))) &&
      (!state.colors.size || p.colors.some((v) => state.colors.has(v))) &&
      p.price <= state.maxPrice &&
      (!state.onlyFavorites || favorites.has(p.id)) &&
      matchesQuery(p, state.query)
    );
  }
  function filtered() {
    const list = products.filter((p) => match(p));
    if (state.sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") list.sort((a, b) => b.price - a.price);
    if (state.sort === "name")
      list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }
  function card(p) {
    return `<article class="product-card" data-product-id="${p.id}" data-price="${p.price}"><div class="product-art" style="--position:${esc(p.position)};--zoom:${p.zoom}"><a class="product-image-button" href="${urlOf(p.id)}" aria-label="Conhecer ${esc(p.name)}"><img src="${esc(p.photo)}" alt="${esc(p.name)}, ${esc(p.colors[0])}" width="400" height="500" loading="lazy" decoding="async"></a><span class="product-badge">${esc(p.tag)}</span><button class="icon-button product-favorite" data-favorite="${p.id}" aria-label="Salvar ${esc(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon("heart")}</button><a class="quick-view" href="${urlOf(p.id)}">Conhecer a peça</a></div><div class="product-info"><p class="product-type">${esc(p.audience)} · ${esc(p.category)}</p><h3><a class="product-name" href="${urlOf(p.id)}">${esc(p.name)}</a></h3><p class="price">${money(p.price)}</p><div class="card-bottom"><span class="card-color"><span class="swatch" style="--swatch:${colors[p.colors[0]]}"></span>${esc(p.colors[0])}</span><button class="compare-choice" data-compare="${p.id}" aria-pressed="${compared.includes(p.id)}" aria-label="Comparar ${esc(p.name)}">${icon("compare")} Comparar</button></div></div></article>`;
  }
  function initFilters() {
    if (!hasCatalogue) return;
    $("#audienceFilters").innerHTML = ["Feminino", "Masculino", "Unissex"]
      .map(
        (a) =>
          `<label class="checkbox-label"><input type="checkbox" value="${a}" data-audience-filter>${a}</label>`,
      )
      .join("");
    $("#sizeFilters").innerHTML = availableSizes
      .map(
        (s) =>
          `<button class="size-button" data-size-filter="${esc(s)}" aria-pressed="false" aria-label="Filtrar tamanho ${esc(s)}">${esc(s)}</button>`,
      )
      .join("");
    $("#colorFilters").innerHTML = Object.entries(colors)
      .map(
        ([c, hex]) =>
          `<button class="color-filter" data-color-filter="${esc(c)}" aria-pressed="false"><span class="swatch" style="--swatch:${hex}"></span>${esc(c)}</button>`,
      )
      .join("");
  }
  function syncFilters() {
    $$("[data-audience-filter]").forEach(
      (x) => (x.checked = state.audience.has(x.value)),
    );
    $$("[data-size-filter]").forEach((x) =>
      x.setAttribute("aria-pressed", state.sizes.has(x.dataset.sizeFilter)),
    );
    $$("[data-color-filter]").forEach((x) =>
      x.setAttribute("aria-pressed", state.colors.has(x.dataset.colorFilter)),
    );
    $("#maxPrice").value = state.maxPrice;
    $("#priceOutput").textContent = money(state.maxPrice);
    $("#onlyFavorites").checked = state.onlyFavorites;
    $("#search").value = state.query;
    $("#sort").value = state.sort;
    const count =
      state.audience.size +
      state.sizes.size +
      state.colors.size +
      (state.maxPrice < catalogMaxPrice ? 1 : 0) +
      (state.onlyFavorites ? 1 : 0);
    $("#mobileFilterCount").textContent = count ? `(${count})` : "";
  }
  function render() {
    if (!hasCatalogue) return;
    const list = filtered();
    $("#categories").innerHTML = categories
      .map(
        (c) =>
          `<button class="category" data-category="${esc(c)}" aria-pressed="${state.category === c}">${esc(c)}<span>${products.filter((p) => match(p, true) && (c === "Todas" || p.category === c)).length}</span></button>`,
      )
      .join("");
    $("#productGrid").innerHTML = list.map(card).join("");
    $("#resultCount").textContent =
      `${list.length} ${list.length === 1 ? "peça encontrada" : "peças encontradas"}`;
    $("#applyFilters").textContent =
      `Ver ${list.length} ${list.length === 1 ? "peça" : "peças"}`;
    $("#emptyState").hidden = !!list.length;
    const chips = [];
    if (state.category !== "Todas") chips.push(["category", state.category]);
    for (const v of state.audience) chips.push(["audience", v]);
    for (const v of state.sizes) chips.push(["sizes", v]);
    for (const v of state.colors) chips.push(["colors", v]);
    if (state.maxPrice < catalogMaxPrice)
      chips.push(["price", `Até ${money(state.maxPrice)}`]);
    if (state.onlyFavorites) chips.push(["favorites", "Favoritos"]);
    if (state.query) chips.push(["query", state.query]);
    $("#activeFilters").innerHTML = chips
      .map(
        ([key, val]) =>
          `<button class="active-chip" data-remove-filter="${key}" data-value="${esc(val)}" aria-label="Remover filtro ${esc(val)}">${esc(val)} ${icon("close")}</button>`,
      )
      .join("");
    syncFilters();
    updateCounts();
    syncUrl();
    if ($("#searchSummary"))
      $("#searchSummary").textContent = state.query
        ? `Resultados para “${state.query}”`
        : state.onlyFavorites
          ? "Suas peças favoritas, reunidas aqui."
          : "Encontre a peça que acompanha seu ritmo.";
  }
  function resetFilters() {
    Object.assign(state, {
      category: "Todas",
      audience: new Set(),
      sizes: new Set(),
      colors: new Set(),
      maxPrice: catalogMaxPrice,
      query: "",
      sort: "featured",
      onlyFavorites: false,
    });
    render();
  }
  function toggle(set, v) {
    set.has(v) ? set.delete(v) : set.add(v);
  }
  function syncUrl() {
    if (!searchPage) return;
    const p = new URLSearchParams();
    if (state.query.trim()) p.set("q", state.query.trim());
    if (state.category !== "Todas") p.set("categoria", state.category);
    for (const [key, values] of [
      ["colecao", state.audience],
      ["tamanho", state.sizes],
      ["cor", state.colors],
    ])
      if (values.size) p.set(key, [...values].join(","));
    if (state.maxPrice < catalogMaxPrice) p.set("preco", state.maxPrice);
    if (state.sort !== "featured") p.set("ordem", state.sort);
    if (state.onlyFavorites) p.set("favoritos", "1");
    try {
      history.replaceState(
        null,
        "",
        location.pathname + (p.size ? "?" + p : "") + location.hash,
      );
    } catch {}
  }
  function loadUrl() {
    const p = new URLSearchParams(location.search);
    state.query = (p.get("q") || "").slice(0, 120);
    state.category = categories.includes(p.get("categoria"))
      ? p.get("categoria")
      : "Todas";
    const set = (key, allowed) =>
      new Set((p.get(key) || "").split(",").filter((x) => allowed.includes(x)));
    state.audience = set("colecao", ["Feminino", "Masculino", "Unissex"]);
    state.sizes = set("tamanho", availableSizes);
    state.colors = set("cor", Object.keys(colors));
    const price = Number(p.get("preco"));
    state.maxPrice =
      p.has("preco") && Number.isFinite(price)
        ? Math.max(0, Math.min(catalogMaxPrice, Math.round(price / 10) * 10))
        : catalogMaxPrice;
    state.onlyFavorites = p.get("favoritos") === "1";
    state.sort = ["featured", "price-asc", "price-desc", "name"].includes(
      p.get("ordem"),
    )
      ? p.get("ordem")
      : "featured";
  }
  function renderCompare() {
    const selected = compared.map(product);
    $("#compareContent").innerHTML = selected.length
      ? `<div class="compare-scroll" tabindex="0" role="region" aria-label="Tabela de comparação"><table class="compare-table"><caption>Compare as informações das peças selecionadas</caption><thead><tr><th scope="col">Sua escolha</th>${selected.map((p) => `<th scope="col"><a href="${urlOf(p.id)}"><img src="${esc(p.photo)}" alt="" width="160" height="180"><span>${esc(p.name)}</span></a><button class="text-button" data-remove-compare="${p.id}">Remover</button></th>`).join("")}</tr></thead><tbody>${[
          ["Preço", (p) => money(p.price)],
          ["Categoria", (p) => p.category],
          ["Coleção", (p) => p.audience],
          ["Cores", (p) => p.colors.join(", ")],
          ["Tamanhos", (p) => p.sizes.join(" · ")],
        ]
          .map(
            ([title, fn]) =>
              `<tr><th scope="row">${title}</th>${selected.map((p) => `<td>${esc(fn(p))}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`
      : `<div class="empty-state"><h3>Sua comparação está vazia.</h3><p>Escolha até três peças do catálogo.</p></div>`;
  }
  function toggleCompare(id) {
    if (compared.includes(id)) compared = compared.filter((v) => v !== id);
    else if (compared.length < 3) compared.push(id);
    else {
      toast("Compare até três peças. Remova uma para trocar.");
      return;
    }
    persist();
  }
  function renderCart() {
    $("#cartItems").innerHTML = cart.length
      ? cart
          .map((item, index) => {
            const p = product(item.id);
            return `<article class="cart-item"><a href="${urlOf(p.id)}"><img src="${esc(p.photo)}" alt="${esc(p.name)}" width="90" height="115"></a><div><h3><a href="${urlOf(p.id)}">${esc(p.name)}</a></h3><p>${esc(item.color)} · Tamanho ${esc(item.size)}</p><p class="price">${money(p.price * item.qty)}</p><div class="quantity"><button data-qty="-1" data-index="${index}" aria-label="Diminuir quantidade de ${esc(p.name)}" ${item.qty === 1 ? "disabled" : ""}>−</button><span>${item.qty}</span><button data-qty="1" data-index="${index}" aria-label="Aumentar quantidade de ${esc(p.name)}" ${item.qty === 20 ? "disabled" : ""}>+</button></div><button class="text-button cart-save" data-save-item="${index}">Mover para favoritos</button></div><button class="icon-button" data-remove-item="${index}" aria-label="Remover ${esc(p.name)}">${icon("trash")}</button></article>`;
          })
          .join("")
      : `<div class="cart-empty">${icon("bag")}<h3>Encontre seu próximo essencial.</h3><p>Sua sacola está pronta para suas escolhas.</p><a class="button primary" href="pesquisa.html">Explorar coleção</a></div>`;
    $("#cartSummary").innerHTML = cart.length
      ? `<div class="cart-total"><span>Subtotal · ${cart.reduce((n, x) => n + x.qty, 0)} itens</span><strong>${money(cart.reduce((n, x) => n + product(x.id).price * x.qty, 0))}</strong></div><a class="button primary" href="checkout.html">Continuar para entrega e pagamento</a><button class="text-button" id="downloadSelection">Baixar minha seleção</button><p>Seu pedido será registrado no sistema. Nenhuma cobrança é realizada nesta etapa.</p>`
      : "";
  }
  function removeCartItem(index, save = false) {
    const item = cart[index];
    if (!item) return;
    const snapshot = cart.map((x) => ({ ...x }));
    cart.splice(index, 1);
    if (save) favorites.add(item.id);
    persist();
    renderCart();
    render();
    toast(
      save ? "Peça movida para favoritos." : "Peça removida da sacola.",
      () => {
        cart = snapshot;
        persist();
        renderCart();
        toast("Sua sacola foi restaurada.");
      },
    );
  }
  function downloadSelection() {
    const text = [
      "AUREL GYM — MINHA SELEÇÃO",
      "",
      ...cart.map((x) => {
        const p = product(x.id);
        return `${p.name} | ${x.color} | tamanho ${x.size} | ${x.qty} unidade(s) | ${money(p.price * x.qty)}`;
      }),
      "",
      `Subtotal: ${money(cart.reduce((n, x) => n + product(x.id).price * x.qty, 0))}`,
      "Esta seleção não é um pedido e não gera cobrança.",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "minha-selecao-aurel-gym.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Seleção preparada para baixar.");
  }
  function renderProduct() {
    if (!$("#productView")) return;
    const p = product(new URLSearchParams(location.search).get("id"));
    if (!p) {
      $("#productView").innerHTML =
        '<div class="empty-state"><h1>Peça não encontrada.</h1><p>Confira as opções disponíveis no catálogo.</p><a href="pesquisa.html" class="button primary">Ver coleção</a></div>';
      document.title = "Peça não encontrada — Aurel Gym";
      return;
    }
    detail = { p, color: p.colors[0], size: null, qty: 1 };
    document.title = `${p.name} — Aurel Gym`;
    document.querySelector('meta[name="description"]').content = p.description;
    recent = [p.id, ...recent.filter((id) => id !== p.id)].slice(0, 6);
    persist();
    $("#productBreadcrumb").textContent = p.name;
    $("#productView").innerHTML =
      `<div class="product-page-grid"><div class="product-gallery"><button class="product-main-photo" id="zoomPhoto" aria-label="Ampliar foto de ${esc(p.name)}" style="--position:${esc(p.position)};--zoom:${p.zoom}"><img src="${esc(p.photo)}" alt="${esc(p.name)} em ${esc(detail.color)}" width="600" height="750" fetchpriority="high"><span>${icon("zoom")} Ampliar foto</span></button><p class="gallery-note">Explore os detalhes. Toque na foto para ampliar.</p></div><section class="product-page-info" aria-labelledby="productTitle"><span class="eyebrow">${esc(p.audience)} / ${esc(p.category)}</span><div class="product-title-row"><h1 id="productTitle">${esc(p.name)}</h1><button class="icon-button" data-favorite="${p.id}" aria-label="Salvar ${esc(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon("heart")}</button></div><p class="detail-price">${money(p.price)}</p><p class="detail-description">${esc(p.description)}</p><div class="product-options"><p class="detail-label">Cor: <strong>${esc(detail.color)}</strong></p><div class="detail-colors">${p.colors.map((c) => `<button class="selected" data-detail-color="${esc(c)}" aria-label="Cor ${esc(c)}" aria-pressed="true"><span class="swatch" style="--swatch:${colors[c]}"></span></button>`).join("")}</div><div class="size-label-row"><p class="detail-label" id="sizeLabel">Escolha seu tamanho</p><button class="text-button" data-guide>${icon("ruler")} Guia de medidas</button></div><div class="detail-sizes" role="group" aria-labelledby="sizeLabel">${availableSizes.map((s) => `<button class="size-button" data-detail-size="${esc(s)}" aria-pressed="false" aria-label="Tamanho ${esc(s)}${p.sizes.includes(s) ? "" : " indisponível"}" ${p.sizes.includes(s) ? "" : "disabled"}>${esc(s)}</button>`).join("")}</div><p id="sizeHelper" class="size-helper" role="status">Selecione um tamanho antes de adicionar.</p></div><div class="product-purchase"><div class="quantity product-quantity"><button id="detailMinus" aria-label="Diminuir quantidade" disabled>−</button><span id="detailQty">1</span><button id="detailPlus" aria-label="Aumentar quantidade">+</button></div><button class="button primary" id="addToCart">Adicionar à sacola ${icon("bag")}</button></div><div class="product-utilities"><button class="text-button" data-compare="${p.id}" aria-pressed="${compared.includes(p.id)}">${icon("compare")} Comparar peça</button><button class="text-button" id="shareProduct">${icon("share")} Compartilhar</button></div><details class="product-accordion" open><summary>Sobre esta peça</summary><p>${esc(p.description)}</p><dl><div><dt>Categoria</dt><dd>${esc(p.category)}</dd></div><div><dt>Tamanhos no catálogo</dt><dd>${esc(p.sizes.join(", "))}</dd></div></dl></details><details class="product-accordion"><summary>Escolha e cuidados</summary><p>Compare suas medidas com a tabela específica da peça quando ela estiver disponível. Para lavagem e secagem, siga sempre as instruções da etiqueta.</p><a href="ajuda.html#medidas">Veja como tirar suas medidas</a></details><details class="product-accordion"><summary>Como funciona a sacola?</summary><p>Ela reúne suas escolhas neste navegador. Você pode ajustar quantidades, salvar favoritos e baixar a seleção. Compras e pagamentos online ainda não estão disponíveis.</p></details></section></div>`;
    const related = products
      .filter((x) => x.id !== p.id)
      .sort(
        (a, b) =>
          Number(b.category === p.category) -
            Number(a.category === p.category) ||
          Number(b.audience === p.audience) - Number(a.audience === p.audience),
      )
      .slice(0, 3);
    $("#relatedGrid").innerHTML = related.map(card).join("");
    $("#relatedSection").hidden = false;
    const viewed = recent
      .filter((id) => id !== p.id)
      .slice(0, 3)
      .map(product);
    $("#recentSection").hidden = !viewed.length;
    $("#recentGrid").innerHTML = viewed.map(card).join("");
    updateCounts();
  }
  function addToCart() {
    if (!detail) return;
    if (!detail.size) {
      $("#sizeHelper").textContent = "Escolha seu tamanho para continuar.";
      $("#sizeHelper").classList.add("error");
      $("[data-detail-size]:not(:disabled)").focus();
      return;
    }
    const found = cart.find(
      (x) =>
        x.id === detail.p.id &&
        x.size === detail.size &&
        x.color === detail.color,
    );
    if ((found?.qty || 0) + detail.qty > 20) {
      toast("Limite de 20 unidades por tamanho e cor.");
      return;
    }
    if (found) found.qty += detail.qty;
    else
      cart.push({
        id: detail.p.id,
        color: detail.color,
        size: detail.size,
        qty: detail.qty,
      });
    persist();
    renderCart();
    showDialog("#cartDialog");
  }
  function quickSearch() {
    const query = $("#quickSearch").value.trim().slice(0, 120);
    const list = (
      query ? products.filter((p) => matchesQuery(p, query)) : products
    ).slice(0, 4);
    $("#quickResults").innerHTML = list.length
      ? list
          .map(
            (p) =>
              `<a class="quick-result" href="${urlOf(p.id)}"><img src="${esc(p.photo)}" alt="" width="58" height="70"><span><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.colors[0])}</small></span><b>${money(p.price)}</b></a>`,
          )
          .join("")
      : '<p class="quick-empty">Nenhuma peça encontrada. Experimente buscar por cor ou categoria.</p>';
    $("#quickCount").textContent = query
      ? `${list.length} sugestões para sua busca`
      : "Explore algumas peças";
  }
  function openSearch() {
    closeMenu();
    quickSearch();
    showDialog("#searchDialog");
    $("#quickSearch").focus();
  }
  function renderHelp() {
    const q = norm($("#helpSearch")?.value || "").trim();
    let count = 0;
    $$(".faq-list details").forEach((d) => {
      d.hidden = q && !norm(d.textContent).includes(q);
      if (!d.hidden) count++;
    });
    if ($("#helpEmpty")) $("#helpEmpty").hidden = !!count;
  }
  async function accountBadge() {
    if (location.protocol === "file:") return;
    try {
      const d = await window.AurelDB.request();
      $("#accountLink").classList.toggle("is-signed-in", !!d.user);
      $("#accountLink").setAttribute(
        "aria-label",
        d.user ? `Minha conta: ${d.user.name}` : "Entrar na minha conta",
      );
    } catch {}
  }
  function toggleSizeGuide() {
    showDialog("#guideDialog");
  }
  async function shareProduct() {
    if (!detail) return;
    const link = new URL(urlOf(detail.p.id), location.href).href;
    if (location.protocol === "file:") {
      toast(
        "Publique o site para compartilhar um link acessível em outros dispositivos.",
      );
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: detail.p.name, url: link });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        toast("Link da peça copiado.");
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return;
    }
    showInfo(
      "Link da peça",
      `<label class="form-field">Copie este endereço<input value="${esc(link)}" readonly aria-label="Link da peça"></label>`,
    );
  }
  function restoreFocus(selector) {
    $(selector)?.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b) return;
    if (b.hasAttribute("data-close")) b.closest("dialog").close();
    if (b.hasAttribute("data-favorite")) {
      const id = Number(b.dataset.favorite);
      toggle(favorites, id);
      persist();
      if (state.onlyFavorites) render();
      toast(
        favorites.has(id)
          ? "Peça salva nos favoritos."
          : "Peça removida dos favoritos.",
      );
    }
    if (b.hasAttribute("data-compare"))
      toggleCompare(Number(b.dataset.compare));
    if (b.hasAttribute("data-remove-compare")) {
      compared = compared.filter((x) => x !== Number(b.dataset.removeCompare));
      persist();
    }
    if (b.hasAttribute("data-category")) {
      state.category = b.dataset.category;
      render();
      restoreFocus(`[data-category="${CSS.escape(state.category)}"]`);
    }
    if (b.hasAttribute("data-size-filter")) {
      toggle(state.sizes, b.dataset.sizeFilter);
      render();
      restoreFocus(`[data-size-filter="${CSS.escape(b.dataset.sizeFilter)}"]`);
    }
    if (b.hasAttribute("data-color-filter")) {
      toggle(state.colors, b.dataset.colorFilter);
      render();
      restoreFocus(`[data-color-filter="${CSS.escape(b.dataset.colorFilter)}"]`);
    }
    if (b.hasAttribute("data-remove-filter")) {
      const key = b.dataset.removeFilter;
      if (key === "category") state.category = "Todas";
      else if (key === "price") state.maxPrice = catalogMaxPrice;
      else if (key === "query") state.query = "";
      else if (key === "favorites") state.onlyFavorites = false;
      else state[key].delete(b.dataset.value);
      render();
    }
    if (b.hasAttribute("data-collection") && hasCatalogue) {
      resetFilters();
      closeMenu();
    }
    if (b.hasAttribute("data-detail-size")) {
      detail.size = b.dataset.detailSize;
      $$("[data-detail-size]").forEach((x) =>
        x.setAttribute("aria-pressed", x === b),
      );
      $("#sizeHelper").textContent = `Tamanho ${detail.size} selecionado.`;
      $("#sizeHelper").classList.remove("error");
    }
    if (b.hasAttribute("data-qty")) {
      const index = Number(b.dataset.index);
      cart[index].qty = Math.min(
        20,
        Math.max(1, cart[index].qty + Number(b.dataset.qty)),
      );
      persist();
      renderCart();
      restoreFocus(`[data-qty="${b.dataset.qty}"][data-index="${index}"]`);
    }
    if (b.hasAttribute("data-remove-item"))
      removeCartItem(Number(b.dataset.removeItem));
    if (b.hasAttribute("data-save-item"))
      removeCartItem(Number(b.dataset.saveItem), true);
    if (b.hasAttribute("data-guide")) toggleSizeGuide();
    if (b.hasAttribute("data-suggestion")) {
      resetFilters();
      state.query = b.dataset.suggestion;
      render();
      $("#search").focus();
    }
    if (b.id === "addToCart") addToCart();
    if (b.id === "detailPlus" || b.id === "detailMinus") {
      detail.qty = Math.max(
        1,
        Math.min(20, detail.qty + (b.id === "detailPlus" ? 1 : -1)),
      );
      $("#detailQty").textContent = detail.qty;
      $("#detailMinus").disabled = detail.qty === 1;
      $("#detailPlus").disabled = detail.qty === 20;
    }
    if (b.id === "zoomPhoto") {
      $("#zoomImage").src = detail.p.photo;
      $("#zoomImage").alt = detail.p.name;
      $("#zoomTitle").textContent = detail.p.name;
      showDialog("#zoomDialog");
    }
    if (b.id === "shareProduct") shareProduct();
    if (b.id === "downloadSelection") downloadSelection();
    if (b.id === "toastAction" && undoAction) {
      const fn = undoAction;
      undoAction = null;
      fn();
    }
    if (b.closest("#mobileNav")) closeMenu();
  });
  $("#searchToggle").addEventListener("click", (e) => {
    e.preventDefault();
    openSearch();
  });
  $("#headerSearch")?.addEventListener("click", openSearch);
  $("#quickSearch").addEventListener("input", quickSearch);
  $("#cartToggle").addEventListener("click", () => {
    closeMenu();
    renderCart();
    showDialog("#cartDialog");
  });
  $("#favoriteToggle").addEventListener("click", () => {
    if (!hasCatalogue) {
      location.href = "pesquisa.html?favoritos=1";
      return;
    }
    const next = !state.onlyFavorites;
    resetFilters();
    state.onlyFavorites = next;
    render();
    $("#catalogo").scrollIntoView();
  });
  $("#menuToggle").addEventListener("click", () => {
    const open = $("#mobileNav").hidden;
    $("#mobileNav").hidden = !open;
    $("#menuToggle").setAttribute("aria-expanded", open);
    $("#menuToggle").setAttribute(
      "aria-label",
      open ? "Fechar menu" : "Abrir menu",
    );
  });
  $("#clearCompare").addEventListener("click", () => {
    compared = [];
    persist();
  });
  $("#openCompare").addEventListener("click", () => {
    renderCompare();
    showDialog("#compareDialog");
  });
  $("#aboutBrand").addEventListener("click", () =>
    showInfo(
      "Seu movimento. Seu momento.",
      '<p>A Aurel Gym é um convite para encontrar seu próprio ritmo. Descubra peças, compare suas escolhas e monte suas combinações.</p><a href="ajuda.html" class="underlined-link">Conheça a central de ajuda</a>',
    ),
  );
  $("#photoCredits").addEventListener("click", () =>
    showInfo(
      "Créditos das imagens",
      "<p>Fotografias de roupas e atividades esportivas obtidas no Unsplash. A autoria e os links de origem estão no arquivo CREDITOS.md do projeto.</p>",
    ),
  );
  $("#search")?.addEventListener("input", (e) => {
    state.query = e.target.value.slice(0, 120);
    render();
  });
  $("#searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.query = $("#search").value.trim();
    render();
    $("#resultCount").focus();
  });
  $("#clearSearch")?.addEventListener("click", () => {
    state.query = "";
    render();
    $("#search").focus();
  });
  $("#audienceFilters")?.addEventListener("change", (e) => {
    toggle(state.audience, e.target.value);
    render();
  });
  $("#sort")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
  $("#maxPrice")?.addEventListener("input", (e) => {
    state.maxPrice = Number(e.target.value);
    render();
  });
  $("#onlyFavorites")?.addEventListener("change", (e) => {
    state.onlyFavorites = e.target.checked;
    render();
  });
  $("#clearFilters")?.addEventListener("click", resetFilters);
  $("#resetEmpty")?.addEventListener("click", resetFilters);
  $("#openFilters")?.addEventListener("click", () =>
    showDialog("#filterDialog"),
  );
  $("#applyFilters").addEventListener("click", () =>
    $("#filterDialog").close(),
  );
  $("#helpSearch")?.addEventListener("input", renderHelp);
  $("#clearPreferences")?.addEventListener("click", () =>
    showDialog("#clearDialog"),
  );
  $("#confirmClear")?.addEventListener("click", () => {
    favorites.clear();
    cart = [];
    compared = [];
    recent = [];
    persist();
    $("#privacyMessage").textContent =
      "Preferências deste navegador removidas.";
    $("#clearDialog").close();
  });
  const mobile = matchMedia("(max-width:850px)");
  function moveFilters() {
    if (!$("#filterPanel")) return;
    if ($("#filterDialog").open) $("#filterDialog").close();
    (mobile.matches ? $("#mobileFilterSlot") : $("#filterSlot")).append(
      $("#filterPanel"),
    );
  }
  mobile.addEventListener("change", moveFilters);
  matchMedia("(min-width:951px)").addEventListener("change", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
    const typing = e.target.closest("input,textarea,select,[contenteditable]");
    if (!typing && e.key === "/" && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      openSearch();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".header")) closeMenu();
  });
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    });
    d.addEventListener("close", () => {
      document.body.classList.toggle(
        "dialog-open",
        !!document.querySelector("dialog[open]"),
      );
      if (d.contains($("#toast"))) document.body.append($("#toast"));
    });
  });
  new MutationObserver(() =>
    document.body.classList.toggle(
      "dialog-open",
      !!document.querySelector("dialog[open]"),
    ),
  ).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  window.addEventListener("popstate", () => {
    loadUrl();
    render();
  });
  function refreshPreferences() {
    favorites = new Set(ids("aurel-favorites-v1"));
    compared = ids("aurel-compare-v1").slice(0, 3);
    recent = ids("aurel-recent-v1").slice(0, 6);
    const saved = read("aurel-cart-photo-v1", []);
    cart = Array.isArray(saved)
      ? saved.filter(
          (x) =>
            x &&
            product(x.id)?.sizes.includes(x.size) &&
            product(x.id)?.colors.includes(x.color) &&
            Number.isInteger(x.qty) &&
            x.qty >= 1 &&
            x.qty <= 20,
        )
      : [];
    render();
    updateCounts();
    if ($("#cartDialog").open) renderCart();
  }
  window.addEventListener("pageshow", refreshPreferences);
  document.addEventListener("aurel:preferences", refreshPreferences);
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("aurel-")) refreshPreferences();
  });
  const page = document.body.dataset.page;
  $(`[data-nav="${page}"]`)?.setAttribute("aria-current", "page");
  window.Aurel = { $, $$, icon, toast, accountBadge };
  document.addEventListener("aurel:session", accountBadge);
  document.dispatchEvent(new Event("aurel:ready"));
  initFilters();
  loadUrl();
  hydrate();
  moveFilters();
  render();
  renderProduct();
  updateCounts();
  accountBadge();
  if (new URLSearchParams(location.search).get("sacola") === "1") {
    renderCart();
    showDialog("#cartDialog");
  }
})();
