// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "./machine";
import { detectClient, openInBrowser, switchers } from "./client-bridge";

const studio: Machine = {
  handle: "studio",
  name: "studio",
  label: "studio",
  color: "none",
  url: "https://studio.getbb.app",
  live: true,
  isCurrent: false,
};

const globals = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete globals.bbDesktop;
  delete globals.bb;
});

describe("client bridge", () => {
  it("desktop switcher selects connect:<handle> through window.bbDesktop", async () => {
    const selectServer = vi.fn();
    globals.bbDesktop = {
      selectServer,
      getServerChoices: async () => [{ id: "builtin" }, { id: "connect:studio" }],
    };
    expect(detectClient()).toBe("desktop");
    await expect(switchers.desktop(studio, "/settings/general")).resolves.toBe(true);
    expect(selectServer).toHaveBeenCalledWith("connect:studio");
  });

  it("desktop switcher refuses a machine the desktop has not listed", async () => {
    const selectServer = vi.fn();
    globals.bbDesktop = { selectServer, getServerChoices: async () => [{ id: "builtin" }] };
    await expect(switchers.desktop(studio, "/settings/general")).rejects.toThrow(/no server entry/);
    expect(selectServer).not.toHaveBeenCalled();
  });

  it("desktop switcher falls back to a custom server entry matching the machine host", async () => {
    const selectServer = vi.fn();
    globals.bbDesktop = {
      selectServer,
      getServerChoices: async () => [
        { id: "builtin", name: "This Mac" },
        { id: "custom:abc", name: "studio.getbb.app" },
      ],
    };
    await expect(switchers.desktop(studio, "/settings/general")).resolves.toBe(true);
    expect(selectServer).toHaveBeenCalledWith("custom:abc");
  });

  it("mobile switcher opens the native server picker when the app has one", () => {
    const post = vi.fn();
    globals.bb = { native: { post, capabilities: ["open-external", "open-native"] } };
    expect(detectClient()).toBe("mobile");
    expect(switchers.mobile(studio, "/settings/general")).toBe(true);
    expect(post).toHaveBeenCalledExactlyOnceWith({ type: "open-native", screen: "device-settings" });
  });

  it("mobile switcher posts open-external with the deep-link path on older apps", () => {
    const post = vi.fn();
    globals.bb = { native: { post, capabilities: ["open-external"] } };
    expect(switchers.mobile(studio, "/settings/general")).toBe(true);
    expect(post).toHaveBeenCalledWith({
      type: "open-external",
      url: "https://studio.getbb.app/settings/general",
    });
  });

  it("mobile switcher declines without a usable capability", () => {
    const post = vi.fn();
    globals.bb = { native: { post, capabilities: [] } };
    expect(switchers.mobile(studio, "/settings/general")).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("opens a machine in Safari from the mobile app", () => {
    const post = vi.fn();
    globals.bb = { native: { post, capabilities: ["open-external", "open-native"] } };
    openInBrowser(studio);
    expect(post).toHaveBeenCalledExactlyOnceWith({
      type: "open-external",
      url: "https://studio.getbb.app",
    });
  });

  it("opens a machine in a new browser window elsewhere", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    globals.bbDesktop = { selectServer: vi.fn() };
    openInBrowser(studio);
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://studio.getbb.app",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("detects web when neither bridge exists", () => {
    expect(detectClient()).toBe("web");
  });

  it("ignores a malformed desktop global", async () => {
    globals.bbDesktop = { selectServer: "not a function" };
    expect(detectClient()).toBe("web");
    await expect(switchers.desktop(studio, "/settings/general")).resolves.toBe(false);
  });
});
