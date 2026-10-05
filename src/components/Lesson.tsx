'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { chime } from '@/lib/chime'
import { lessonLearned } from '@/lib/learning'
import { shareUrl } from '@/lib/share'
import type { LessonCard } from '@/server/lesson'
import { runInBackground } from '@/server/actions/claude'
import { setContactStatus } from '@/server/actions/contacts'
import { markContentDone } from '@/server/actions/content'
import { saveFollowers } from '@/server/actions/numbers'
import { acceptProspect, prospectWantsInfo, skipProspect } from '@/server/actions/prospects'
import { completeQuest } from '@/server/actions/quests'
import { STEP_ICON } from './DayPath'
import { PostImage } from './PostImage'

type Feedback = { tone: 'good' | 'neutral' | 'bad'; text: string; xp: number }
type Phase = 'act' | 'ask-info' | 'reasons'

const PLATFORM: Record<string, string> = { instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', tiktok: 'TikTok', discord: 'Discord' }
const REASONS = ['past niet', 'klopt niet wat Claude zag', 'te groot', 'te ver weg', 'anders'] as const
const PLATFORM_HOME: Record<string, string> = { instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/', x: 'https://x.com/compose/post' }

/**
 * The day as a lesson: one card at a time, a big button, a green "goed zo" and on to the next. Claude
 * prepared every card; he does or decides. Leaving halfway is fine: what he did counts.
 */
export function Lesson({ cards: initial, done, goal, streak }: { cards: LessonCard[]; done: number; goal: number; streak: number }) {
  const router = useRouter()
  // The lesson keeps the cards it started with: every action refreshes the page, and a card that is done
  // would otherwise vanish from under the one he is looking at.
  const [cards] = useState(initial)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('act')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [xp, setXp] = useState(0)
  const [actions, setActions] = useState(0)
  // What he decided on businesses in this lesson, for the one sentence at the end.
  const [yes, setYes] = useState(0)
  const [reasons, setReasons] = useState<string[]>([])
  const [pending, start] = useTransition()
  const card = cards[index]
  const progress = cards.length ? Math.round(((index + (feedback ? 1 : 0)) / cards.length) * 100) : 100

  const answer = (f: Feedback, counts = f.tone === 'good') => {
    if (f.tone === 'good') chime('good')
    setFeedback(f)
    setXp((x) => x + f.xp)
    if (counts) setActions((a) => a + 1)
  }
  const run = (fn: () => Promise<Feedback | null>) =>
    start(async () => {
      try {
        const f = await fn()
        if (f) answer(f)
      } catch {
        answer({ tone: 'bad', text: 'Dat lukte niet. Probeer het later nog eens.', xp: 0 }, false)
      }
    })
  const next = () => {
    setFeedback(null)
    setPhase('act')
    if (index + 1 >= cards.length && cards.length) chime('done')
    setIndex((i) => i + 1)
  }
  const later = (text = 'Komt een andere keer terug.') => answer({ tone: 'neutral', text, xp: 0 }, false)

  if (!card) {
    const reached = done + actions >= goal
    return (
      <div className="lesson">
        {reached ? <Confetti /> : null}
        <main className="lesson-end stack-m">
          <div className="lesson-flame" aria-hidden="true">
            {reached ? '🔥' : '✨'}
          </div>
          {reached && streak ? <span className="chip flame lesson-streak">🔥 {streak} {streak === 1 ? 'dag' : 'dagen'} op rij</span> : null}
          <h1>{reached ? 'Dagdoel gehaald!' : cards.length ? 'Lekker bezig!' : 'Niets te doen nu'}</h1>
          <p className="muted">{cards.length ? `+${xp} XP in deze les${streak ? ` · ${streak} ${streak === 1 ? 'dag' : 'dagen'} op rij` : ''}` : 'Claude zoekt verder. Kom straks terug.'}</p>
          {lessonLearned(yes, reasons) ? <p className="small">{lessonLearned(yes, reasons)}</p> : null}
          <button
            type="button"
            className="button primary big"
            onClick={() => {
              router.push('/')
              router.refresh()
            }}
          >
            Klaar
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="lesson">
      <header className="lesson-top">
        <Link href="/" className="lesson-close" aria-label="Stoppen">
          ✕
        </Link>
        <div className="lesson-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Voortgang van je dag">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="chip flame" title="Dagen op rij">
          🔥 {streak}
        </span>
      </header>

      <main key={index} className="lesson-card stack-m" aria-live="polite">
        <div className="lesson-icon" aria-hidden="true">
          {card.kind === 'prospect' ? STEP_ICON.prospects : STEP_ICON[card.kind]}
        </div>
        <h1>{phase === 'ask-info' ? 'Wilden ze informatie?' : card.title}</h1>
        {card.sub ? <p className="muted">{card.sub}</p> : null}
        <CardBody card={card} phase={phase} />
      </main>

      <footer className={`lesson-foot${feedback ? ` ${feedback.tone}` : ''}`}>
        {feedback ? (
          <div className="lesson-feedback">
            <strong>
              {feedback.tone === 'good' ? '✓ ' : ''}
              {feedback.text}
              {feedback.xp ? ` +${feedback.xp} XP` : ''}
            </strong>
            <button type="button" className="button primary big" onClick={next} autoFocus>
              Verder
            </button>
          </div>
        ) : (
          <Actions
            card={card}
            phase={phase}
            setPhase={setPhase}
            pending={pending}
            run={run}
            later={later}
            credit={(n) => {
              setXp((x) => x + n)
              setActions((a) => a + 1)
            }}
            decided={(reason) => (reason ? setReasons((r) => [...r, reason]) : setYes((n) => n + 1))}
          />
        )}
      </footer>
    </div>
  )
}

function CardBody({ card, phase }: { card: LessonCard; phase: Phase }) {
  if (card.kind === 'call')
    return phase === 'ask-info' ? (
      <p>Vroegen ze om informatie? Dan stuurt de cockpit de mail die Claude klaarzette. Dat mag, want ze vroegen erom.</p>
    ) : card.phone ? (
      <a className="lesson-phone" href={`tel:${card.phone}`}>
        📞 {card.phone}
      </a>
    ) : (
      <p className="muted">Geen nummer gevonden: kijk op hun site.</p>
    )
  if (card.kind === 'prospect') {
    if (phase === 'reasons') return <p>Waarom niet? Dan zoekt Claude beter.</p>
    return (
      <div className="stack-s">
        <div className="notice stack-xs">
          <strong>Wat Claude zag</strong>
          <span>{card.p.observation}</span>
          {card.p.website ? (
            <a href={card.p.website} target="_blank" rel="noreferrer noopener" className="tiny">
              Kijk zelf
            </a>
          ) : null}
        </div>
        {card.p.pitch ? (
          <p className="small">
            <strong>Zo open je:</strong> “{card.p.pitch}”
          </p>
        ) : null}
      </div>
    )
  }
  if (card.kind === 'post') return <PostBody card={card} />
  if (card.kind === 'build') return <p>Claude maakt er een post van, over wat je bouwde. Jij kijkt hem daarna na.</p>
  if (card.kind === 'growth') return <p>Claude doet het werk op de achtergrond. Het staat daarna in de cockpit.</p>
  if (card.kind === 'reply') return <p>Een antwoord is goud: daarmee telt het mee in je trechter.</p>
  return null
}

function PostBody({ card }: { card: Extract<LessonCard, { kind: 'post' }> }) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const share = shareUrl(card.platform, card.text)
  const open = share ?? card.profile ?? PLATFORM_HOME[card.platform] ?? null
  return (
    <div className="stack-s">
      <PostImage hook={card.hook} project={card.projectName} color={card.color} onSaved={() => setSaved(true)} />
      <ol className="lesson-checklist">
        <li className={saved ? 'done' : ''}>Bewaar het beeld</li>
        <li className={copied ? 'done' : ''}>
          <button
            type="button"
            className="button secondary small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(card.text)
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            {copied ? 'Tekst gekopieerd' : 'Kopieer de tekst'}
          </button>
        </li>
        <li>
          {open ? (
            <a className="button secondary small" href={open} target="_blank" rel="noreferrer noopener">
              Open {PLATFORM[card.platform] ?? card.platform}
            </a>
          ) : (
            `Open ${PLATFORM[card.platform] ?? card.platform}`
          )}
        </li>
      </ol>
    </div>
  )
}

function Actions({
  card,
  phase,
  setPhase,
  pending,
  run,
  later,
  credit,
  decided,
}: {
  card: LessonCard
  phase: Phase
  setPhase: (p: Phase) => void
  pending: boolean
  run: (fn: () => Promise<Feedback | null>) => void
  later: (text?: string) => void
  credit: (xp: number) => void
  decided: (reason?: string) => void
}) {
  const [followers, setFollowers] = useState('')
  const [email, setEmail] = useState('')
  const big = 'button primary big'
  const second = 'button secondary big'

  if (card.kind === 'call') {
    if (phase === 'ask-info')
      return (
        <div className="lesson-actions">
          {!card.hasEmail ? <input className="input" type="email" placeholder="Hun e-mailadres" aria-label="Hun e-mailadres" value={email} onChange={(e) => setEmail(e.target.value)} /> : null}
          <button
            type="button"
            className={big}
            disabled={pending || !card.contactId}
            onClick={() =>
              run(async () => {
                const r = await prospectWantsInfo(card.contactId!, email)
                return { tone: r.ok ? 'good' : 'bad', text: r.ok ? 'De infomail staat klaar.' : r.message, xp: 0 }
              })
            }
          >
            Ja, stuur de info
          </button>
          <div className="row">
            <button
              type="button"
              className={second}
              disabled={pending || !card.contactId}
              onClick={() =>
                run(async () => {
                  await setContactStatus(card.contactId!, 'no')
                  return { tone: 'neutral', text: 'Genoteerd: geen interesse.', xp: 0 }
                })
              }
            >
              Nee
            </button>
            <button type="button" className="button ghost big" onClick={() => later('Prima, dat hoor je nog.')}>
              Weet ik nog niet
            </button>
          </div>
        </div>
      )
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await completeQuest(card.questId)
              if (!card.contactId) return { tone: 'good', text: 'Goed zo!', xp: r.xp }
              // The call counts now; the question about information comes next on the same card.
              credit(r.xp)
              setPhase('ask-info')
              return null
            })
          }
        >
          Gebeld ✓
        </button>
        <button type="button" className={second} onClick={() => later('Morgen weer een kans.')}>
          Niet bereikt
        </button>
      </div>
    )
  }

  if (card.kind === 'prospect') {
    if (phase === 'reasons')
      return (
        <div className="lesson-actions">
          <div className="row">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="button secondary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await skipProspect(card.p.id, r)
                    if (res.ok) decided(r)
                    return { tone: 'good', text: 'Duidelijk, die komt niet terug.', xp: res.xp ?? 0 }
                  })
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await acceptProspect(card.p.id)
              if (res.ok) decided()
              return { tone: res.ok ? 'good' : 'bad', text: res.ok ? 'Staat bij je belkaarten.' : res.message, xp: res.xp ?? 0 }
            })
          }
        >
          {card.p.channel === 'visit' ? 'Ja, ik ga langs' : 'Ja, ik bel ze'}
        </button>
        <div className="row">
          <button type="button" className={second} onClick={() => setPhase('reasons')}>
            Nee
          </button>
          <button type="button" className="button ghost big" onClick={() => later()}>
            Later
          </button>
        </div>
      </div>
    )
  }

  if (card.kind === 'reply')
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await setContactStatus(card.contactId, 'replied')
              return { tone: 'good', text: 'Een antwoord!', xp: r.xp }
            })
          }
        >
          Ja, ze antwoordden
        </button>
        <button type="button" className={second} onClick={() => later('Dan vraag ik het later nog eens.')}>
          Nog niet
        </button>
      </div>
    )

  if (card.kind === 'checkin')
    return (
      <div className="lesson-actions">
        <input className="input lesson-number" inputMode="numeric" placeholder="Aantal volgers" aria-label="Aantal volgers" value={followers} onChange={(e) => setFollowers(e.target.value.replace(/[^\d]/g, ''))} />
        <button
          type="button"
          className={big}
          disabled={pending || !followers || !card.projectId}
          onClick={() =>
            run(async () => {
              const r = await saveFollowers(card.projectId!, Number(followers))
              return { tone: r.ok ? 'good' : 'bad', text: r.ok ? 'Bewaard.' : r.message, xp: r.xp }
            })
          }
        >
          Bewaar
        </button>
      </div>
    )

  if (card.kind === 'post')
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await markContentDone(card.itemId, true)
              return { tone: 'good', text: 'Gepost!', xp: r.xp }
            })
          }
        >
          Gepost ✓
        </button>
        <button type="button" className={second} onClick={() => later()}>
          Later
        </button>
      </div>
    )

  // build and growth: Claude does the work in the background.
  return (
    <div className="lesson-actions">
      <button
        type="button"
        className={big}
        disabled={pending || !card.projectId}
        onClick={() =>
          run(async () => {
            const r =
              card.kind === 'build'
                ? await runInBackground('posts', card.projectId!, { platform: card.platform, note: card.note })
                : await runInBackground(card.task ?? 'ask', card.projectId!, card.options ?? {})
            return { tone: r.ok ? 'good' : 'bad', text: r.ok ? 'Claude is ermee bezig.' : r.message, xp: 0 }
          })
        }
      >
        {card.kind === 'build' ? 'Maak de post' : 'Laat Claude het doen'}
      </button>
      <button type="button" className={second} onClick={() => later()}>
        Later
      </button>
    </div>
  )
}

const CONFETTI = ['#b5f23d', '#8f80ff', '#ffd23f', '#ff7a59', '#34d399']

/** A short shower of confetti, drawn with CSS; nothing for someone who prefers less motion. */
function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI[i % CONFETTI.length],
            animationDelay: `${(i % 7) * 0.08}s`,
            animationDuration: `${1.4 + (i % 5) * 0.2}s`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}
