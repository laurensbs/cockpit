import { describe, expect, it } from 'vitest'
import { claudeInstallCommand, cleanPrompt, shellQuote, terminalScript } from './terminal'

describe('cleanPrompt', () => {
  it('keeps plain words and drops what a shell could act on', () => {
    expect(cleanPrompt('Haal ticket ab12cd34 op; rm -rf / && echo "x" $HOME `id`')).toBe('Haal ticket ab12cd34 op rm -rf / echo x HOME id')
    expect(cleanPrompt('a'.repeat(400))).toHaveLength(300)
  })
})

describe('shellQuote', () => {
  it('makes one shell word of anything', () => {
    expect(shellQuote('/Users/laurens/My Projects')).toBe("'/Users/laurens/My Projects'")
    expect(shellQuote("it's $HOME")).toBe("'it'\\''s $HOME'")
  })
})

describe('terminalScript', () => {
  it('brings Terminal forward and runs the command in the folder, quoted for AppleScript', () => {
    const lines = terminalScript('/Users/laurens/code/"rondje"', 'claude --allowedTools mcp__cockpit "Haal ticket ab12cd34 op"')
    expect(lines[0]).toBe('tell application "Terminal"')
    expect(lines[1]).toBe('activate')
    expect(lines[2]).toBe(`do script "cd '/Users/laurens/code/\\"rondje\\"' && claude --allowedTools mcp__cockpit \\"Haal ticket ab12cd34 op\\""`)
    expect(lines[3]).toBe('end tell')
  })
})

describe('claudeInstallCommand', () => {
  it('gives the right line per system', () => {
    expect(claudeInstallCommand('darwin')).toBe('curl -fsSL https://claude.ai/install.sh | bash')
    expect(claudeInstallCommand('win32')).toBe('irm https://claude.ai/install.ps1 | iex')
  })
})
