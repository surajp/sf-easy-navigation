#!/usr/bin/env bash
# --- Build browser-specific copies of the extension into dist/ ---
# dist/chrome:  background is a service worker only (no "background.scripts" warning in Chrome)
# dist/firefox: background is an event-page script only, plus the gecko add-on ID
# Usage: ./build.sh  (or npm run build)
set -euo pipefail

cd "$(dirname "$0")"

SOURCE_FILES=(background.js content icons styles.css modal.css)
FIREFOX_ADDON_ID="salesforce-navigation@extension.local"
FIREFOX_MIN_VERSION="128.0"

build_target() {
  local target="$1"
  local output_dir="dist/$target"
  rm -rf "$output_dir"
  mkdir -p "$output_dir"
  cp -R "${SOURCE_FILES[@]}" "$output_dir/"

  TARGET="$target" OUTPUT_DIR="$output_dir" \
    FIREFOX_ADDON_ID="$FIREFOX_ADDON_ID" FIREFOX_MIN_VERSION="$FIREFOX_MIN_VERSION" \
    node -e '
      const fs = require("fs");
      const { TARGET, OUTPUT_DIR, FIREFOX_ADDON_ID, FIREFOX_MIN_VERSION } = process.env;
      const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
      if (TARGET === "chrome") {
        manifest.background = { service_worker: "background.js" };
      } else {
        manifest.background = { scripts: ["background.js"] };
        manifest.browser_specific_settings = {
          gecko: { id: FIREFOX_ADDON_ID, strict_min_version: FIREFOX_MIN_VERSION },
        };
      }

      // Fail the build if the manifest references a file that was not copied
      const referencedFiles = [
        ...manifest.content_scripts.flatMap((script) => [...(script.js || []), ...(script.css || [])]),
        ...(manifest.background.scripts || []),
        ...(manifest.background.service_worker ? [manifest.background.service_worker] : []),
        ...Object.values(manifest.icons || {}),
      ];
      const missingFiles = referencedFiles.filter((file) => !fs.existsSync(`${OUTPUT_DIR}/${file}`));
      if (missingFiles.length > 0) {
        console.error(`${TARGET}: manifest references missing files: ${missingFiles.join(", ")}`);
        process.exit(1);
      }

      fs.writeFileSync(`${OUTPUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
    '

  for script in "$output_dir"/background.js "$output_dir"/content/*.js; do
    node --check "$script"
  done
  echo "Built $output_dir"
}

build_target chrome
build_target firefox
