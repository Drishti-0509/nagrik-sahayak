import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_BASE_URL =
  typeof rawApiUrl === 'string' && rawApiUrl.trim()
    ? rawApiUrl.trim().replace(/\/+$/, '')
    : '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: inject Bearer token into all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nagrik_token');
    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: handle unauthorized or common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on authorization failure if not currently on login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('nagrik_token');
        localStorage.removeItem('nagrik_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
