import type { MachineColor } from "../lib/machine";
import { cn } from "@/lib/utils";

const colorClasses: Record<MachineColor, string> = {
  none: "bg-muted-foreground/40",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function MachineDot({ color, className }: { color: MachineColor; className?: string }) {
  return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", colorClasses[color], className)} />;
}
