#!/bin/bash
# Builds the Mac app (Apple Silicon) on any computer, also on Linux, and packs it for the downloads
# branch: release/mac/Cockpit-mac-arm64.tar.gz.1, .2 plus its checksum.
#
# Needs: node, rcodesign (cargo install apple-codesign). Optional: ELECTRON_ZIP_DIR with a downloaded
# electron-v<version>-darwin-arm64.zip when the download itself is blocked.
#
# Only the main app and its helpers get a new (ad-hoc) signature: the packager renamed them. The
# Electron frameworks stay exactly as Electron ships them, the way every Electron developer runs them.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
ELECTRON="$(node -p "require('electron/package.json').version")"
OUT=release/mac

npm run electron:server
npm run electron:compile
bash scripts/fetch-ffmpeg.sh darwin-arm64
rm -rf "$OUT"
npx --yes @electron/packager@20.3.0 . Cockpit --platform=darwin --arch=arm64 --out="$OUT" --overwrite \
  --icon=resources/icon.icns --extra-resource=release/server --extra-resource=release/ffmpeg --app-bundle-id=app.cockpit.desktop \
  --app-version="$VERSION" --build-version="$VERSION" --electron-version="$ELECTRON" \
  ${ELECTRON_ZIP_DIR:+--electron-zip-dir="$ELECTRON_ZIP_DIR"} \
  --app-category-type=public.app-category.productivity --extend-info=resources/extend-info.plist --asar \
  --ignore='^/(?!dist-electron(/|$)|package\.json$).+'

APP="$OUT/Cockpit-darwin-arm64/Cockpit.app"
rcodesign sign --exclude 'Contents/Frameworks/*.framework' --exclude 'Contents/Frameworks/*.framework/**' "$APP"

(cd "$OUT/Cockpit-darwin-arm64" && tar --owner=0 --group=0 --numeric-owner -cf - Cockpit.app | gzip -9 > ../Cockpit-mac-arm64.tar.gz)
(cd "$OUT" && split -b 80M -a 1 --numeric-suffixes=1 Cockpit-mac-arm64.tar.gz Cockpit-mac-arm64.tar.gz. && sha256sum Cockpit-mac-arm64.tar.gz)
echo "Cockpit $VERSION for the Mac: $OUT/Cockpit-mac-arm64.tar.gz.1 and .2"
