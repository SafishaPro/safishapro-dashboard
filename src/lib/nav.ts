import {
  LayoutDashboard, Users, UserCog, UserRound, Sparkles, CalendarDays, ClipboardList,
  CreditCard, Wallet, LifeBuoy, Bell, Settings, ShieldCheck, BarChart3, MapPin, Package, Building2,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; permissions?: string[]; anyPermissions?: string[]; roles?: string[]; section: string; }

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissions: ["dashboards.read"], section: "Overview" },
  { to: "/profile", label: "My Profile", icon: UserRound, section: "Account" },
  { to: "/customers", label: "Clients", icon: Users, permissions: ["customers.read", "users.read"], section: "Administration" },
  { to: "/staff", label: "Staff", icon: UserCog, permissions: ["users.read", "roles.read"], section: "Administration" },
  { to: "/roles", label: "Roles", icon: ShieldCheck, permissions: ["roles.read", "permissions.read"], section: "Administration" },
  { to: "/property-types", label: "Property Types", icon: Building2, roles: ["system_administrator"], section: "Administration" },
  { to: "/audit", label: "Audit & OTP Logs", icon: ShieldCheck, anyPermissions: ["audit_logs.read", "otp_logs.read"], section: "Administration" },
  { to: "/cleaners", label: "Cleaner Profiles", icon: Sparkles, permissions: ["cleaners.read"], section: "Users" },
  { to: "/availability", label: "Availability & Zones", icon: MapPin, anyPermissions: ["cleaner_availability.read", "service_areas.read"], section: "Operations" },
  { to: "/bookings", label: "All Bookings", icon: ClipboardList, permissions: ["bookings.read"], section: "Operations" },
  { to: "/dispatch", label: "Dispatch Calendar", icon: CalendarDays, permissions: ["bookings.read"], section: "Operations" },
  { to: "/services", label: "Services", icon: Package, permissions: ["services.read"], section: "Operations" },
  { to: "/subscriptions", label: "Subscriptions", icon: CalendarDays, permissions: ["services.read"], section: "Operations" },
  { to: "/payments", label: "Customer Payments", icon: CreditCard, permissions: ["payments.read"], section: "Financials" },
  { to: "/payouts", label: "Cleaner Payouts", icon: Wallet, permissions: ["payouts.read"], section: "Financials" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, permissions: ["analytics.read", "reports.read"], section: "Insights" },
  { to: "/tickets", label: "Support Tickets", icon: LifeBuoy, permissions: ["complaints.read"], section: "Support" },
  { to: "/notifications", label: "Notifications Hub", icon: Bell, permissions: ["notifications.read"], section: "Support" },
  { to: "/settings", label: "System Config", icon: Settings, permissions: ["settings.read"], section: "System" },
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
