import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

import { MACHINE_COLORS, type Machine, type MachineColor } from "./lib/machine";
export { MACHINE_COLORS, type Machine, type MachineColor };
const machineColorSchema = z.enum(MACHINE_COLORS);

const machineSchema = z.object({
  handle: z.string(),
  name: z.string(),
  label: z.string(),
  color: machineColorSchema,
  url: z.string(),
  live: z.boolean(),
  isCurrent: z.boolean(),
}) satisfies z.ZodType<Machine>;

const overrideSchema = z.object({
  label: z.string().optional(),
  color: machineColorSchema.optional(),
});
export type MachineOverride = z.infer<typeof overrideSchema>;
const overridesSchema = z.record(z.string(), overrideSchema);
type Overrides = z.infer<typeof overridesSchema>;

const connectServersSchema = z.object({
  servers: z.array(
    z.object({
      handle: z.string(),
      name: z.string(),
      live: z.boolean(),
      url: z.string(),
    }),
  ),
  selfHandle: z.string(),
});
type ConnectServers = z.infer<typeof connectServersSchema>;

const labelSchema = z.string().trim().max(40);
const mobileLinkPathSchema = z
  .string()
  .regex(
    /^\/(settings|threads|projects)(\/.*)?$/,
    "Must start with /settings, /threads or /projects",
  );

export const MACHINES_CHANGED = "machines-changed";
const CONNECT_CACHE_MS = 30_000;

export const rpcContract = defineRpcContract({
  machines_list: {
    input: z.object({ force: z.boolean().optional() }).nullable(),
    output: z.object({
      machines: z.array(machineSchema),
      mobileLinkPath: z.string(),
    }),
  },
  machines_set_override: {
    input: z.object({
      handle: z.string().min(1),
      label: labelSchema.nullable().optional(),
      color: machineColorSchema.nullable().optional(),
    }),
    output: z.object({ machine: machineSchema }),
  },
});

