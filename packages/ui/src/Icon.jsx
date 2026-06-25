import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileCode,
  FolderOpen,
  GitBranch,
  Globe,
  Handshake,
  Keyboard,
  LogOut,
  Menu,
  Mic,
  Paperclip,
  ArrowUp,
  MessageSquare,
  Pin,
  PinOff,
  Plug,
  Plus,
  Folder,
  Search,
  Settings,
  Sparkles,
  Terminal,
  Users,
  X,
  Zap,
} from "lucide-react";

const ICON_MAP = {
  MessageSquare,
  Bot,
  Sparkles,
  Plug,
  Globe,
  Handshake,
  FolderOpen,
  Folder,
  Keyboard,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  FileCode,
  GitBranch,
  Terminal,
  Search,
  Zap,
  Plus,
  LogOut,
  Mic,
  Paperclip,
  ArrowUp,
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
