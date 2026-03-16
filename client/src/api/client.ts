import axios from 'axios';

// Detect ObliTools iframe context (cross-site WebView2 shell).
// In this context Chrome blocks all cookies, so we use X-Auth-Token header instead.
const isInObliTools = (() => {
  try { return window !== window.top; } catch { return true; }
})() || !!(window as { __obliview_is_native_app?: boolean }).__obliview_is_native_app;

const OBLITOOLS_TOKEN_KEY = 'oblitools_auth_token';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject X-Auth-Token header when running inside ObliTools.
apiClient.interceptors.request.use((config) => {
  if (isInObliTools) {
    const token = sessionStorage.getItem(OBLITOOLS_TOKEN_KEY);
    if (token) {
      config.headers['X-Auth-Token'] = token;
    }
  }
  return config;
});

// Response interceptor: handle 401 and cookie-less token
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (isInObliTools) {
        // Clear stale token — user will be redirected to login by ProtectedRoute.
        sessionStorage.removeItem(OBLITOOLS_TOKEN_KEY);
      } else if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { isInObliTools, OBLITOOLS_TOKEN_KEY };

export default apiClient;
