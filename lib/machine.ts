export const MACHINE_COLORS = [
  "none",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;
export type MachineColor = (typeof MACHINE_COLORS)[number];

export type Machine = {
  handle: string;
  name: string;
  label: string;
  color: MachineColor;
  url: string;
  live: boolean;
  isCurrent: boolean;
};
