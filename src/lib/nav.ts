import {
  LayoutDashboard, Users, UserCog, UserRound, Sparkles, CalendarDays, ClipboardList,
  CreditCard, Wallet, LifeBuoy, Bell, Settings, ShieldCheck, BarChart3, MapPin, Package,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; permissions: string[]; section: string; }

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissions: ["dashboards.read"], section: "Overview" },
  { to: "/profile", label: "My Profile", icon: UserRound, permissions: [], section: "Account" },
  { to: "/customers", label: "Clients", icon: Users, permissions: ["users.read"], section: "Administration" },
  { to: "/staff", label: "Staff", icon: UserCog, permissions: ["users.read"], section: "Administration" },
  { to: "/roles", label: "Roles", icon: ShieldCheck, permissions: ["roles.read"], section: "Administration" },
  { to: "/audit", label: "Audit & OTP Logs", icon: ShieldCheck, permissions: ["audit_logs.read"], section: "Administration" },
  { to: "/cleaners", label: "Cleaner Profiles", icon: Sparkles, permissions: ["users.read"], section: "Users" },
  { to: "/availability", label: "Availability & Zones", icon: MapPin, permissions: [], section: "Operations" },
  { to: "/bookings", label: "All Bookings", icon: ClipboardList, permissions: [], section: "Operations" },
  { to: "/dispatch", label: "Dispatch Calendar", icon: CalendarDays, permissions: [], section: "Operations" },
  { to: "/services", label: "Services", icon: Package, permissions: [], section: "Operations" },
  { to: "/subscriptions", label: "Subscriptions", icon: CalendarDays, permissions: [], section: "Operations" },
  { to: "/payments", label: "Customer Payments", icon: CreditCard, permissions: [], section: "Financials" },
  { to: "/payouts", label: "Cleaner Payouts", icon: Wallet, permissions: [], section: "Financials" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, permissions: [], section: "Insights" },
  { to: "/tickets", label: "Support Tickets", icon: LifeBuoy, permissions: [], section: "Support" },
  { to: "/notifications", label: "Notifications Hub", icon: Bell, permissions: [], section: "Support" },
  { to: "/settings", label: "System Config", icon: Settings, permissions: ["roles.read"], section: "System" },
];

export function navFor(permissions: Set<string>) { return NAV.filter((item) => item.permissions.every((permission) => permissions.has(permission))); }
export function canVisit(path: string, permissions: Set<string>) {
  const item = NAV.find((candidate) => candidate.to === path);
  return !item || item.permissions.every((permission) => permissions.has(permission));
}
