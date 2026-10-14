import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { MACHINE_COLORS, type Machine, type MachineColor } from "../lib/machine";
import { describeError, useMachines } from "../hooks/use-machines";
import { Input } from "@/components/ui/input";
import { MachineDot } from "./machine-dot";

type Rpc = ReturnType<typeof useMachines>["rpc"];

function OverrideRow({ machine, rpc }: { machine: Machine; rpc: Rpc }) {
  const nickname = machine.label === machine.name ? "" : machine.label;
  const [draft, setDraft] = useState(nickname);

  const save = async (patch: { label?: string | null; color?: MachineColor | null }) => {
    try {
      await rpc.call("machines_set_override", { handle: machine.handle, ...patch });
    } catch (cause) {
      toast.error(describeError(cause));
    }
  };
  const commitLabel = () => {
    const next = draft.trim();
    if (next === nickname) return;
    void save({ label: next === "" ? null : next });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
        <MachineDot color={machine.color} />
        <span className="truncate font-mono text-xs text-muted-foreground">{machine.handle}</span>
        {machine.isCurrent ? (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase text-accent-foreground">
            current
          </span>
        ) : null}
      </div>
      <Input
        value={draft}
        placeholder={machine.name}
        maxLength={40}
        aria-label={`Nickname for ${machine.handle}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitLabel}
        onKeyDown={onKeyDown}
        className="h-8 w-full sm:w-48"
      />
      <select
        value={machine.color}
        aria-label={`Colour for ${machine.handle}`}
        onChange={(event) => {
          const color = event.target.value as MachineColor;
          void save({ color: color === "none" ? null : color });
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {MACHINE_COLORS.map((color) => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MachineOverridesSection() {
  const { rpc, state } = useMachines();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        The current machine is detected from bb connect. Nicknames and colours are stored on this
        machine only.
      </p>
      {state.status === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading machines…
        </p>
      ) : state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card px-3">
          {state.machines.map((machine) => (
            <OverrideRow key={machine.handle} machine={machine} rpc={rpc} />
          ))}
        </div>
      )}
    </div>
  );
}
