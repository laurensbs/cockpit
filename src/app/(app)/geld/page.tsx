import { eq } from 'drizzle-orm'
import { MoneyAsk, MoneyForm, MoneyRow } from '@/components/Money'
import { GrowthCosts } from '@/components/GrowthCosts'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { costSummary } from '@/lib/costs'
import { dayOf, monthStart } from '@/lib/dates'
import { type MoneyItem, moneyPicture, perMonth, upcoming } from '@/lib/finance'
import { moneyFor } from '@/lib/money'
import { formatEuro } from '@/lib/time'
import { latestMrr, loadMoney } from '@/server/finance'
import { metricsSince } from '@/server/queries'
import { requireOwner } from '@/server/session'
import { loadSetup } from '@/server/setup-check'

export const metadata = { title: 'Geld' }

/** Lines per project, the business as a whole first. */
function byProject(items: MoneyItem[]): { name: string; items: MoneyItem[] }[] {
  const groups = new Map<string, MoneyItem[]>()
  for (const i of items) groups.set(i.project ?? '', [...(groups.get(i.project ?? '') ?? []), i])
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).map(([name, list]) => ({ name: name || 'Je bedrijf', items: list }))
}

/**
 * Everything about money in one place: what he pays, what comes in, his prices, what is coming (a renewal,
 * a tax date, a decision) and what growing still costs. Claude fills it from his documents; he corrects it.
 * Paying is always his: the cockpit adds up and reminds.
 */
