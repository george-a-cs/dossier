import { SESSION_COOKIE } from "./session";
import type { AuthUser } from "./types";

const TOKEN_KEY = "dossier.token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) {
      return decodeURIComponent(item.slice(prefix.length));
    }
  }
  return null;
}

function writeCookie(token: string): void {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function expireCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(TOKEN_KEY);
  const cookie = readCookie(SESSION_COOKIE);
  const token = stored ?? cookie;
  if (stored && !cookie) writeCookie(stored);
  return token;
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  writeCookie(token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  expireCookie();
}

export function initials(user: Pick<AuthUser, "name" | "email">): string {
  const parts = user.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts[0]?.length) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function roleLabel(role: AuthUser["role"]): string {
  return role === "super_admin" ? "Super admin" : "Member";
}
