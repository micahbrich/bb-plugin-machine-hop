import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin, { type Machine } from "./server";

const connectServers = {
  servers: [
    { handle: "mbr-plexair", name: "mbr-plexair", live: false, url: "https://mbr-plexair.getbb.app" },
    { handle: "studio", name: "studio", live: true, url: "https://studio.getbb.app" },
    { handle: "mbr", name: "mbr", live: true, url: "https://mbr.getbb.app" },
    { handle: "alpha", name: "alpha", live: true, url: "https://alpha.getbb.app" },
  ],
  selfHandle: "mbr",
};

async function loadPlugin() {
  const { bb, harness } = createFakePluginHost({
    pluginId: "machine-hop",
    sdk: { plugins: { callRpc: async () => connectServers } },
  });
  await plugin(bb);
  return { bb, harness };
}

type Harness = Awaited<ReturnType<typeof loadPlugin>>["harness"];

async function listMachines(harness: Harness) {
  const result = (await harness.behavior.callRpc("machines_list", null)) as {
    machines: Machine[];
    mobileLinkPath: string;
  };
  return result;
}

describe("machines_list", () => {
  it("marks the current machine and sorts current, then live, then label", async () => {
    const { harness } = await loadPlugin();
    const { machines, mobileLinkPath } = await listMachines(harness);
    expect(machines.map((m) => m.handle)).toEqual(["mbr", "alpha", "studio", "mbr-plexair"]);
    expect(machines.map((m) => m.isCurrent)).toEqual([true, false, false, false]);
    expect(mobileLinkPath).toBe("/settings/general");
    expect(harness.inspection.sdk.callsTo("plugins.callRpc")[0]?.[0]).toMatchObject({
      pluginId: "connect",
      method: "listAccountServers",
      input: null,
    });
  });

  it("applies an override label and keeps connect's name", async () => {
    const { harness } = await loadPlugin();
    await harness.behavior.callRpc("machines_set_override", {
      handle: "studio",
      label: "  Studio box  ",
      color: "teal",
    });
    const { machines } = await listMachines(harness);
    const studio = machines.find((m) => m.handle === "studio");
    expect(studio).toMatchObject({ label: "Studio box", name: "studio", color: "teal" });
    expect(harness.realtimeSignals.at(-1)).toMatchObject({ channel: "machines-changed" });
  });

  it("serves repeated opens from the 30 s cache and force bypasses it", async () => {
    const { harness } = await loadPlugin();
    await listMachines(harness);
    await listMachines(harness);
    expect(harness.inspection.sdk.callsTo("plugins.callRpc")).toHaveLength(1);
    await harness.behavior.callRpc("machines_list", { force: true });
    expect(harness.inspection.sdk.callsTo("plugins.callRpc")).toHaveLength(2);
  });

  it("surfaces a connect failure as a readable error", async () => {
    const { bb, harness } = createFakePluginHost({
      pluginId: "machine-hop",
      sdk: {
        plugins: {
          callRpc: async () => {
            throw new Error("not signed in");
          },
        },
      },
    });
    await plugin(bb);
    await expect(harness.behavior.callRpc("machines_list", null)).rejects.toThrow(
      "Could not list servers from bb connect: not signed in",
    );
  });
});

describe("machines_set_override", () => {
  it("clears a label with null and falls back to connect's name", async () => {
    const { bb, harness } = await loadPlugin();
    await harness.behavior.callRpc("machines_set_override", { handle: "alpha", label: "Alpha box" });
    const cleared = (await harness.behavior.callRpc("machines_set_override", {
      handle: "alpha",
      label: null,
    })) as { machine: Machine };
    expect(cleared.machine.label).toBe("alpha");
    expect(await bb.storage.kv.get("overrides")).toEqual({});
  });

  it("rejects an unknown handle", async () => {
    const { harness } = await loadPlugin();
    await expect(
      harness.behavior.callRpc("machines_set_override", { handle: "nope", label: "x" }),
    ).rejects.toThrow("No machine with handle nope");
  });
});

describe("bb machines CLI", () => {
  it("list --json round-trips the RPC machines", async () => {
    const { harness } = await loadPlugin();
    const { machines } = await listMachines(harness);
    const result = await harness.behavior.runCli(["list", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(machines);
  });

  it("list prints a table with the current marker", async () => {
    const { harness } = await loadPlugin();
    const result = await harness.behavior.runCli(["list"]);
    const lines = result.stdout.split("\n");
    expect(lines[0]).toMatch(/^\*  mbr\s+mbr\s+live\s+https:\/\/mbr\.getbb\.app$/);
    expect(lines.at(-1)).toMatch(/^\s+mbr-plexair\s+mbr-plexair\s+offline\s+https:\/\/mbr-plexair\.getbb\.app$/);
  });

  it("label and color write overrides, --clear removes the label", async () => {
    const { harness } = await loadPlugin();
    expect((await harness.behavior.runCli(["label", "studio", "Studio", "box"])).stdout).toBe(
      "Studio box (studio) colour=none",
    );
    expect((await harness.behavior.runCli(["color", "studio", "blue"])).stdout).toBe(
      "Studio box (studio) colour=blue",
    );
    expect((await harness.behavior.runCli(["label", "studio", "--clear"])).stdout).toBe(
      "studio (studio) colour=blue",
    );
  });

  it("returns usage with exit 1 on bad input", async () => {
    for (const argv of [["frobnicate"], ["label"], ["color", "mbr", "magenta"]]) {
      const result = await harness_run(argv);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/^Usage:/);
    }
  });
});

async function harness_run(argv: string[]) {
  const { harness } = await loadPlugin();
  return harness.behavior.runCli(argv);
}
