'use client'

import { Check, ExternalLink, Flame, Phone, Sparkles, Trophy, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { chime } from '@/lib/chime'
import { lessonLearned } from '@/lib/learning'
import { NO_REASONS, YES_VERB } from '@/lib/prospect'
import { MEASURE_LABEL, MEASURES, type WeekScore } from '@/lib/week-score'
import { shareUrl } from '@/lib/share'
import { searchLinks } from '@/lib/visibility'
import type { LessonCard } from '@/server/lesson'
import { runInBackground } from '@/server/actions/claude'
import { setContactStatus } from '@/server/actions/contacts'
import { gaveValue, markContentDone } from '@/server/actions/content'
import { moneyStep } from '@/server/actions/money'
import { saveSeen } from '@/server/actions/seo'
import { saveFollowers } from '@/server/actions/numbers'
import { setSetupStatus } from '@/server/actions/setup'
import { acceptProspect, prospectWantsInfo, skipProspect } from '@/server/actions/prospects'
import { completeQuest } from '@/server/actions/quests'
import { Bubble } from './Bubble'
import { ProspectFacts } from './ProspectFacts'
import { STEP_LOOK, StepDisc } from './StepIcon'
import { META_PLANNER } from './PostCard'
import { PostImage } from './PostImage'

type Feedback = { tone: 'good' | 'neutral' | 'bad'; text: string; xp: number }
type Phase = 'act' | 'ask-info' | 'reasons'

const PLATFORM: Record<string, string> = { instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', tiktok: 'TikTok', discord: 'Discord' }
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'de plek'
  }
}
/** What kind of step a card is, above its title. */
const KIND_LABEL: Record<LessonCard['kind'], string> = {
  call: 'Bellen',
  prospect: 'Nieuw bedrijf',
  reply: 'Antwoord?',
  give: 'Help iemand',
  setup: 'Regelen',
  money: 'Geld',
  checkin: 'Je cijfers',
  seen: 'Gevonden worden',
  post: 'Posten',
  build: 'Laat zien wat je bouwde',
  growth: 'Groeistap',
}

