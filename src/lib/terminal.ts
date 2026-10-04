// What goes into a command line or a terminal window, kept pure so it can be tested.

/** Only letters, digits and plain punctuation go into a command line (no ";": Windows Terminal splits on it). */
export const cleanPrompt = (text: string) =>
  text
    .replace(/[^\p{L}\p{N} .,:()_/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)

/** A value as one shell word: single quotes, so nothing in a folder name ($, `, spaces) is interpreted. */
export const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

/** The AppleScript lines that bring Terminal forward and run the command in the folder (macOS). */
export function terminalScript(dir: string, command: string): string[] {
  const shell = `cd ${shellQuote(dir)} && ${command}`
  const asString = `"${shell.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return ['tell application "Terminal"', 'activate', `do script ${asString}`, 'end tell']
}

/** The one line that installs Claude Code, for the system the cockpit runs on. */
export function claudeInstallCommand(platform: string): string {
  return platform === 'win32' ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash'
}

/** Where the Mac app and its install script live (the downloads branch of the repo). */
export const DOWNLOADS_URL = 'https://raw.githubusercontent.com/laurensbs/cockpit/downloads'

/** The one line that installs or updates Cockpit on a Mac; the same line as in the README. */
export const MAC_INSTALL_COMMAND = `curl -fsSL ${DOWNLOADS_URL}/install-mac.sh -o /tmp/cockpit-install.sh && bash /tmp/cockpit-install.sh`
