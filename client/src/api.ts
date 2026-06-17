const API_URL = import.meta.env.VITE_API_URL || (
  window.location.port === '5173' 
    ? 'http://localhost:5000/api' 
    : '/api'
);

export function getToken(): string | null {
  return localStorage.getItem('zenith_auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('zenith_auth_token', token);
}

export function removeToken() {
  localStorage.removeItem('zenith_auth_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    login: (password: string) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
    validate: () => request('/auth/validate', { method: 'GET' }),
    changePassword: (passwordData: any) => request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordData)
    })
  },
  session: {
    getCurrent: () => request('/session/current'),
    start: () => request('/session/start', { method: 'POST' }),
    breakStart: () => request('/session/break-start', { method: 'POST' }),
    breakEnd: () => request('/session/break-end', { method: 'POST' }),
    end: () => request('/session/end', { method: 'POST' }),
    resolveForgotten: (action: 'close' | 'discard', customEndTime?: string) => request('/session/resolve-forgotten', {
      method: 'POST',
      body: JSON.stringify({ action, customEndTime })
    })
  },
  productivity: {
    get: (date?: string) => request(`/productivity?date=${date || ''}`),
    update: (data: any) => request('/productivity', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getHistory: () => request('/productivity/history'),
    getDashboardSummary: () => request('/dashboard/summary')
  },
  planner: {
    get: (date: string) => request(`/planner/${date}`),
    update: (date: string, data: any) => request(`/planner/${date}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  ai: {
    getInsights: (period: 'daily' | 'weekly') => request(`/ai/insights?period=${period}`)
  }
};
