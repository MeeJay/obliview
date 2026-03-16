import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: unwrap API response
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Inside an ObliTools iframe the hard navigation would reload the entire
      // iframe document and create a redirect loop (the new document also can't
      // send the cross-site session cookie).  Skip it — React's ProtectedRoute
      // (which watches the auth store) will handle the redirect cleanly.
      const inIframe = (() => { try { return window !== window.top; } catch { return true; } })();
      if (!inIframe && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
