# Cockpit voor de Mac (Apple-chip), 0.7.1

Deze branch bevat alleen de kant-en-klare Mac-app (in delen, want GitHub neemt geen bestanden boven 100 MB) en het script dat hem installeert. De broncode staat op `main`.

## Installeren of bijwerken

Open **Terminal** (Cmd+spatie, typ *Terminal*), plak deze regel en druk op Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/laurensbs/cockpit/downloads/install-mac.sh -o /tmp/cockpit-install.sh && bash /tmp/cockpit-install.sh
```

De regel haalt [`install-mac.sh`](install-mac.sh) uit deze repo en voert het uit. Lees het gerust eerst. Het script downloadt de delen naar een nieuwe tijdelijke map en controleert of ze compleet zijn. Daarna pakt het `Cockpit.app` uit, haalt een oude Cockpit weg, zet de nieuwe in Apps en opent hem. Je gegevens in `~/Library/Application Support/Cockpit` blijven staan. Voor een nieuwe versie gebruik je dezelfde regel.

- De eerste keer dat een knop Claude Code opent, vraagt macOS of Cockpit **Terminal** mag bedienen: kies **OK**.
- Deze versie is voor Macs met een Apple-chip (M1 en nieuwer).
