#!/bin/sh
# Renders the README screenshots in docs/ from the mockups in this folder.
# Needs Google Chrome; sips ships with macOS. Edit the HTML, then run: docs/mockups/render.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
profile=$(mktemp -d)
trap 'rm -rf "$profile"' EXIT

render() {
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$profile" \
    --force-device-scale-factor=2 --window-size="$2,$3" \
    --screenshot="$profile/$1.png" "file://$here/$1.html" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 90 "$profile/$1.png" --out "$here/../switcher-$1.jpg" >/dev/null
  echo "docs/switcher-$1.jpg"
}

render desktop 281 158
render mobile 390 844
render settings 960 560
