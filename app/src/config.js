/**
 * API base URL. В production задаётся при сборке: REACT_APP_API_URL
 * Пример на VPS: REACT_APP_API_URL=https://your-domain.com npm run build
 */
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
