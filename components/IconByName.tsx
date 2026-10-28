"use client";

import {
  Activity,
  BellRing,
  CloudRain,
  DoorOpen,
  Flame,
  Radar,
  Shirt,
  Sprout,
  SunMoon,
  Trash2,
  Wind,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  SunMoon,
  Radar,
  Sprout,
  CloudRain,
  Wind,
  Flame,
  Trash2,
  DoorOpen,
  BellRing,
  Activity,
  Shirt,
};

export function IconByName({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Workflow;
  return <Icon className={className} />;
}
