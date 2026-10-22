(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const db = window.AurelDB;
  const client = db.client;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  let products = [], categories = [], customers = [], customerTotal = 0, editingId = null, currentUser = null, loading = false;
  document.dispatchEvent(new Event('aurel:ready'));
  function message(text, error = false, target = '#adminMessage') {
    $(target).textContent = text;
    $(target).classList.toggle('is-error', error);
  }
  function friendlyError(error) {
    if (error.code === '23503') return 'Esta categoria possui produtos. Mova as peças para outra categoria antes de removê-la.';
    if (error.code === '23505') return 'Este registro já existe. Escolha outro nome.';
    if (error.code === '42501' || error.status === 403) return 'Seu acesso de administrador não está disponível. Entre novamente.';
    return 'Não foi possível concluir a ação. Confira os dados e tente novamente.';
  }
  function safePhoto(value) {
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== 'https:' && url.origin !== location.origin) return '';
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.href;
    } catch { return ''; }
  }
  function renderProducts() {
    const search = $('#productSearch').value.trim().toLocaleLowerCase('pt-BR');
    const filter = $('#productFilter').value;
    const visible = products.filter(p => `${p.name} ${p.category}`.toLocaleLowerCase('pt-BR').includes(search) && (filter === 'all' || p.active === (filter === 'active')));
    $('#productRows').innerHTML = visible.map(p => `<tr><td><div class="product-cell"><img src="${esc(safePhoto(p.photo))}" alt="" loading="lazy" /><div><strong>${esc(p.name)}</strong><small>${esc(p.audience)}</small></div></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td><span class="status-tag ${p.active ? '' : 'inactive'}">${p.active ? 'Ativo' : 'Oculto'}</span></td><td><div class="row-actions"><button type="button" data-edit="${p.id}" aria-label="Editar ${esc(p.name)}">Editar</button><button type="button" data-toggle="${p.id}" aria-label="${p.active ? 'Ocultar' : 'Ativar'} ${esc(p.name)}">${p.active ? 'Ocultar' : 'Ativar'}</button></div></td></tr>`).join('');
    $('#productsEmpty').hidden = !!visible.length;
    $('#productCount').textContent = products.length;
    $('#activeCount').textContent = products.filter(p => p.active).length;
  }
  function renderCategories() {
    $('#categoryCount').textContent = categories.length;
    $('#categoryList').innerHTML = categories.map(name => `<li><span>${esc(name)} <small>(${products.filter(p => p.category === name).length} peças)</small></span><button type="button" data-remove-category="${esc(name)}" aria-label="Remover categoria ${esc(name)}">Remover</button></li>`).join('');
    $('#editCategory').innerHTML = categories.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  }
  function renderCustomers() {
    $('#customerCount').textContent = customerTotal;
    $('#customerRows').innerHTML = customers.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${new Date(c.created_at).toLocaleDateString('pt-BR')}</td><td>${esc(c.terms_version || 'Não informado')}</td></tr>`).join('');
    $('#customerSummary').textContent = `Exibindo ${customers.length} de ${customerTotal} cadastros.`;
    $('#moreCustomers').hidden = customers.length >= customerTotal;
  }
  async function load() {
    if (loading) return;
    loading = true;
    $('#refreshAdmin').disabled = true;
    message('Atualizando dados…');
    try {
      const results = await Promise.all([
        client.from('products').select('*').order('id'),
        client.from('categories').select('name').order('name'),
        client.from('profiles').select('id,name,email,created_at,terms_version', { count:'exact' }).order('created_at',{ascending:false}).order('id').range(0,99)
      ]);
      for (const result of results) if (result.error) throw result.error;
      products = results[0].data;
      categories = results[1].data.map(c => c.name);
      customers = results[2].data;
      customerTotal = results[2].count;
      renderProducts(); renderCategories(); renderCustomers(); message('');
    } catch (error) { message(friendlyError(error), true); }
    finally { loading = false; $('#refreshAdmin').disabled = false; }
  }
  function openProduct(product) {
    editingId = product?.id ?? null;
    $('#productForm').reset(); message('',false,'#productMessage');
    $('#productDialogTitle').textContent = product ? 'Editar produto' : 'Adicionar produto';
    if (!categories.length) { message('Adicione uma categoria antes de criar um produto.', true); return; }
    if (product) {
      for (const key of ['name','category','audience','price','tag','photo','position','zoom','description']) $('#productForm').elements[key].value = product[key];
      for (const key of ['colors','sizes']) $('#productForm').elements[key].value = product[key].join(', ');
      $('#productForm').elements.active.checked = product.active;
    }
    $('#productDialog').showModal();
  }
  $('#newProduct').addEventListener('click', () => openProduct());
  $('#closeProduct').addEventListener('click', () => { if (!$('#productFields').disabled) $('#productDialog').close(); });
  $('#cancelProduct').addEventListener('click', () => $('#productDialog').close());
  $('#productDialog').addEventListener('cancel', event => { if ($('#productFields').disabled) event.preventDefault(); });
  $('#productSearch').addEventListener('input', renderProducts);
  $('#productFilter').addEventListener('change', renderProducts);
  $('#refreshAdmin').addEventListener('click', load);
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-section]').forEach(item => { if (item === button) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current'); });
    for (const section of ['products','categories','sales','customers']) $(`#${section}Section`).hidden = section !== button.dataset.section;
    if (button.dataset.section === 'sales') window.AurelSalesAdmin.render();
  }));
  $('#productForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const f = form.elements;
    const list = key => [...new Set(f[key].value.split(',').map(x => x.trim()).filter(Boolean))];
    const payload = { name:f.name.value.trim(),category:f.category.value,audience:f.audience.value,price:Number(f.price.value),tag:f.tag.value.trim(),colors:list('colors'),sizes:list('sizes'),photo:f.photo.value.trim(),position:f.position.value.trim() || '50% 50%',zoom:Number(f.zoom.value),description:f.description.value.trim(),active:f.active.checked };
    if (!payload.name || !payload.colors.length || !payload.sizes.length || !safePhoto(payload.photo)) { message('Informe o nome, as cores, os tamanhos e uma imagem HTTPS ou um caminho da loja.',true,'#productMessage'); return; }
    if (!/^\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(payload.position)) { message('Use a posição em porcentagens, por exemplo: 50% 50%.',true,'#productMessage'); return; }
    $('#productFields').disabled = true;
    message('Salvando…',false,'#productMessage');
    try {
      const result = editingId === null ? await client.from('products').insert(payload).select('id').single() : await client.from('products').update(payload).eq('id',editingId).select('id').single();
      if (result.error) throw result.error;
      $('#productDialog').close(); await load(); message('Produto salvo. A alteração aparecerá ao atualizar a loja.');
    } catch (error) { message(friendlyError(error),true,'#productMessage'); }
    finally { $('#productFields').disabled = false; }
  });
  $('#productRows').addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit]');
    if (edit) { openProduct(products.find(p => p.id === Number(edit.dataset.edit))); return; }
    const button = event.target.closest('[data-toggle]');
    if (!button) return;
    const product = products.find(p => p.id === Number(button.dataset.toggle));
    button.disabled = true;
    try {
      const result = await client.from('products').update({active:!product.active}).eq('id',product.id).select('id').single();
      if (result.error) throw result.error;
      await load(); message(product.active ? 'Produto ocultado da loja.' : 'Produto ativado na loja.');
    } catch (error) { message(friendlyError(error),true); button.disabled = false; }
  });
  $('#categoryForm').addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('#categoryName').value.trim();
    if (!name) return;
    const button = event.target.querySelector('button'); button.disabled = true;
    try {
      const result = await client.from('categories').insert({name}).select('name').single();
      if (result.error) throw result.error;
      event.target.reset(); await load(); message('Categoria adicionada.');
    } catch (error) { message(friendlyError(error),true); }
    finally { button.disabled = false; }
  });
  $('#categoryList').addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-category]'); if (!button) return;
    const name = button.dataset.removeCategory;
    if (products.some(p => p.category === name)) { message('Mova os produtos para outra categoria antes de removê-la.',true); return; }
    if (!confirm(`Remover a categoria “${name}”?`)) return;
    button.disabled = true;
    try {
      const result = await client.from('categories').delete().eq('name',name).select('name').single();
      if (result.error) throw result.error;
      await load(); message('Categoria removida.');
    } catch (error) { message(friendlyError(error),true); button.disabled = false; }
  });
  $('#moreCustomers').addEventListener('click', async () => {
    const button = $('#moreCustomers'); button.disabled = true;
    try {
      const result = await client.from('profiles').select('id,name,email,created_at,terms_version').order('created_at',{ascending:false}).order('id').range(customers.length,customers.length+99);
      if (result.error) throw result.error;
      customers.push(...result.data); renderCustomers();
    } catch (error) { message(friendlyError(error),true); }
    finally { button.disabled = false; }
  });
  $('#adminLogout').addEventListener('click', async () => {
    $('#adminLogout').disabled = true;
    try { await db.request({action:'logout'}); location.replace('login.html'); }
    catch (error) { message(error.message,true); $('#adminLogout').disabled = false; }
  });
  async function authorize() {
    try {
      const {user} = await db.request();
      currentUser = user;
      $('#adminApp').hidden = !user?.isAdmin;
      $('#adminGate').hidden = !!user?.isAdmin;
      if (!user?.isAdmin) {
        $('#productDialog').close(); products=[];categories=[];customers=[];
        window.AurelSalesAdmin.clear();
        $('#productRows').replaceChildren(); $('#customerRows').replaceChildren(); $('#categoryList').replaceChildren();
        $('#gateMessage').textContent = user ? 'Sua conta não possui permissão de administrador. Entre com a conta autorizada da loja.' : 'Entre com a conta de administrador para gerenciar a loja.';
        return;
      }
      $('#adminIdentity').textContent = `${user.name} · ${user.email}`;
      await load();
      await window.AurelSalesAdmin.load();
    } catch (error) { $('#adminApp').hidden=true; $('#adminGate').hidden=false; $('#gateMessage').textContent=error.message || 'Não foi possível verificar seu acesso. Tente novamente.'; }
  }
  document.addEventListener('aurel:session', authorize);
  authorize();
})();
