import type { ExperimentalSidebarFooterDisclosureProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { Machine } from "../lib/machine";
import { switchToMachine } from "../lib/client-bridge";
import { useMachines } from "../hooks/use-machines";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useIsCompactViewport } from "@/components/ui/hooks/use-compact-viewport";
import { cn } from "@/lib/utils";
import { MachineDot } from "./machine-dot";

function MachineRow({
  machine,
  compact,
  onSelect,
}: {
  machine: Machine;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
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
          )}
        />
        <span className="flex size-4 shrink-0 items-center justify-center">
          {machine.isCurrent ? <Icon name="Check" className="size-4" aria-label="current" /> : null}
        </span>
      </button>
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
