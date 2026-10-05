#!/bin/bash
# Puts ffmpeg for one platform in release/ffmpeg (with its licence and readme), for the app to make
# videos with. The binaries are ffmpeg-static's builds, pinned by version and checksum.
#
#   bash scripts/fetch-ffmpeg.sh darwin-arm64   (or win32-x64, linux-x64)
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:?darwin-arm64, win32-x64 or linux-x64}"
RELEASE=b6.1.1
BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/$RELEASE"
case "$TARGET" in
  darwin-arm64) SHA=8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa; EXE=ffmpeg ;;
  win32-x64) SHA=8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77; EXE=ffmpeg.exe ;;
  linux-x64) SHA=bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa; EXE=ffmpeg ;;
  *) echo "Unknown target $TARGET" >&2; exit 1 ;;
esac

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/cockpit-ffmpeg/$RELEASE"
mkdir -p "$CACHE"
GZ="$CACHE/ffmpeg-$TARGET.gz"
[ -f "$GZ" ] || curl -fsSL --retry 3 -o "$GZ" "$BASE/ffmpeg-$TARGET.gz"
echo "$SHA  $GZ" | sha256sum -c - >/dev/null || { echo "Checksum of ffmpeg-$TARGET.gz does not match" >&2; rm -f "$GZ"; exit 1; }
for f in LICENSE README; do [ -f "$CACHE/$TARGET.$f" ] || curl -fsSL --retry 3 -o "$CACHE/$TARGET.$f" "$BASE/$TARGET.$f"; done

rm -rf release/ffmpeg
mkdir -p release/ffmpeg
gunzip -c "$GZ" > "release/ffmpeg/$EXE"
chmod +x "release/ffmpeg/$EXE"
cp "$CACHE/$TARGET.LICENSE" release/ffmpeg/LICENSE.txt
cp "$CACHE/$TARGET.README" release/ffmpeg/README.txt
echo "ffmpeg ($RELEASE, $TARGET) in release/ffmpeg"