const PLATFORM_HOME: Record<string, string> = { instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/', x: 'https://x.com/compose/post' }

/**
 * The day as a lesson: one card at a time, a big button, a green "goed zo" and on to the next. Claude
 * prepared every card; he does or decides. Leaving halfway is fine: what he did counts.
 */
export function Lesson({ cards: initial, done, goal, streak, week }: { cards: LessonCard[]; done: number; goal: number; streak: number; week?: { now: WeekScore['now']; before: WeekScore['before'] } }) {
  const router = useRouter()
  // The lesson keeps the cards it started with: every action refreshes the page, and a card that is done
  // would otherwise vanish from under the one he is looking at.
  const [cards] = useState(initial)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('act')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
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
  // At the end, read the week again, so its numbers include what he just did.
  const ended = !cards[index]
  useEffect(() => {
    if (ended && cards.length) router.refresh()
  }, [ended, cards.length, router])

  if (!card) {
    const reached = done + actions >= goal
    // This week next to last week, for what moved: real progress instead of points.
    const moved = week ? MEASURES.filter((m) => week.now[m] || week.before[m]) : []
    return (
      <div className="lesson">
        {reached ? <Confetti /> : null}
        <span />
        <main className="lesson-end">
          <span className={`disc ${reached ? 'tone-gold' : 'tone-violet'}`} style={{ width: 112, height: 112 }} aria-hidden="true">
            {reached ? <Trophy size={52} strokeWidth={2.5} /> : <Sparkles size={52} strokeWidth={2.5} />}
          </span>
          <h1>{reached ? 'Dagdoel gehaald!' : cards.length ? 'Lekker bezig!' : 'Niets te doen nu'}</h1>
          {cards.length && actions ? (
            <p className="muted">
              {actions} {actions === 1 ? 'stap' : 'stappen'} gedaan
            </p>
          ) : null}
          {moved.length && week ? (
            <ul className="end-week small">
              {moved.map((m) => (
                <li key={m}>
                  {MEASURE_LABEL[m]} deze week: <strong className="num">{week.now[m]}</strong> <span className="muted">(vorige week {week.before[m]})</span>
                </li>
              ))}
            </ul>
          ) : null}
          {cards.length ? (
            <div className="end-stats">
              <div className="end-stat tone-orange">
                <span>Op rij</span>
                <strong>
                  <Flame size={22} strokeWidth={2.5} fill="currentColor" aria-hidden="true" /> {streak} {streak === 1 ? 'dag' : 'dagen'}
                </strong>
              </div>
            </div>
          ) : (
            <p className="muted">Claude zoekt verder. Kom straks terug.</p>
          )}
          {lessonLearned(yes, reasons) ? <p className="small muted">{lessonLearned(yes, reasons)}</p> : null}
        </main>
        <footer className="lesson-foot">
          <div className="lesson-actions">
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
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="lesson">
      <header className="lesson-top">
        <Link href="/" className="lesson-close" aria-label="Stoppen">
          <X size={26} strokeWidth={2.75} aria-hidden="true" />
        </Link>
        <div className="lesson-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Voortgang van je dag">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="lesson-streak-top" title="Dagen op rij">
          <Flame size={22} strokeWidth={2.5} fill="currentColor" aria-hidden="true" /> {streak}
        </span>
      </header>

      <main key={index} className="lesson-card stack-m" aria-live="polite">
        <StepDisc kind={card.kind} size={88} />
        <div className={`stack-xs tone-${STEP_LOOK[card.kind].tone}`}>
          <p className="lesson-kind">{KIND_LABEL[card.kind]}</p>
          <h1>{phase === 'ask-info' ? 'Wilden ze informatie?' : card.title}</h1>
          {card.sub && card.kind !== 'call' ? <p className="muted">{card.sub}</p> : null}
        </div>
        <CardBody card={card} phase={phase} />
      </main>

      <footer className={`lesson-foot${feedback ? ` ${feedback.tone}` : ''}`}>
        {feedback ? (
          <div className="lesson-feedback">
            <div className="feedback-head">
              <span className="feedback-mark" aria-hidden="true">
                {feedback.tone === 'good' ? <Check size={28} strokeWidth={3.5} /> : feedback.tone === 'bad' ? <X size={28} strokeWidth={3.5} /> : <Sparkles size={24} strokeWidth={2.5} />}
              </span>
              <strong className="feedback-text">
                {feedback.text}
                {feedback.xp ? ` +${feedback.xp} XP` : ''}
              </strong>
            </div>
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
            credit={() => setActions((a) => a + 1)}
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
      <div className="stack-m">
        <Bubble title="Claude">
          <p>Vroegen ze om informatie? Dan stuurt de cockpit deze mail. Dat mag, want ze vroegen erom. Lees hem even na.</p>
        </Bubble>
        {card.draft ? (
          <div className="card sunken stack-xs">
            <p className="eyebrow">Deze mail gaat dan weg</p>
            <strong className="small">{card.draft.subject}</strong>
            <p className="small prewrap">{card.draft.body}</p>
            {card.draft.followups ? <span className="tiny muted">Met {card.draft.followups} korte opvolgmail{card.draft.followups === 1 ? '' : 's'} als ze niet antwoorden.</span> : null}
          </div>
        ) : (
          <p className="small muted">Er staat nog geen mail klaar; Claude schrijft er een als je ja zegt.</p>
        )}
      </div>
    ) : (
      <div className="stack-m">
        {card.observation ? <ProspectFacts observation={card.observation} website={card.website ?? null} pitch={card.pitch ?? ''} /> : null}
        {card.phone ? (
          <a className="button secondary big lesson-call" href={`tel:${card.phone}`}>
            <Phone size={24} strokeWidth={2.5} aria-hidden="true" /> {card.phone}
          </a>
        ) : (
          <p className="muted">
            Geen nummer gevonden.{' '}
            {card.website ? (
              <a href={card.website} target="_blank" rel="noreferrer noopener">
                Open {hostOf(card.website)}
              </a>
            ) : null}
          </p>
        )}
        {card.why || card.sub ? <p className="tiny muted">{[card.why, card.sub].filter(Boolean).join(' · ')}</p> : null}
      </div>
    )
  if (card.kind === 'prospect') {
    if (phase === 'reasons') return <p>Waarom niet? Dan zoekt Claude beter.</p>
    return (
      <div className="stack-m">
        <ProspectFacts observation={card.p.observation} website={card.p.website} pitch={card.p.pitch} found={{ phone: card.p.hasPhone, email: card.p.hasEmail }} />
      </div>
    )
  }
  if (card.kind === 'post') return <PostBody card={card} />
  if (card.kind === 'build')
    return (
      <Bubble title="Claude">
        {card.work?.length ? (
          <>
            <p className="small muted">Wat je bouwde:</p>
            <ul className="small">
              {card.work.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p>Daar maak ik een post van die laat zien wat het voor je klanten doet. Jij kijkt hem na.</p>
      </Bubble>
    )
  if (card.kind === 'growth')
    return (
      <Bubble title="Waarom">
        {card.why ? <p>{card.why}</p> : null}
        <p className="small muted">{card.task ? 'Claude doet het werk op de achtergrond; het staat straks klaar in Cockpit.' : 'Dit doe je zelf; de knop brengt je erheen.'}</p>
      </Bubble>
    )
  if (card.kind === 'reply')
    return (
      <Bubble title="Waarom">
        <p>{card.why ?? 'Je mailde ze een tijd geleden en hoorde nog niets.'}</p>
        <p className="small muted">Kwam er een antwoord? Dan telt het mee als gesprek, en stoppen de opvolgmails vanzelf.</p>
      </Bubble>
    )
  if (card.kind === 'setup')
    return (
      <div className="stack-m">
        <Bubble title="Waarom">
          <p>{card.why}</p>
          {card.cost ? <p className="small muted">Kosten: {card.cost}</p> : null}
        </Bubble>
        {card.status === 'todo' ? (
          <div className="card sunken stack-xs">
            <p className="eyebrow">Zo doe je het</p>
            <ol className="small setup-how">
              {card.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    )
  if (card.kind === 'money')
    return (
      <div className="stack-m">
        <Bubble title={card.moneyKind === 'plan' ? 'Jouw besluit' : 'Let op'}>
          <p>
            {card.moneyKind === 'cost'
              ? card.late
                ? `Dit verlengde ${card.when}. Houd je het, dan tik je op Houden; wil je het niet meer, zeg het dan op.`
                : `Dit verlengt ${card.when}. Wil je het houden, dan hoef je niets te doen; anders zeg je het nu op.`
              : card.moneyKind === 'plan'
                ? card.late
                  ? `Je wilde hier ${card.when} over beslissen. Ja of nee: dan weet je coach waar hij mee rekent.`
                  : `Je wilt hier ${card.when} over beslissen. Ja of nee: dan weet je coach waar hij mee rekent.`
                : card.late
                  ? `Dit had ${card.when} geregeld moeten zijn. Gedaan? Vink het af.`
                  : `Dit moet ${card.when} geregeld zijn.`}
          </p>
          <p className="small muted">Bedrag: {card.amount}</p>
        </Bubble>
        {card.note ? <p className="small muted">{card.note}</p> : null}
        <p className="tiny muted">Betalen doe je zelf; Cockpit rekent en herinnert alleen.</p>
      </div>
    )
  if (card.kind === 'seen')
    return (
      <Bubble title="Waarom">
        <p>Steeds meer mensen krijgen hun antwoord van Google of ChatGPT zonder door te klikken. Kijk één keer per maand of jij genoemd wordt bij wat je klanten echt vragen.</p>
        <p className="small muted">Open elke vraag, kijk of {card.sub} in het antwoord staat, en tik op Genoemd.</p>
      </Bubble>
    )
  if (card.kind === 'give')
    return (
      <div className="stack-m">
        <Bubble title="Claude">
          <p>Geef iets weg: beantwoord één vraag of deel één tip. Geen link, geen reclame. Zo leren mensen je kennen.</p>
          {card.how ? <p className="small muted">{card.how}</p> : null}
        </Bubble>
        <a className="button secondary" href={card.url} target="_blank" rel="noreferrer noopener nofollow" style={{ width: 'fit-content' }}>
          Open {hostOf(card.url)} <ExternalLink size={16} strokeWidth={2.5} aria-hidden="true" />
        </a>
      </div>
    )
  return null
}

function PostBody({ card }: { card: Extract<LessonCard, { kind: 'post' }> }) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const share = shareUrl(card.platform, card.text)
  const open = share ?? card.profile ?? PLATFORM_HOME[card.platform] ?? null
  return (
    <div className="stack-s">
      {card.value ? (
        <p className="small">
          <strong>Waarom deze post:</strong> {card.value}
          {card.proof ? <span className="muted"> · Echt van jou: {card.proof}</span> : null}
        </p>
      ) : null}
      <PostImage hook={card.hook} project={card.projectName} color={card.color} onSaved={() => setSaved(true)} />
      <ol className="lesson-checklist">
        <li className={saved ? 'done' : ''}>
          <span className="step-no">{saved ? <Check size={16} strokeWidth={3.5} /> : 1}</span>
          Bewaar het beeld
        </li>
        <li className={copied ? 'done' : ''}>
          <span className="step-no">{copied ? <Check size={16} strokeWidth={3.5} /> : 2}</span>
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
          <span className="step-no">3</span>
          {card.platform === 'instagram' ? (
            <a className="button secondary small" href={META_PLANNER} target="_blank" rel="noreferrer noopener">
              Inplannen in Meta
            </a>
          ) : null}
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
  const [named, setNamed] = useState<number[]>([])
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
                const r = await prospectWantsInfo(card.contactId!, email, card.draft?.id ?? null)
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
          <Check size={20} strokeWidth={3} aria-hidden="true" /> Gebeld
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
            {NO_REASONS.map((r) => (
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
          {YES_VERB[card.p.channel] ?? YES_VERB.call}
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

  if (card.kind === 'seen')
    return (
      <div className="lesson-actions">
        <ul className="seen-list">
          {card.questions.map((q, i) => {
            const links = searchLinks(q)
            const on = named.includes(i)
            return (
              <li key={q} className={on ? 'on' : ''}>
                <p className="small">
                  <strong>{q}</strong>
                </p>
                <div className="row" style={{ gap: '0.4rem' }}>
                  <a className="button ghost small" href={links.google} target="_blank" rel="noreferrer noopener">
                    Google
                  </a>
                  <a className="button ghost small" href={links.chatgpt} target="_blank" rel="noreferrer noopener">
                    ChatGPT
                  </a>
                  <a className="button ghost small" href={links.perplexity} target="_blank" rel="noreferrer noopener">
                    Perplexity
                  </a>
                  <button type="button" className={`button small ${on ? 'primary' : 'secondary'}`} aria-pressed={on} onClick={() => setNamed((n) => (on ? n.filter((x) => x !== i) : [...n, i]))}>
                    {on ? (
                      <>
                        <Check size={16} strokeWidth={3} aria-hidden="true" /> Genoemd
                      </>
                    ) : (
                      'Genoemd?'
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className={big}
          disabled={pending || !card.projectId}
          onClick={() =>
            run(async () => {
              const r = await saveSeen(card.projectId!, card.month, card.questions.length, named.length)
              return { tone: r.ok ? 'good' : 'bad', text: r.message, xp: r.xp }
            })
          }
        >
          Klaar, bewaar
        </button>
      </div>
    )

  if (card.kind === 'setup')
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending || !card.projectId}
          onClick={() =>
            run(async () => {
              const r = await setSetupStatus(card.projectId!, card.setupKey, 'done')
              return { tone: r.ok ? 'good' : 'bad', text: r.ok ? 'Geregeld!' : 'Dat lukte niet.', xp: r.xp }
            })
          }
        >
          {card.status === 'unknown' ? (
            'Ja, geregeld'
          ) : (
            <>
              <Check size={20} strokeWidth={3} aria-hidden="true" /> Gedaan
            </>
          )}
        </button>
        <div className="row">
          {card.status === 'unknown' ? (
            <button
              type="button"
              className={second}
              disabled={pending || !card.projectId}
              onClick={() =>
                run(async () => {
                  await setSetupStatus(card.projectId!, card.setupKey, 'todo')
                  return { tone: 'neutral', text: 'Genoteerd: dat komt in je stappen.', xp: 0 }
                })
              }
            >
              Nog niet
            </button>
          ) : (
            <button type="button" className={second} onClick={() => later()}>
              Later
            </button>
          )}
          <button
            type="button"
            className="button ghost big"
            disabled={pending || !card.projectId}
            onClick={() =>
              run(async () => {
                await setSetupStatus(card.projectId!, card.setupKey, 'na')
                return { tone: 'neutral', text: 'Niet nodig: weg van je lijst.', xp: 0 }
              })
            }
          >
            Niet nodig
          </button>
        </div>
      </div>
    )

  if (card.kind === 'give')
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await gaveValue(card.itemId)
              return { tone: 'good', text: 'Mooi: zo bouw je vertrouwen op.', xp: r.xp }
            })
          }
        >
          <Check size={20} strokeWidth={3} aria-hidden="true" /> Gedaan
        </button>
        <button type="button" className={second} onClick={() => later()}>
          Later
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
          <Check size={20} strokeWidth={3} aria-hidden="true" /> Gepost
        </button>
        <button type="button" className={second} onClick={() => later()}>
          Later
        </button>
      </div>
    )

  if (card.kind === 'money')
    return (
      <div className="lesson-actions">
        <button
          type="button"
          className={big}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await moneyStep(card.itemId, card.moneyKind === 'plan' ? 'yes' : 'done')
              return { tone: r.ok ? 'good' : 'bad', text: r.message, xp: r.xp }
            })
          }
        >
          {card.moneyKind === 'plan' ? (
            'Ja, doen'
          ) : (
            <>
              <Check size={20} strokeWidth={3} aria-hidden="true" /> {card.moneyKind === 'cost' ? 'Houden' : 'Geregeld'}
            </>
          )}
        </button>
        <div className="row">
          {card.moneyKind !== 'deadline' ? (
            <button
              type="button"
              className={second}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await moneyStep(card.itemId, 'stop')
                  return { tone: r.ok ? 'neutral' : 'bad', text: r.message, xp: 0 }
                })
              }
            >
              {card.moneyKind === 'cost' ? 'Opzeggen' : 'Nee'}
            </button>
          ) : null}
          <button type="button" className={card.moneyKind === 'deadline' ? second : 'button ghost big'} onClick={() => later()}>
            Later
          </button>
        </div>
      </div>
    )

  // A growth step without a task for Claude is something he does himself on another page.
  if (card.kind === 'growth' && !card.task)
    return (
      <div className="lesson-actions">
        <Link href={card.href} className={big}>
          Ga ernaartoe
        </Link>
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
                : await runInBackground(card.task!, card.projectId!, card.options ?? {})
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
