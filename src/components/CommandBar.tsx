'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { buildCommands, type Command, type CommandProject } from '@/lib/commands'
import { LaunchStatus } from './ClaudeButton'
import { Icon } from './Icon'
import { useClaudeLaunch } from './useClaudeLaunch'

/**
 * Cmd+K (Ctrl+K on Windows): jump to any place or project, start any Claude job, or ask Claude
 * whatever he types. The button in the top bar opens the same.
 */
export function CommandBar({ projects }: { projects: CommandProject[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const { open: launch, pending, launch: result, done, reset } = useClaudeLaunch()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const currentId = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  const current = projects.find((p) => p.id === currentId) ?? null
  const commands = useMemo(() => buildCommands(query, projects, current), [query, projects, current])

  const show = (next: boolean) => {
    if (next) {
      setQuery('')
      setActive(0)
      reset()
    }
    setOpen(next)
  }
  const toggle = useEffectEvent(() => show(!open))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (command: Command | undefined) => {
    if (!command) return
    if (command.kind === 'go') {
      show(false)
      router.push(command.href)
      return
    }
    const task = command.kind === 'ask' ? 'ask' : command.task
    const options = command.kind === 'ask' ? { question: command.question } : (command.options ?? {})
    void launch(task, command.projectId, options).then((r) => {
      if (r.ok && r.launched) setTimeout(() => show(false), 1400)
    })
  }

  return (
    <>
      <button type="button" className="command-trigger" onClick={() => show(true)} aria-keyshortcuts="Meta+K Control+K">
        <Icon name="search" size={16} />
        <span className="command-trigger-label">Zoek of vraag Claude</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="command-backdrop" onMouseDown={() => show(false)}>
          <div className="command" role="dialog" aria-modal="true" aria-label="Zoek of vraag Claude" onMouseDown={(e) => e.stopPropagation()}>
            <div className="command-input row nowrap">
              <Icon name="search" size={18} />
              <input
                autoFocus
                value={query}
                placeholder="Zoek een project of plek, kies een klus, of typ een vraag voor Claude…"
                aria-label="Zoek of vraag Claude"
                aria-controls="command-list"
                aria-activedescendant={commands[active] ? `command-${active}` : undefined}
                role="combobox"
                aria-expanded="true"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') show(false)
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive((a) => Math.min(a + 1, commands.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => Math.max(a - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    run(commands[active])
                  }
                }}
              />
              <kbd>esc</kbd>
            </div>
            {result || pending ? (
              <div className="command-status">{pending ? <p className="tiny muted">Claude begint…</p> : <LaunchStatus launch={result} done={done} />}</div>
            ) : null}
            <ul className="command-list" id="command-list" role="listbox" ref={list}>
              {commands.map((c, i) => {
                const header = i === 0 || commands[i - 1].group !== c.group ? c.group : null
                return (
                  <li key={c.id} role="presentation">
                    {header ? <p className="command-group">{header}</p> : null}
                    <button
                      type="button"
                      id={`command-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      className="command-item row nowrap"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(c)}
                    >
                      <Icon name={c.kind === 'go' ? (c.group === 'Projecten' ? 'projects' : 'arrow') : 'bolt'} size={16} />
                      <span className="grow command-label">{c.kind === 'ask' ? `“${c.label}”` : c.label}</span>
                      {c.hint ? <span className="tiny muted command-hint">{c.hint}</span> : null}
                    </button>
                  </li>
                )
              })}
              {!commands.length ? <li className="command-empty tiny muted">Niets gevonden.</li> : null}
            </ul>
            <p className="command-foot tiny muted">
              <kbd>↑</kbd> <kbd>↓</kbd> kiezen · <kbd>↵</kbd> doen
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
