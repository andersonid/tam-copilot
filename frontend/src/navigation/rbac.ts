import type { UserRole } from "../context/AuthContext";

/** Portfolio-management routes: only registered and shown in the nav for these roles. */
export const MANAGER_PORTFOLIO_ROLES: readonly UserRole[] = ["admin", "manager"];

export function hasManagerPortfolio(role: UserRole): boolean {
  return MANAGER_PORTFOLIO_ROLES.includes(role);
}

/** URL prefixes for portfolio management (sidebar "Management" expand state). */
export const MANAGER_PORTFOLIO_PATHS = ["/team", "/action-plans", "/reports"] as const;

export function isManagerPortfolioPath(pathname: string): boolean {
  return MANAGER_PORTFOLIO_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
