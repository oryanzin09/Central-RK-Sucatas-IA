import { auth } from '../firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  // Attach Firebase ID token if user is logged in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.error("Failed to get Firebase token", e);
    }
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  
  // Se não autorizado, redirecionar para login (exceto se for a própria rota de login)
  const isLoginRoute = endpoint.includes('/login');
  
  if (response.status === 401 && !isLoginRoute) {
    // We don't want to aggressively redirect here if we're using Firebase Auth, 
    // because Firebase manages the session. Just throw an error.
    throw new Error('Sessão expirada ou não autorizada. Faça login novamente.');
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
