import {
  BarChart3,
  Bot,
  CreditCard,
  Globe,
  Handshake,
  Keyboard,
  Menu,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  Users,
  FolderOpen,
} from "lucide-react";

const ICON_MAP = {
  MessageSquare,
  Bot,
  Sparkles,
  Plug,
  Globe,
  Handshake,
  FolderOpen,
  Keyboard,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
};

export function Icon({ name, size = 20, className = "", strokeWidth = 1.75, ...props }) {
  const Component = ICON_MAP[name];
  if (!Component) {
    return null;
  }
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
      {...props}
    />
  );
}

export { ICON_MAP };
