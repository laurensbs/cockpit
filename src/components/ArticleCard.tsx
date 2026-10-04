import { ContentActions } from './ContentActions'
import { CopyButton } from './CopyButton'
import { DoneToggle } from './DoneToggle'

export interface ArticleView {
  id: string
  title: string
  slug: string
  metaDescription: string
  keywords: string[]
  outline: string[]
  markdown: string
  status: string
  rating: number
}

/** An article for his site: the full text as markdown when Claude wrote it, otherwise the outline to write from. */
export function ArticleCard({ article }: { article: ArticleView }) {
  const full = Boolean(article.markdown)
  return (
    <article className="card stack-s draft">
      <div className="row between">
        <span className="row" style={{ gap: '0.35rem' }}>
          <span className="chip accent">{full ? 'Artikel' : 'Opzet'}</span>
          <span className="chip">/{article.slug}</span>
        </span>
      </div>
      <p className="draft-subject">{article.title}</p>
      <p className="small muted">{article.metaDescription}</p>
      {article.keywords.length ? (
        <div className="row" style={{ gap: '0.35rem' }}>
          {article.keywords.map((k) => (
            <span key={k} className="chip">
              {k}
            </span>
          ))}
        </div>
      ) : null}
      {full ? (
        <details>
          <summary className="tiny">Lees het artikel ({article.markdown.split(/\s+/).length} woorden)</summary>
          <pre className="codeblock" style={{ marginTop: '0.5rem', maxHeight: '24rem', overflow: 'auto' }}>
            {article.markdown}
          </pre>
        </details>
      ) : (
        <ol className="small stack-xs">
          {article.outline.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      )}
      <div className="row between">
        <div className="row">
          {full ? <CopyButton text={article.markdown} label="Kopieer markdown" /> : <CopyButton text={[article.title, ...article.outline.map((h) => `## ${h}`)].join('\n\n')} label="Kopieer opzet" />}
          <CopyButton text={article.metaDescription} label="Kopieer meta" />
          <DoneToggle id={article.id} done={article.status === 'done'} label="Gepubliceerd" />
        </div>
        <ContentActions id={article.id} rating={article.rating} archived={article.status === 'archived'} />
      </div>
    </article>
  )
}