export function buildMachines(
  connect: ConnectServers,
  overrides: Overrides,
): Machine[] {
  const machines = connect.servers.map((server): Machine => {
    const override = overrides[server.handle] ?? {};
    return {
      handle: server.handle,
      name: server.name,
      label: override.label ?? server.name,
      color: override.color ?? "none",
      url: server.url,
      live: server.live,
      isCurrent: server.handle === connect.selfHandle,
    };
  });
  return machines.sort(
    (a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      Number(b.live) - Number(a.live) ||
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

type OverridePatch = { label?: string | null; color?: MachineColor | null };

export function applyOverridePatch(
  overrides: Overrides,
  handle: string,
  patch: OverridePatch,
): Overrides {
  const next: MachineOverride = { ...overrides[handle] };
  if (patch.label !== undefined) {
    const label = patch.label?.trim() ?? "";
    if (label === "") delete next.label;
    else next.label = label;
  }
  if (patch.color !== undefined) {
    if (patch.color === null) delete next.color;
    else next.color = patch.color;
  }
  const result = { ...overrides };
  if (Object.keys(next).length === 0) delete result[handle];
  else result[handle] = next;
  return result;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function formatMachineTable(machines: Machine[]): string {
  const rows = machines.map((machine) => [
    machine.isCurrent ? "*" : " ",
    machine.label,
    machine.handle,
    machine.live ? "live" : "offline",
    machine.url,
  ]);
  const widths = rows.reduce<number[]>(
    (acc, row) => row.map((cell, i) => Math.max(acc[i] ?? 0, cell.length)),
    [],
  );
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

const usage = [
  "Usage:",
  "  bb machines list [--json]",
  "  bb machines label <handle> <text…>",
  "  bb machines label <handle> --clear",
  `  bb machines color <handle> <${MACHINE_COLORS.join("|")}>`,
].join("\n");

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    mobileLinkPath: {
      type: "string",
      label: "Mobile deep-link path",
      description:
        "Appended to a machine's URL when switching from the mobile app. Must be under /settings, /threads or /projects so the native app claims the link.",
      default: "/settings/general",
      experimental_schema: mobileLinkPathSchema,
    },
  });

  let cache: { value: ConnectServers; expiresAt: number } | null = null;
  async function fetchConnectServers(force: boolean): Promise<ConnectServers> {
    if (!force && cache !== null && cache.expiresAt > Date.now()) return cache.value;
    let value: ConnectServers;
    try {
      value = await bb.sdk.plugins.callRpc({
        pluginId: "connect",
        method: "listAccountServers",
        input: null,
        outputSchema: connectServersSchema,
      });
    } catch (cause) {
      throw new Error(`Could not list servers from bb connect: ${describe(cause)}`);
    }
    cache = { value, expiresAt: Date.now() + CONNECT_CACHE_MS };
    return value;
  }

  async function readOverrides(): Promise<Overrides> {
    const parsed = overridesSchema.safeParse(await bb.storage.kv.get("overrides"));
    return parsed.success ? parsed.data : {};
  }

  async function listMachines(force = false): Promise<Machine[]> {
    const [connect, overrides] = await Promise.all([
      fetchConnectServers(force),
      readOverrides(),
    ]);
    return buildMachines(connect, overrides);
  }

  async function setOverride(handle: string, patch: OverridePatch): Promise<Machine> {
    const connect = await fetchConnectServers(false);
    if (!connect.servers.some((server) => server.handle === handle)) {
      throw new Error(`No machine with handle ${handle}`);
    }
    const overrides = applyOverridePatch(await readOverrides(), handle, patch);
    await bb.storage.kv.set("overrides", overrides);
    bb.realtime.publish(MACHINES_CHANGED, { handle });
    const machine = buildMachines(connect, overrides).find((m) => m.handle === handle);
    if (machine === undefined) throw new Error(`No machine with handle ${handle}`);
    return machine;
  }

  bb.rpc.register(
    rpcContract,
    {
      machines_list: async (input) => ({
        machines: await listMachines(input?.force === true),
        mobileLinkPath: (await settings.get()).mobileLinkPath,
      }),
      machines_set_override: async ({ handle, label, color }) => ({
        machine: await setOverride(handle, { label, color }),
      }),
    },
    {
      experimental_discoverable: true,
      experimental_description:
        "List the bb machines on this account and set per-machine nicknames and colours.",
    },
  );

  bb.cli.register({
    name: "machines",
    summary: "List your bb machines and set their nicknames and colours",
    commands: [
      { name: "list", summary: "List machines", usage: "bb machines list [--json]" },
      {
        name: "label",
        summary: "Set or clear a machine's nickname",
        usage: "bb machines label <handle> <text…> | --clear",
      },
      {
        name: "color",
        summary: "Set a machine's colour",
        usage: `bb machines color <handle> <${MACHINE_COLORS.join("|")}>`,
      },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, handle, ...rest] = argv.filter((arg) => arg !== "--json");
      const fail = (message: string) => ({ exitCode: 1, stderr: message });
      const ok = (value: unknown, text: string) => ({
        exitCode: 0,
        stdout: json ? JSON.stringify(value) : text,
      });
      const described = (machine: Machine) =>
        `${machine.label} (${machine.handle}) colour=${machine.color}`;
      try {
        switch (command) {
          case undefined:
          case "help":
          case "--help":
          case "-h":
            return { exitCode: 0, stdout: usage };
          case "list": {
            const machines = await listMachines();
            return ok(machines, formatMachineTable(machines));
          }
          case "label": {
            if (handle === undefined || rest.length === 0) return fail(usage);
            const clear = rest.length === 1 && rest[0] === "--clear";
            const label = clear ? null : labelSchema.safeParse(rest.join(" "));
            if (label !== null && !label.success) {
              return fail("Label must be at most 40 characters.");
            }
            const machine = await setOverride(handle, {
              label: label === null ? null : label.data,
            });
            return ok(machine, described(machine));
          }
          case "color": {
            const color = machineColorSchema.safeParse(rest[0]);
            if (handle === undefined || rest.length !== 1 || !color.success) {
              return fail(usage);
            }
            const machine = await setOverride(handle, {
              color: color.data === "none" ? null : color.data,
            });
            return ok(machine, described(machine));
          }
          default:
            return fail(usage);
        }
      } catch (cause) {
        return fail(describe(cause));
      }
    },
  });
}
