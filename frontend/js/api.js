/* Infraestrutura para próximas sessões. Nenhuma credencial privada no navegador. */
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
