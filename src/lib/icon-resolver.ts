import {
  Mail,
  HardDrive,
  Database,
  Users,
  Calendar,
  LayoutDashboard,
  UsersRound,
  ShieldCheck,
  AppWindow,
  KeyRound,
  Globe,
  Circle,
  Monitor,
  Bell,
  type LucideIcon,
} from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  Mail,
  HardDrive,
  Database,
  Users,
  Calendar,
  LayoutDashboard,
  UsersRound,
  ShieldCheck,
  AppWindow,
  KeyRound,
  Globe,
  Circle,
  Monitor,
  Bell,
}

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Circle
}