export default async function MoneyPage() {
  const owner = await requireOwner('/geld')
  const db = await getDb()
  const today = dayOf(new Date())
  const projects = await db.select().from(s.project).where(eq(s.project.ownerId, owner.userId))
  const [items, mrr, metrics] = await Promise.all([loadMoney(db, owner.userId), latestMrr(db, owner.userId, today), metricsSince(db, owner.userId, monthStart(today))])
  const picture = moneyPicture(items, mrr)
  const revenue = moneyFor(Object.values(metrics), monthStart(today))
  const soon = upcoming(items, today, 30)
  const soonIds = new Set(soon.map((i) => i.id))
  // Decisions with an amount first, the biggest on top; the rest one tap away.
  const plans = items
    .filter((i) => i.kind === 'plan' && i.status === 'proposed' && !soonIds.has(i.id))
    .sort((a, b) => (b.amount == null ? -1 : perMonth({ ...b, period: b.period === 'once' ? 'month' : b.period })) - (a.amount == null ? -1 : perMonth({ ...a, period: a.period === 'once' ? 'month' : a.period })))
  const costs = items.filter((i) => i.kind === 'cost' && i.status === 'active' && i.period !== 'once')
  const bought = items.filter((i) => i.kind === 'cost' && i.status === 'active' && i.period === 'once')
  const income = items.filter((i) => i.kind === 'income' && i.status === 'active')
  const prices = items.filter((i) => i.kind === 'price' && i.status === 'active')
  const dates = items.filter((i) => i.kind === 'deadline' && i.status === 'active' && !soonIds.has(i.id))
  const stopped = items.filter((i) => i.status === 'stopped')
  const list = projects.map((p) => ({ id: p.id, name: p.name }))
  const marketing = projects.filter((p) => !/marketing staat uit/i.test(`${p.what} ${p.redLines}`))
  const growth = costSummary(
    await Promise.all(marketing.map(async (p) => ({ name: p.name, open: (await loadSetup(db, p)).filter((v) => v.status !== 'done').map((v) => ({ title: v.item.title, cost: v.item.cost })) }))),
  )
  const idOf = (name: string) => marketing.find((p) => p.name === name)?.id
  const stamp = `${items.length}:${items[0]?.id ?? ''}`

  return (
    <div className="stack-l">
      <header className="stack-xs">
        <h1>Geld</h1>
        <p className="lede">Wat je betaalt, wat binnenkomt en wat eraan komt. Betalen doe jij; Cockpit rekent en herinnert.</p>
      </header>

      <section className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} aria-label="Je geld per maand">
        <div className="kpi card">
          <span className="eyebrow">Vaste lasten</span>
          <span className="value">{formatEuro(picture.costsPerMonth)}</span>
          <span className="tiny muted">{picture.unknownCosts ? `per maand, plus ${picture.unknownCosts} zonder bedrag` : 'per maand'}</span>
        </div>
        <div className="kpi card">
          <span className="eyebrow">Komt binnen</span>
          <span className="value">{formatEuro(picture.incomePerMonth)}</span>
          <span className="tiny muted">{revenue.known ? `per maand · omzet deze maand ${formatEuro(revenue.revenue)}` : picture.incomePerMonth > 0 ? 'per maand' : 'nog niets: je eerste klant telt'}</span>
        </div>
        <div className="kpi card">
          <span className="eyebrow">Quitte bij</span>
          <span className="value">{picture.breakEven ? `${picture.breakEven.customers} ${picture.breakEven.customers === 1 ? 'klant' : 'klanten'}` : '–'}</span>
          <span className="tiny muted">{picture.breakEven ? `à ${formatEuro(picture.breakEven.price)} per maand (${picture.breakEven.title})` : 'zet je prijs per maand erin'}</span>
        </div>
      </section>

      {!items.length ? (
        <section className="card stack-s">
          <h2>Nog niets over geld</h2>
          <p className="small">Claude leest je eigen documenten (STAND, CLAUDE en de rest in je projectmappen) en zet erin wat je betaalt, je prijzen en de data om op te letten. Alleen wat er staat; een onbekend bedrag blijft leeg.</p>
          <MoneyAsk count={0} stamp={stamp} />
        </section>
      ) : null}

      {soon.length ? (
        <section className="card stack-m" aria-labelledby="money-soon">
          <h2 id="money-soon">Komt eraan</h2>
          <ul className="setup-list">
            {soon.map((i) => (
              <MoneyRow key={i.id} item={i} today={today} projects={list} act />
            ))}
          </ul>
        </section>
      ) : null}

      {plans.length ? (
        <section className="card stack-m" aria-labelledby="money-plans">
          <div className="stack-xs">
            <h2 id="money-plans">Wacht op jouw besluit</h2>
            <p className="small muted">Uitgaven die nog niet gedaan zijn. Ja of nee, dan rekent je coach ermee.</p>
          </div>
          <ul className="setup-list">
            {plans.slice(0, 5).map((i) => (
              <MoneyRow key={i.id} item={i} today={today} projects={list} act />
            ))}
          </ul>
          {plans.length > 5 ? (
            <details>
              <summary className="small">Nog {plans.length - 5} voorstellen</summary>
              <ul className="setup-list">
                {plans.slice(5).map((i) => (
                  <MoneyRow key={i.id} item={i} today={today} projects={list} act />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {costs.length || bought.length ? (
        <section className="card stack-m" aria-labelledby="money-costs">
          <h2 id="money-costs">Wat je nu betaalt</h2>
          {byProject(costs).map((g) => (
            <div key={g.name} className="stack-xs">
              <p className="eyebrow">{g.name}</p>
              <ul className="setup-list">
                {g.items.map((i) => (
                  <MoneyRow key={i.id} item={i} today={today} projects={list} />
                ))}
              </ul>
            </div>
          ))}
          {bought.length ? (
            <details>
              <summary className="small">Eenmalig gekocht ({bought.length})</summary>
              <ul className="setup-list">
                {bought.map((i) => (
                  <MoneyRow key={i.id} item={i} today={today} projects={list} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {income.length || prices.length ? (
        <section className="card stack-m" aria-labelledby="money-income">
          <h2 id="money-income">Wat binnenkomt</h2>
          {income.length ? (
            <ul className="setup-list">
              {income.map((i) => (
                <MoneyRow key={i.id} item={i} today={today} projects={list} />
              ))}
            </ul>
          ) : (
            <p className="small muted">Nog niets. Je eerste klant telt.</p>
          )}
          {prices.length ? (
            <details>
              <summary className="small">Je prijzen ({prices.length})</summary>
              {byProject(prices).map((g) => (
                <div key={g.name} className="stack-xs" style={{ marginTop: '0.5rem' }}>
                  <p className="eyebrow">{g.name}</p>
                  <ul className="setup-list">
                    {g.items.map((i) => (
                      <MoneyRow key={i.id} item={i} today={today} projects={list} />
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          ) : null}
        </section>
      ) : null}

      {dates.length ? (
        <section className="card stack-m" aria-labelledby="money-dates">
          <h2 id="money-dates">Data om op te letten</h2>
          <ul className="setup-list">
            {dates.map((i) => (
              <MoneyRow key={i.id} item={i} today={today} projects={list} />
            ))}
          </ul>
        </section>
      ) : null}

      <GrowthCosts summary={growth} idOf={idOf} />

      <details className="card more">
        <summary>Zelf iets toevoegen{stopped.length ? `, of wat gestopt is (${stopped.length})` : ''}</summary>
        <div className="stack-m" style={{ marginTop: '0.75rem' }}>
          <MoneyForm projects={list} />
          {stopped.length ? (
            <div className="stack-xs">
              <p className="eyebrow">Gestopt</p>
              <ul className="setup-list">
                {stopped.map((i) => (
                  <MoneyRow key={i.id} item={i} today={today} projects={list} />
                ))}
              </ul>
            </div>
          ) : null}
          {items.length ? <MoneyAsk count={items.length} stamp={stamp} /> : null}
        </div>
      </details>

      <p className="tiny muted">
        Dollars omgerekend tegen ± 0,92. Prijzen van de officiële pagina&apos;s, gecontroleerd op 5 okt 2026 (Apple, Google Play, Trustpilot en Stripe). Belasting en btw: vraag je boekhouder.
      </p>
    </div>
  )
}
