import { Logo } from './Logo'

/** Claude speaks: its badge and a speech bubble. */
export function Bubble({ title, children, small = false }: { title: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div className="bubble-row">
      <span className="bubble-who" aria-hidden="true">
        <Logo />
      </span>
      <div className={`bubble${small ? ' small' : ''}`}>
        <p className="bubble-title">{title}</p>
        {children}
      </div>
    </div>
  )
}
