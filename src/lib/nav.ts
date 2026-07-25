import type { Role } from "./auth";
import {
  LayoutDashboard, Users, UserCog, Sparkles, CalendarDays, ClipboardList,
  CreditCard, Wallet, LifeBuoy, Bell, Settings, ShieldCheck, BarChart3,
  MapPin, History, FileText,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
  roles: Role[];
  section: string;
}

const ALL_STAFF: Role[] = [
  "System Administrator", "Operations Manager", "Dispatcher",
  "Customer Support Officer", "Finance Officer", "Reporting Analyst",
];

export const NAV: NavItem[] = [
  // Overview
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_STAFF, section: "Overview" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["System Administrator", "Operations Manager", "Reporting Analyst"], section: "Overview" },

  // Users
  { to: "/customers", label: "Customers", icon: Users, roles: ["System Administrator", "Operations Manager", "Customer Support Officer"], section: "Users" },
  { to: "/staff", label: "Staff & Roles", icon: UserCog, roles: ["System Administrator"], section: "Users" },
  { to: "/audit", label: "Audit Logs", icon: ShieldCheck, roles: ["System Administrator"], section: "Users" },

  // Cleaners
  { to: "/cleaners", label: "Cleaner Profiles", icon: Sparkles, roles: ["System Administrator", "Operations Manager", "Dispatcher"], section: "Cleaners" },
  { to: "/availability", label: "Availability & Zones", icon: MapPin, roles: ["System Administrator", "Operations Manager", "Dispatcher"], section: "Cleaners" },

  // Bookings
  { to: "/bookings", label: "All Bookings", icon: ClipboardList, roles: ["System Administrator", "Operations Manager", "Dispatcher", "Customer Support Officer"], section: "Bookings" },
  { to: "/dispatch", label: "Dispatch Calendar", icon: CalendarDays, roles: ["System Administrator", "Operations Manager", "Dispatcher"], section: "Bookings" },

  // Financials
  { to: "/payments", label: "Customer Payments", icon: CreditCard, roles: ["System Administrator", "Finance Officer", "Customer Support Officer"], section: "Financials" },
  { to: "/payouts", label: "Cleaner Payouts", icon: Wallet, roles: ["System Administrator", "Finance Officer"], section: "Financials" },

  // Support
  { to: "/tickets", label: "Support Tickets", icon: LifeBuoy, roles: ["System Administrator", "Operations Manager", "Customer Support Officer"], section: "Support" },
  { to: "/notifications", label: "Notifications Hub", icon: Bell, roles: ["System Administrator", "Operations Manager", "Customer Support Officer"], section: "Support" },

  // System
  { to: "/settings", label: "System Config", icon: Settings, roles: ["System Administrator"], section: "System" },

  // Cleaner portal
  { to: "/portal/cleaner/schedule", label: "My Schedule", icon: CalendarDays, roles: ["Cleaner"], section: "My Portal" },
  { to: "/portal/cleaner/jobs", label: "Job History", icon: History, roles: ["Cleaner"], section: "My Portal" },
  { to: "/portal/cleaner/earnings", label: "Earnings & Ratings", icon: Wallet, roles: ["Cleaner"], section: "My Portal" },

  // Customer portal
  { to: "/portal/customer/bookings", label: "My Bookings", icon: ClipboardList, roles: ["Customer"], section: "My Portal" },
  { to: "/portal/customer/invoices", label: "Invoices", icon: FileText, roles: ["Customer"], section: "My Portal" },
  { to: "/portal/customer/profile", label: "Profile & Addresses", icon: UserCog, roles: ["Customer"], section: "My Portal" },
];

export function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role));
}
