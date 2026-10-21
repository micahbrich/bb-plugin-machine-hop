Jump between the bb servers on your getbb.app account without digging through
native menus.

## What you get

- A **Switch machine** button in the sidebar footer. It opens a list of your
  machines with the current one checked, each machine's colour dot, and a
  live or offline marker. Tap one to switch, or tap ↗ on a live row to
  open it in your browser alongside this one.
- A palette command, **Machines: switch machine** (Mod+Alt+M), that opens
  the same list.
- A `bb machines` command for terminals and agents.
- Nicknames and colours per machine, edited on the plugin's settings page.

## How it works

The list comes from the builtin bb connect plugin, so it matches the account
you are signed in to. On desktop the switch is native. On the mobile app the
plugin opens the app's native server picker (older app versions get a
universal link that the app claims instead). In a browser it navigates
to the machine's URL. Nicknames and colours are stored on the machine you set
them from.
