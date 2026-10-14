---
name: machine-switcher
description: List the user's bb machines (servers on their getbb.app account) and set per-machine nicknames and colours with the `bb machines` CLI. Use when the user asks which machines they have, which one is current, or wants to rename or colour a machine in the sidebar switcher.
---

# Machine switcher

`bb machines` reads the same machine list the sidebar switcher shows. The row marked `*` is the machine this bb runs on.

| Command | Effect |
| --- | --- |
| `bb machines list [--json]` | List machines: marker, label, handle, live/offline, url. |
| `bb machines label <handle> <text…>` | Set a nickname (max 40 characters). |
| `bb machines label <handle> --clear` | Remove the nickname. |
| `bb machines color <handle> <color>` | Colour the machine's dot. Colours: none, red, orange, yellow, green, teal, blue, purple, pink. |

Use the `handle` column as the id. Switching machines is a user action in the app; the CLI cannot switch for them.
