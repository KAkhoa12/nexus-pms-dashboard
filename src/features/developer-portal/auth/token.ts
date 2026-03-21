const ACCESS_TOKEN_KEY = "developer_portal_access_token";

export function getDeveloperAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setDeveloperAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearDeveloperAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
