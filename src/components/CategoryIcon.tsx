import {
  Briefcase,
  Home,
  Heart,
  BookOpen,
  ShoppingCart,
  Dumbbell,
  Code,
  Music,
  Plane,
  Coffee,
  Car,
  Camera,
  PenTool,
  Zap,
  Star,
  Target,
  Flag,
  Gift,
  Leaf,
  Flame,
  Rocket,
  Wallet,
  Palette,
  Utensils,
  Hammer,
  Brain,
  Folder,
  Calendar,
  type LucideProps,
} from "lucide-react";

// Map matches CATEGORY_ICONS in constants.ts — selective imports keep the
// bundle small (lucide-react exports hundreds of icons otherwise).
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Briefcase,
  Home,
  Heart,
  BookOpen,
  ShoppingCart,
  Dumbbell,
  Code,
  Music,
  Plane,
  Coffee,
  Car,
  Camera,
  PenTool,
  Zap,
  Star,
  Target,
  Flag,
  Gift,
  Leaf,
  Flame,
  Rocket,
  Wallet,
  Palette,
  Utensils,
  Hammer,
  Brain,
  Folder,
  Calendar,
};

interface Props extends LucideProps {
  name: string;
}

export function CategoryIcon({ name, ...rest }: Props) {
  const Cmp = ICON_MAP[name] ?? Folder;
  return <Cmp {...rest} />;
}
