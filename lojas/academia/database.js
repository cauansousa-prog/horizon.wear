(() => {
  'use strict';
  const client = supabase.createClient('https://tfoljlaubarztsuurctt.supabase.co', 'sb_publishable_NUQsSijBCU9cpGoS4FJ13w_Cw4KkzfO');
  let readyStore;
  const storeReady = new Promise(resolve => { readyStore = resolve; });
  document.addEventListener('aurel:ready', readyStore, { once: true });
  const userOf = user => user ? { id: user.id, email: user.email, name: user.user_metadata?.name || 'Cliente Aurel' } : null;
  const callbackURL = 'https://aurelgymjk.vercel.app/login.html';
  const callbackParams = new URLSearchParams(location.hash.slice(1));
  const callbackError = callbackParams.get('error') ? 'Este link expirou ou já foi utilizado. Solicite um novo e-mail abaixo.' : null;
  let recovery = callbackParams.get('type') === 'recovery';
  function authError(error) {
    const messages = {
      invalid_credentials: 'E-mail ou senha incorretos.',
      email_not_confirmed: 'Confirme seu e-mail antes de entrar. Use “Reenviar confirmação” abaixo.',
      over_email_send_rate_limit: 'O limite de envio de e-mails foi atingido. Aguarde e tente novamente.',
      over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      email_address_not_authorized: 'Não foi possível enviar e-mail para este endereço. O envio de e-mails da loja precisa ser configurado.',
      email_address_invalid: 'Informe um endereço de e-mail válido.',
      user_already_exists: 'Este e-mail já está cadastrado. Entre ou recupere sua senha.',
      weak_password: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
      otp_expired: 'Este link expirou ou já foi utilizado. Solicite um novo e-mail.',
      signup_disabled: 'Novos cadastros estão temporariamente indisponíveis.'
    };
    const translated = new Error(messages[error.code] || (error.message?.includes('fetch') ? 'Não foi possível conectar. Confira sua conexão e tente novamente.' : 'Não foi possível concluir esta ação. Tente novamente em alguns instantes.'));
    translated.code = error.code;
    return translated;
  }
  let owner = null, saving = Promise.resolve();
  async function profile(user) {
    if (!user) return null;
    const { data, error } = await client.from('profiles').select('name').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error } = await client.from('profiles').upsert({ id: user.id, name: userOf(user).name.slice(0,80), terms_version: user.user_metadata?.terms_version || null }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    }
    const admin = await client.from('aurel_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (admin.error) throw admin.error;
    return { ...userOf(user), name: data?.name || userOf(user).name, isAdmin: !!admin.data };
  }
  async function loadPreferences(user, mergeGuest = false) {
    if (!user) return;
    const results = await Promise.all([
      client.from('favorites').select('product_id').eq('user_id', user.id),
      client.from('cart_items').select('product_id,size,color,qty').eq('user_id', user.id)
    ]);
    for (const r of results) if (r.error) throw r.error;
    let favorites = results[0].data.map(x => x.product_id);
    let cart = results[1].data.map(x => ({ id: x.product_id, size: x.size, color: x.color, qty: x.qty }));
    if (mergeGuest) {
      try {
        const guestFavorites = JSON.parse(localStorage.getItem('aurel-favorites-v1') || '[]');
        const guestCart = JSON.parse(localStorage.getItem('aurel-cart-photo-v1') || '[]');
        const { data: pieces, error } = await client.from('products').select('id,sizes,colors').eq('active',true);
        if (error) throw error;
        const valid = new Map(pieces.map(x => [x.id,x]));
        favorites = [...new Set([...favorites, ...guestFavorites.filter(id => valid.has(id))])].slice(0,100);
        for (const item of guestCart) {
          const p = valid.get(item.id);
          if (!p || !p.sizes.includes(item.size) || !p.colors.includes(item.color) || !Number.isInteger(item.qty) || item.qty<1 || item.qty>20) continue;
          const existing = cart.find(x => x.id===item.id && x.size===item.size && x.color===item.color);
          if (existing) existing.qty=Math.min(20,existing.qty+item.qty); else cart.push(item);
        }
        cart=cart.slice(0,100);
        const saved = await client.rpc('save_preferences', {favorite_ids:favorites,items:cart});
        if(saved.error) throw saved.error;
      } catch(error) { console.warn('Aurel: seleção de visitante',error.message); }
    }
    localStorage.setItem('aurel-favorites-v1', JSON.stringify(favorites));
    localStorage.setItem('aurel-cart-photo-v1', JSON.stringify(cart));
    document.dispatchEvent(new Event('aurel:preferences'));
  }
  const ready = (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    owner = data.session?.user.id || null;
    if (data.session) { await profile(data.session.user); await loadPreferences(data.session.user); }
  })().catch(error => console.warn('Aurel: sessão indisponível', error.message));
  async function catalogue(fallback) {
    await ready;
    try {
      const { data, error } = await client.from('products').select('id,name,category,audience,price,colors,sizes,tag,photo,position,zoom,description').eq('active', true).order('id');
      if (error) throw error;
      document.documentElement.dataset.catalogSource = 'supabase';
      return data.map(p => ({ ...p, price: Number(p.price), zoom: Number(p.zoom) }));
    } catch (error) {
      document.documentElement.dataset.catalogSource = 'fallback';
      console.warn('Aurel: catálogo offline', error.message);
      return fallback;
    }
  }
  function savePreferences(favorites, cart) {
    const snapshot = { favorite_ids: [...favorites], items: cart.map(x => ({ ...x })) };
    const expectedOwner = owner;
    if (!expectedOwner) return;
    saving = saving.catch(() => {}).then(async () => {
      if (owner !== expectedOwner) return;
      const { error } = await client.rpc('save_preferences', snapshot);
      if (error) {
        window.Aurel?.toast('Seleção salva neste navegador. Não foi possível sincronizar com sua conta.');
        throw error;
      }
    });
    saving.catch(error => console.warn('Aurel: sincronização', error.message));
  }
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      setTimeout(() => document.dispatchEvent(new Event('aurel:recovery')), 0);
    }
    const next = session?.user.id || null;
    if (next === owner) return;
    const mergeGuest = !owner && !!session && event === "SIGNED_IN";
    owner = next;
    setTimeout(async () => {
      try {
        await storeReady;
        if (session && owner === session.user.id) { await profile(session.user); await loadPreferences(session.user, mergeGuest); }
        else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('aurel-favorites-v1'); localStorage.removeItem('aurel-cart-photo-v1');
          document.dispatchEvent(new Event('aurel:preferences'));
        }
        document.dispatchEvent(new Event('aurel:session'));
      } catch (error) { window.Aurel?.toast('Não foi possível carregar os dados da conta.'); }
    }, 0);
  });
  async function request(body) {
    await ready;
    let result;
    if (!body) {
      const { data, error } = await client.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw authError(error);
      return { user: await profile(data?.user) };
    }
    if (body.action === 'login') result = await client.auth.signInWithPassword({ email: body.email, password: body.password });
    else if (body.action === 'register') {
      if (!body.terms || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) throw new Error('Informe um nome entre 2 e 80 caracteres e aceite os termos.');
      if (body.password.length < 8 || body.password.length > 128) throw new Error('Use uma senha entre 8 e 128 caracteres.');
      result = await client.auth.signUp({ email: body.email.trim().toLowerCase(), password: body.password, options: { data: { name: body.name.trim(), terms_version: body.terms }, emailRedirectTo: callbackURL } });
      if (result.error) throw authError(result.error);
      if (!result.data.session) return { user: null, pendingEmail: body.email, message: 'Confira sua caixa de entrada e spam. Abra apenas o e-mail de confirmação mais recente. Se já possui uma conta, entre ou recupere sua senha.' };
    } else if (body.action === 'resend' || body.action === 'recover') {
      result = body.action === 'resend'
        ? await client.auth.resend({ type: 'signup', email: body.email, options: { emailRedirectTo: callbackURL } })
        : await client.auth.resetPasswordForEmail(body.email, { redirectTo: callbackURL });
      if (result.error) throw authError(result.error);
      return { message: body.action === 'resend' ? 'Se houver cadastro pendente, você receberá um novo e-mail de confirmação. Abra somente o mais recente.' : 'Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha. Confira também o spam.' };
    } else if (body.action === 'reset') {
      if (!recovery) throw new Error('Solicite um link de recuperação de senha.');
      if (body.newPassword.length < 8 || body.newPassword.length > 128) throw new Error('Use uma senha entre 8 e 128 caracteres.');
      result = await client.auth.updateUser({ password: body.newPassword });
      if (result.error) throw authError(result.error);
      const signedOut = await client.auth.signOut({ scope: 'global' });
      if (signedOut.error) throw authError(signedOut.error);
      recovery = false;
      return { user: null, message: 'Senha atualizada. Entre com sua nova senha.' };
    } else if (body.action === 'logout') {
      const { error } = await client.auth.signOut(); if (error) throw authError(error); recovery = false; return { user: null };
    } else {
      const verified = await client.auth.signInWithPassword({ email: body.email, password: body.password });
      if (verified.error) throw new Error('Confira sua senha atual.');
      if (body.action === 'delete') {
        throw new Error('A exclusão de contas ainda não está disponível.');
      }
      if (body.action === 'profile') {
        const { error } = await client.from('profiles').update({ name: body.name }).eq('id', verified.data.user.id);
        if (error) throw error;
        result = await client.auth.updateUser({ data: { name: body.name } });
      } else if (body.action === 'password') {
        result = await client.auth.updateUser({ password: body.newPassword });
        if (!result.error) await client.auth.signOut({ scope: 'others' });
      } else throw new Error('Ação inválida.');
    }
    if (result.error) {
      throw authError(result.error);
    }
    return { user: await profile(result.data.user) };
  }
  window.AurelDB = { client, ready, storeReady, catalogue, savePreferences, request, callbackError, get recovery() { return recovery; } };
})();
