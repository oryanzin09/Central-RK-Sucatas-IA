const VITE_API_URL = import.meta.env.VITE_API_URL || '';

export async function mlApiFetch(endpoint: string, options: RequestInit = {}) {
  // Garantir que não haja barras duplas se VITE_API_URL terminar com barra e endpoint começar com barra
  const baseUrl = VITE_API_URL.endsWith('/') ? VITE_API_URL.slice(0, -1) : VITE_API_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`❌ Resposta não é JSON em ${url}:`, text.substring(0, 100));
      throw new Error(`Resposta do servidor não é JSON (recebeu ${contentType})`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`❌ Erro ao buscar ${url}:`, error);
    throw error;
  }
}
