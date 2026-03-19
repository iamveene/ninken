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
  MessageSquare,
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
  MessageSquare,
}

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Circle
}
