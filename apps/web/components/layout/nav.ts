export const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/briefs", label: "Briefs" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
