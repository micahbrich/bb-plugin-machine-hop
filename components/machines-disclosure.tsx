import type { ExperimentalSidebarFooterDisclosureProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { Machine } from "../lib/machine";
import { openInBrowser, switchToMachine } from "../lib/client-bridge";
import { useMachines } from "../hooks/use-machines";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useIsCompactViewport } from "@/components/ui/hooks/use-compact-viewport";
import { cn } from "@/lib/utils";
import { MachineDot } from "./machine-dot";

// Harp's ↗ glyph: 9px, 1.4 stroke, round caps.
function ArrowUpRight() {
  return (
    <svg aria-hidden viewBox="0 0 9 9" className="size-[9px]" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5 6.5 2.5M3.25 2.5H6.5v3.25" />
    </svg>
  );
}

function MachineRow({
  machine,
  compact,
  onSelect,
  onOpenInBrowser,
}: {
  machine: Machine;
  compact: boolean;
  onSelect: () => void;
  onOpenInBrowser: () => void;
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onPointerDown={(event) => {
          if (event.button === 0) onSelect();
        }}
        onClick={(event) => {
          if (event.detail === 0) onSelect();
        }}
        aria-current={machine.isCurrent ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          compact ? "min-h-11" : "min-h-8",
          !machine.live && "text-muted-foreground",
        )}
      >
        <MachineDot color={machine.color} />
        <span className="min-w-0 flex-1 truncate">
          {machine.label}
          {machine.label !== machine.handle ? (
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">{machine.handle}</span>
          ) : null}
        </span>
        <span
          role="img"
          aria-label={machine.live ? "live" : "offline"}
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            machine.live ? "bg-foreground" : "bg-muted-foreground/40",
            machine.live &&
              "group-hover:invisible group-focus-within:invisible [@media(hover:none)]:invisible",
          )}
        />
        <span className="flex size-4 shrink-0 items-center justify-center">
          {machine.isCurrent ? <Icon name="Check" className="size-4" aria-label="current" /> : null}
        </span>
      </button>
      {machine.live ? (
        // Sits over the live dot: hover and focus swap it in, touch screens always show it.
        <button
          type="button"
          onClick={onOpenInBrowser}
          aria-label={`Open ${machine.label} in a browser`}
          title="Open in browser"
          className="absolute right-[26px] top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-[5px] bg-foreground/[0.06] text-muted-foreground opacity-0 after:absolute after:-inset-2 hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <ArrowUpRight />
        </button>
      ) : null}
    </li>
  );
}

export function MachinesDisclosure({ dismiss }: ExperimentalSidebarFooterDisclosureProps) {
  const { state, reload } = useMachines();
  const compact = useIsCompactViewport();

  const select = (machine: Machine, mobileLinkPath: string) => {
    if (machine.isCurrent) {
      dismiss();
      return;
    }
    if (!machine.live) {
      toast.error(`${machine.label} is offline`);
      return;
    }
    switchToMachine(machine, mobileLinkPath).catch((cause: unknown) => {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    });
    dismiss();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-1.5 text-card-foreground">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Machines</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          aria-label="Refresh machines"
          onClick={() => reload(true)}
        >
          <Icon name="ArrowReloadHorizontal" className="size-3.5" />
        </Button>
      </div>
      {state.status === "loading" ? (
        <ul role="status" aria-label="Loading machines" className="space-y-1 px-2 py-1">
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn("flex items-center", compact ? "h-11" : "h-8")}>
              <span className="h-3 w-full animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      ) : state.status === "error" ? (
        <div role="alert" className="space-y-2 px-2 py-1 text-sm">
          <p className="text-destructive">{state.message}</p>
          <Button variant="outline" size="sm" onClick={() => reload(true)}>
            Retry
          </Button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {state.machines.map((machine) => (
            <MachineRow
              key={machine.handle}
              machine={machine}
              compact={compact}
              onSelect={() => select(machine, state.mobileLinkPath)}
              onOpenInBrowser={() => {
                openInBrowser(machine);
                dismiss();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
