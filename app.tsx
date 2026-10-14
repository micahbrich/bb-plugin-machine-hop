import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { MachinesDisclosure } from "./components/machines-disclosure";
import { MachineOverridesSection } from "./components/machine-overrides-section";

export default definePluginApp((app) => {
  const controller = app.experimental_sidebarFooter.register({
    kind: "disclosure",
    id: "machines",
    label: "Switch machine",
    icon: "ComputerCloud",
    component: MachinesDisclosure,
  });
  app.commands.register({
    id: "switch",
    title: "Machines: switch machine",
    defaultShortcut: { key: "m", mod: true, alt: true },
    run: () => controller.toggle(),
  });
  app.slots.settingsSection({
    id: "overrides",
    title: "Machine names and colours",
    description: "Nickname and colour each bb machine as it appears in the switcher.",
    component: MachineOverridesSection,
  });
});
