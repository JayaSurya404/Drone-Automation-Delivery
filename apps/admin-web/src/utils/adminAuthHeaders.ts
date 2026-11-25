import { adminApiClient } from '../services/adminApiClient';

export function getAdminAuthToken(): string | null {
  return adminApiClient.getAccessToken();
}

export function getAdminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAdminAuthToken();
  const headers: Record<string, string> = {
    'x-client-app': 'admin',
    ...(extra || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
