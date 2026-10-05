#!/bin/bash
# Installeert of werkt Cockpit bij op een Mac met een Apple-chip.
#
# Wat dit script doet: het downloadt de delen uit deze repo naar een nieuwe tijdelijke map,
# controleert of ze compleet zijn, pakt de app uit, haalt een oude Cockpit weg en zet de nieuwe in
# Apps. Je gegevens (~/Library/Application Support/Cockpit) blijven staan.
set -euo pipefail

VERSION="0.7.0"
SHA256="25087e57dd35233f4cbcfdbd4be92f524697d3cc25cb3e458a28904dedbed7c7"
BASE="https://raw.githubusercontent.com/laurensbs/cockpit/downloads"
PARTS=("Cockpit-mac-arm64.tar.gz.1" "Cockpit-mac-arm64.tar.gz.2" "Cockpit-mac-arm64.tar.gz.3")

if [ "$(uname -m)" != "arm64" ]; then
  echo "Deze Mac heeft een Intel-chip. Deze Cockpit is voor Macs met een Apple-chip (M1 en nieuwer)."
  exit 1
fi

work="$(mktemp -d /tmp/cockpit.XXXXXX)"
cd "$work"
echo "Cockpit $VERSION downloaden (ongeveer 175 MB)..."
for part in "${PARTS[@]}"; do
  curl -fL --progress-bar -o "$part" "$BASE/$part"
done
cat "${PARTS[@]}" > cockpit.tar.gz
if ! echo "$SHA256  cockpit.tar.gz" | shasum -a 256 -c - >/dev/null 2>&1; then
  echo "De download is niet compleet. Voer de regel nog een keer uit."
  exit 1
fi
tar -xzf cockpit.tar.gz

# Een draaiende Cockpit eerst sluiten; de oude app gaat weg, je gegevens niet.
if pgrep -x Cockpit >/dev/null; then
  echo "Cockpit sluiten..."
  pkill -x Cockpit || true
  sleep 2
fi
if [ -e /Applications/Cockpit.app ]; then
  rm -rf /Applications/Cockpit.app || {
    echo "De oude Cockpit kon niet weg. Sleep Cockpit in Apps naar de prullenmand en voer de regel opnieuw uit."
    exit 1
  }
fi
mv Cockpit.app /Applications/Cockpit.app
cd /tmp && rm -rf "$work"
echo "Klaar: Cockpit $VERSION staat in Apps en gaat nu open."
open /Applications/Cockpit.app
