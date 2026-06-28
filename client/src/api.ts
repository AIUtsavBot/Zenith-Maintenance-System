export const API_URL = import.meta.env.VITE_API_URL || (
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
    login: (loginData: { username?: string; password: string }) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData)
    }),
    signup: (signupData: { username: string; name?: string; password: string }) => request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupData)
    }),
    googleLogin: (credential: string) => request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
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
    getInsights: (period: 'daily' | 'weekly') => request(`/ai/insights?period=${period}`),
    getGroupInsights: (groupId: string) => request(`/groups/${groupId}/ai-insights`)
  },
  admin: {
    getUsers: () => request('/admin/users'),
    createUser: (userData: { username: string; name?: string; email?: string; password: string; role: 'admin' | 'user' }) => request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    updateUser: (username: string, userData: { name?: string; email?: string; role?: 'admin' | 'user' }) => request(`/admin/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    })
  },
  groups: {
    create: (data: { name: string; description?: string; avatar?: string }) => request('/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    list: () => request('/groups'),
    get: (id: string) => request(`/groups/${id}`),
    join: (inviteCode: string) => request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    }),
    leave: (id: string) => request(`/groups/${id}/leave`, { method: 'POST' }),
    delete: (id: string) => request(`/groups/${id}`, { method: 'DELETE' }),
    transfer: (id: string, targetUsername: string) => request(`/groups/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ targetUsername })
    }),
    getMembers: (id: string) => request(`/groups/${id}/members`),
    removeMember: (id: string, username: string) => request(`/groups/${id}/members/${username}`, { method: 'DELETE' }),
    updateRole: (id: string, username: string, role: 'admin' | 'member') => request(`/groups/${id}/members/${username}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    }),
    getActivity: (id: string) => request(`/groups/${id}/activity`)
  },
  tasks: {
    create: (data: any) => request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    list: (groupId?: string) => request(`/tasks${groupId ? `?groupId=${groupId}` : ''}`),
    get: (id: string) => request(`/tasks/${id}`),
    update: (id: string, data: any) => request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    complete: (id: string) => request(`/tasks/${id}/complete`, { method: 'PUT' }),
    addComment: (id: string, text: string) => request(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    }),
    delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' })
  },
  goals: {
    create: (data: any) => request('/goals', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    list: (groupId: string) => request(`/goals?groupId=${groupId}`),
    update: (id: string, data: any) => request(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => request(`/goals/${id}`, { method: 'DELETE' })
  },
  reminders: {
    create: (data: any) => request('/reminders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    list: () => request('/reminders'),
    delete: (id: string) => request(`/reminders/${id}`, { method: 'DELETE' })
  },
  notifications: {
    list: (filters?: { read?: boolean; category?: string; priority?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (filters) {
        if (filters.read !== undefined) q.append('read', String(filters.read));
        if (filters.category) q.append('category', filters.category);
        if (filters.priority) q.append('priority', filters.priority);
        if (filters.search) q.append('search', filters.search);
      }
      return request(`/notifications?${q.toString()}`);
    },
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
    delete: (id: string) => request(`/notifications/${id}`, { method: 'DELETE' })
  },
  profile: {
    get: () => request('/users/profile'),
    update: (data: any) => request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    verifyEmail: (data?: { email?: string; otp?: string }) => request('/users/profile/verify-email', { 
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  },
  settings: {
    getStatus: () => request('/settings/status')
  }
};
