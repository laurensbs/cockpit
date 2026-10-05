#!/bin/bash
# Builds Cockpit on this Mac (Apple Silicon) and puts it in Apps, without GitHub Actions or the
# downloads branch. The data in ~/Library/Application Support/Cockpit stays; a copy of the database
# goes to ~/Library/Application Support/Cockpit-backups before the old app is swapped out.
#
#   bash scripts/install-mac-local.sh           checks, build, smoke test, install
#   bash scripts/install-mac-local.sh --quick   skip lint, typecheck and unit tests
#   bash scripts/install-mac-local.sh --open    open Cockpit when it is installed
set -euo pipefail
cd "$(dirname "$0")/.."

QUICK=0
OPEN=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --open) OPEN=1 ;;
    *) echo "Onbekende optie: $arg"; exit 1 ;;
  esac
done

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "Dit script is voor een Mac met een Apple-chip. Voor andere computers: scripts/build-mac.sh."
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
APP_OUT="release/dist/mac-arm64/Cockpit.app"
TARGET="/Applications/Cockpit.app"
DATA="$HOME/Library/Application Support/Cockpit"
BACKUPS="$HOME/Library/Application Support/Cockpit-backups"

[ -d node_modules ] || npm ci
if [ "$QUICK" = 0 ]; then
  echo "Controles: lint, typecheck, tests..."
  npm run lint
  npm run typecheck
  npm test
fi

echo "Cockpit $VERSION bouwen..."
npm run electron:server
npm run electron:compile
rm -rf release/dist/mac-arm64
npx electron-builder --mac dir --arm64

# Smoke test: the server inside the new app must start and answer, on a throwaway in-memory database.
PORT=41598
echo "Rooktest van de gebouwde app op poort $PORT..."
(cd "$APP_OUT/Contents/Resources/server" && ELECTRON_RUN_AS_NODE=1 NODE_ENV=production PORT=$PORT HOSTNAME=127.0.0.1 \
  COCKPIT_TOKEN="smoke-$(date +%s)-local-test" PGLITE_DIR=memory COCKPIT_PACKAGED=0 COCKPIT_VERSION="$VERSION" \
  "$OLDPWD/$APP_OUT/Contents/MacOS/Cockpit" server.js >/dev/null 2>&1) &
SMOKE=$!
healthy=""
for _ in $(seq 1 60); do
  healthy="$(curl -s -m 2 "http://127.0.0.1:$PORT/api/health" || true)"
  [ -n "$healthy" ] && break
  sleep 0.5
done
pkill -P "$SMOKE" 2>/dev/null || true
kill "$SMOKE" 2>/dev/null || true
wait "$SMOKE" 2>/dev/null || true
if ! echo "$healthy" | grep -q "\"version\":\"$VERSION\""; then
  echo "De rooktest faalde: de server in de nieuwe app antwoordde niet goed (${healthy:-geen antwoord}). Er is niets geïnstalleerd."
  exit 1
fi

WAS_RUNNING=0
if pgrep -x Cockpit >/dev/null; then
  WAS_RUNNING=1
  echo "Cockpit sluiten..."
  osascript -e 'quit app "Cockpit"' >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do pgrep -x Cockpit >/dev/null || break; sleep 0.5; done
  pkill -x Cockpit 2>/dev/null || true
  sleep 1
fi
# A server of an older Cockpit that outlived its window would answer in place of the new one.
PORT_IN_USE="$(node -p "try { require(process.argv[1]).port } catch { 41414 }" "$DATA/config.json" 2>/dev/null || echo 41414)"
for pid in $(lsof -nP -iTCP:"$PORT_IN_USE" -sTCP:LISTEN -t 2>/dev/null); do
  if lsof -a -p "$pid" -d cwd 2>/dev/null | grep -q "Cockpit.*\.app/Contents/Resources/server"; then
    echo "Oude Cockpit-server stoppen (pid $pid)..."
    kill "$pid" 2>/dev/null || true
  fi
done

OLD="none"
[ -e "$TARGET" ] && OLD="$(defaults read "$TARGET/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo unknown)"
if [ -d "$DATA/db" ]; then
  mkdir -p "$BACKUPS"
  COPY="$BACKUPS/db-$(date +%Y-%m-%d-%H%M%S)-v$OLD"
  cp -R "$DATA/db" "$COPY"
  echo "Kopie van je database: $COPY"
fi

# The old app goes to the Trash, so going back is one drag.
if [ -e "$TARGET" ]; then
  mv "$TARGET" "$HOME/.Trash/Cockpit $OLD $(date +%H%M%S).app"
fi
ditto "$APP_OUT" "$TARGET"
echo "Klaar: Cockpit $VERSION staat in Apps (was: $OLD)."

# macOS can still remember a Cockpit that is gone; -n starts it anyway.
if [ "$OPEN" = 1 ] || [ "$WAS_RUNNING" = 1 ]; then open "$TARGET" 2>/dev/null || open -n "$TARGET"; fi
