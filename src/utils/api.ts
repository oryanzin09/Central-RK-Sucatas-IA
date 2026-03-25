const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  // Se não autorizado, redirecionar para login (exceto se for a própria rota de login)
  const isLoginRoute = endpoint.includes('/login');
  console.log(`📡 API Response Status: ${response.status}, Endpoint: ${endpoint}, isLoginRoute: ${isLoginRoute}`);
  
  if (response.status === 401 && !isLoginRoute) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  
  return response.json();
}

export const api = {
  get: (endpoint: string) => apiRequest(endpoint),
  post: (endpoint: string, data: any) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  put: (endpoint: string, data: any) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' })
};
