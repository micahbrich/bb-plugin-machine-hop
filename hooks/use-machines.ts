import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../server";
import type { Machine } from "../lib/machine";

export type MachinesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; machines: Machine[]; mobileLinkPath: string };

export function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function useMachines() {
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<MachinesState>({ status: "loading" });
  const reload = useCallback(
    (force = false) => {
      rpc.call("machines_list", force ? { force: true } : null).then(
        (result) => setState({ status: "ready", ...result }),
        (cause) => setState({ status: "error", message: describeError(cause) }),
      );
    },
    [rpc],
  );
  useEffect(() => {
    reload();
  }, [reload]);
  useRealtime("machines-changed", () => reload());
  return { rpc, state, reload };
}
