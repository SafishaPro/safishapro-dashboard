import {
  LayoutDashboard, Users, UserCog, UserRound, Sparkles, CalendarDays, ClipboardList,
  CreditCard, Wallet, LifeBuoy, Bell, Settings, ShieldCheck, BarChart3, HandPlatter, Building2,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; permissions?: string[]; anyPermissions?: string[]; roles?: string[]; section: string; }

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissions: ["dashboards.read"], section: "Overview" },
  { to: "/bookings", label: "Bookings", icon: ClipboardList, permissions: ["bookings.read"], section: "Operations" },
  { to: "/dispatch", label: "Dispatch calendar", icon: CalendarDays, permissions: ["bookings.read", "bookings.assign"], section: "Operations" },
  // Temporarily hidden while the availability and service-area workflow is being revised.
  { to: "/customers", label: "Clients", icon: Users, permissions: ["customers.read", "users.read"], section: "People" },
  { to: "/cleaners", label: "Cleaner profiles", icon: Sparkles, permissions: ["cleaners.read"], section: "People" },
  { to: "/staff", label: "Staff", icon: UserCog, permissions: ["users.read", "roles.read"], section: "People" },
  { to: "/services", label: "Service", icon: HandPlatter, permissions: ["services.read"], section: "Catalog" },
  { to: "/subscriptions", label: "Subscriptions", icon: CalendarDays, permissions: ["services.read"], section: "Catalog" },
  { to: "/payments", label: "Customer payments", icon: CreditCard, permissions: ["payments.read"], section: "Finance" },
  { to: "/payouts", label: "Cleaner payouts", icon: Wallet, permissions: ["payouts.read"], section: "Finance" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, permissions: ["analytics.read", "reports.read"], section: "Insights & support" },
  { to: "/tickets", label: "Support tickets", icon: LifeBuoy, permissions: ["complaints.read"], section: "Insights & support" },
  { to: "/notifications", label: "Notifications", icon: Bell, permissions: ["notifications.read"], section: "Insights & support" },
  { to: "/audit", label: "Audit trail & OTP logs", icon: ShieldCheck, anyPermissions: ["audit_logs.read", "otp_logs.read"], section: "Security & audit" },
  { to: "/roles", label: "Roles & permissions", icon: ShieldCheck, permissions: ["roles.read", "permissions.read"], section: "Administration" },
  { to: "/property-types", label: "Property types", icon: Building2, roles: ["system_administrator"], section: "Administration" },
  { to: "/registration-fields", label: "Registration fields", icon: UserRound, roles: ["system_administrator"], section: "Administration" },
  { to: "/settings", label: "System configuration", icon: Settings, permissions: ["settings.read"], section: "Administration" },
  { to: "/profile", label: "My profile", icon: UserRound, section: "Account" },
];

const isAllowed = (item: NavItem, permissions: Set<string>, roleSlug?: string) =>
  (item.permissions ?? []).every((permission) => permissions.has(permission)) &&
  (!item.anyPermissions?.length || item.anyPermissions.some((permission) => permissions.has(permission))) &&
  (!item.roles?.length || Boolean(roleSlug && item.roles.includes(roleSlug)));

export function navFor(permissions: Set<string>, roleSlug?: string) { return NAV.filter((item) => isAllowed(item, permissions, roleSlug)); }
export function canVisit(path: string, permissions: Set<string>, roleSlug?: string) {
  const item = NAV.find((candidate) => candidate.to === path);
  return !item || isAllowed(item, permissions, roleSlug);
}
