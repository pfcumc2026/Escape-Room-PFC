// Endereço da API: servidor local durante o desenvolvimento e o serviço do Render em produção

const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_URL = LOCAL
  ? "http://localhost:3000/api"
  : "https://escape-py-api.onrender.com/api";
