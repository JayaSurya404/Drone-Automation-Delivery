export function getAdminAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('skynav_admin_token') || sessionStorage.getItem('skynav_admin_token');
  } catch {
    return null;
  }
}

export function getAdminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAdminAuthToken();
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
