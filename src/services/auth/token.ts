const ACCESS_TOKEN_COOKIE = "auth_access_token";
const REFRESH_TOKEN_COOKIE = "auth_refresh_token";

type SetCookieOptions = {
  maxAge?: number;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: number;
  refreshTokenExpiresIn?: number;
};

function getCookie(name: string): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  if (!cookie) return null;
  const value = cookie.split("=")[1] ?? "";
  return decodeURIComponent(value);
}

function setCookie(
  name: string,
  value: string,
  options?: SetCookieOptions,
): void {
  const maxAge = options?.maxAge;
  const maxAgePart = typeof maxAge === "number" ? `; max-age=${maxAge}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax${maxAgePart}`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; samesite=lax; max-age=0`;
}

export function getAccessToken(): string | null {
  return getCookie(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken(): string | null {
  return getCookie(REFRESH_TOKEN_COOKIE);
}

export function setAuthTokens(tokens: AuthTokens): void {
  setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    maxAge: tokens.accessTokenExpiresIn,
  });
  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    maxAge: tokens.refreshTokenExpiresIn,
  });
}

export function clearAuthTokens(): void {
  clearCookie(ACCESS_TOKEN_COOKIE);
  clearCookie(REFRESH_TOKEN_COOKIE);
}
