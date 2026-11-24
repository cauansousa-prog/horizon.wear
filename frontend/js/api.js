/* Infraestrutura para próximas sessões. Nenhuma credencial privada no navegador. */

/* Proteção de carregamento: chamadas GET à /api/ (e a renovação de sessão) que não
   tenham limite próprio passam a expirar em 10 s. Assim, uma chamada travada
   (ex.: sessão antiga, Supabase acordando) não bloqueia a vitrine de produtos.
   Não altera dados, login, pagamentos nem o comportamento de nenhuma rota. */
(function () {
  if (typeof window.fetch !== 'function' || typeof AbortController === 'undefined') return;
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var options = init || {};
      var method = String(options.method || (input && input.method) || 'GET').toUpperCase();
      var isApi = url.indexOf('/api/') === 0 || url.indexOf(location.origin + '/api/') === 0;
      var guarded = isApi && !options.signal && (method === 'GET' || url.indexOf('/api/auth/refresh') !== -1);
      if (!guarded) return nativeFetch(input, init);
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 10000);
      var next = Object.assign({}, options, { signal: controller.signal });
      return nativeFetch(input, next).finally(function () { clearTimeout(timer); });
    } catch (e) {
      return nativeFetch(input, init);
    }
  };
})();

window.HorizonAPI = Object.freeze({
  async get(path, token) {
    if (!path.startsWith('/api/')) throw new Error('Caminho de API inválido.');
    const headers = token ? {Authorization: `Bearer ${token}`} : {};
    const response = await fetch(path, {headers});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Não foi possível consultar o servidor.');
    return data;
  }
});
