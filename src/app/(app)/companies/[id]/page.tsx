import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CompanyForm } from '@/components/CompanyForm'
import { ConfirmButton } from '@/components/ConfirmButton'
import { MetricForm } from '@/components/MetricForm'
import { ProjectCard } from '@/components/ProjectCard'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { addMonths, dayOf, monthLabel, monthStart } from '@/lib/dates'
import { moneyFor } from '@/lib/money'
import { formatEuro } from '@/lib/time'
import { deleteCompany } from '@/server/actions/companies'
import { metricsSince, projectSummaries } from '@/server/queries'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Bedrijf' }

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/companies/${id}`)
  const db = await getDb()
  const [company] = await db
    .select()
    .from(s.company)
    .where(and(eq(s.company.id, id), eq(s.company.ownerId, owner.userId)))
  if (!company) notFound()
  const today = dayOf(new Date())
  const month = monthStart(today)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5))
  const projects = (await projectSummaries(db, owner.userId)).filter((p) => p.companyId === id)
  const metrics = await metricsSince(
    db,
    owner.userId,
    months[0],
    projects.map((p) => p.id),
  )
  const tables = projects.map((p) => metrics[p.id])
  const rows = months.map((m) => ({ month: m, ...moneyFor(tables, m) }))

  return (
    <div className="stack-l">
      <header className="stack-s">
        <Link href="/companies" className="button ghost small" style={{ alignSelf: 'start' }}>
          ← Bedrijven
        </Link>
        <h1 className="row">
          <span className="dot" style={{ background: company.color, width: 14, height: 14 }} /> {company.name}
        </h1>
      </header>

      <section className="stack-m">
        <h2>Projecten</h2>
        {projects.length ? (
          <div className="grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} today={today} />
            ))}
          </div>
        ) : (
          <p className="empty">
            Nog geen projecten. <Link href="/projects/new">Project toevoegen</Link>
          </p>
        )}
      </section>

      <section className="card stack-m">
        <h2>Laatste 6 maanden</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Maand</th>
                <th>Omzet</th>
                <th>Kosten</th>
                <th>Winst</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <th>{monthLabel(r.month)}</th>
                  <td className="num">{r.known ? formatEuro(r.revenue) : '–'}</td>
                  <td className="num">{r.known ? formatEuro(r.costs) : '–'}</td>
                  <td className="num" style={{ color: r.known ? (r.profit >= 0 ? 'var(--good)' : 'var(--bad)') : undefined }}>
                    {r.known ? formatEuro(r.profit) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <MetricForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} month={month.slice(0, 7)} />
      </section>

      <section className="card stack-m">
        <h2>Gegevens</h2>
        <CompanyForm values={company} />
      </section>

      <section className="card flat stack-s">
        <h2>Verwijderen</h2>
        <p className="muted small">De projecten blijven bestaan, zonder bedrijf.</p>
        <ConfirmButton action={deleteCompany.bind(null, id)} label="Bedrijf verwijderen" confirm="Zeker weten?" />
      </section>
    </div>
  )
}
