import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  TrendingUp,
  FileBarChart,
  FolderLock,
  Settings,
  Repeat,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/vault", label: "Vault", icon: FolderLock },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Used for mobile bottom nav (subset — 5 most used)
export const mobileNavItems: NavItem[] = [
  navItems[0], // Dashboard
  navItems[1], // Accounts
  navItems[2], // Transactions
  navItems[3], // Recurring
  navItems[7], // Reports
];
