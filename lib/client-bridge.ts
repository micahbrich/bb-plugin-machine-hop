import type { Machine } from "./machine";

export type ClientKind = "desktop" | "mobile" | "web";

type DesktopChoice = { id: string; name: string };
type DesktopBridge = {
  selectServer(id: string): void;
  listChoices(): Promise<DesktopChoice[] | null>;
};
type MobileBridge = { post(message: unknown): void; capabilities: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function windowGlobals(): Record<string, unknown> {
  return typeof window === "undefined" ? {} : (window as unknown as Record<string, unknown>);
}

function readDesktopBridge(): DesktopBridge | null {
  const candidate = windowGlobals().bbDesktop;
  if (!isRecord(candidate) || typeof candidate.selectServer !== "function") return null;
  const selectServer = candidate.selectServer;
  const getServerChoices = candidate.getServerChoices;
  return {
    selectServer: (id) => void selectServer.call(candidate, id),
    async listChoices() {
      if (typeof getServerChoices !== "function") return null;
      const choices: unknown = await getServerChoices.call(candidate);
      if (!Array.isArray(choices)) return null;
      return choices.flatMap((c) =>
        isRecord(c) && typeof c.id === "string"
          ? [{ id: c.id, name: typeof c.name === "string" ? c.name : "" }]
          : [],
      );
    },
  };
}

function readMobileBridge(): MobileBridge | null {
  const bb = windowGlobals().bb;
  if (!isRecord(bb)) return null;
  const native = bb.native;
  if (!isRecord(native) || typeof native.post !== "function") return null;
  const post = native.post;
  const capabilities = Array.isArray(native.capabilities)
    ? native.capabilities.filter((c): c is string => typeof c === "string")
    : [];
  return { post: (message) => void post.call(native, message), capabilities };
}

export function detectClient(): ClientKind {
  if (readDesktopBridge() !== null) return "desktop";
  if (readMobileBridge() !== null) return "mobile";
  return "web";
}

export function resolveDesktopChoiceId(
  machine: Machine,
  choices: DesktopChoice[] | null,
): string | null {
  const connectId = `connect:${machine.handle}`;
  if (choices === null) return connectId;
  if (choices.some((c) => c.id === connectId)) return connectId;
  const host = new URL(machine.url).host;
  return choices.find((c) => c.id.startsWith("custom:") && c.name === host)?.id ?? null;
}

export const switchers: Record<
  ClientKind,
  (machine: Machine, mobileLinkPath: string) => boolean | Promise<boolean>
> = {
  async desktop(machine) {
    const bridge = readDesktopBridge();
    if (bridge === null) return false;
    const choices = await bridge.listChoices();
    const id = resolveDesktopChoiceId(machine, choices);
    if (id === null) {
      throw new Error(
        `This desktop app has no server entry for ${machine.label}. In bb → Desktop Settings → Server, sign in to bb Connect, or use Add Server… with ${machine.url}, then try again.`,
      );
    }
    bridge.selectServer(id);
    return true;
  },
  mobile(machine, mobileLinkPath) {
    const bridge = readMobileBridge();
    if (bridge === null) return false;
    // Apps with open-native send every other-origin link, including universal links they
    // claim, to Safari, so the best we can do is open the native server picker.
    if (bridge.capabilities.includes("open-native")) {
      bridge.post({ type: "open-native", screen: "device-settings" });
      return true;
    }
    if (bridge.capabilities.includes("open-external")) {
      bridge.post({ type: "open-external", url: machine.url + mobileLinkPath });
      return true;
    }
    return false;
  },
  web(machine) {
    window.location.assign(machine.url);
    return true;
  },
};

export async function switchToMachine(machine: Machine, mobileLinkPath: string): Promise<void> {
  if (!(await switchers[detectClient()](machine, mobileLinkPath))) {
    switchers.web(machine, mobileLinkPath);
  }
}
