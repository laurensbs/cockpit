/** Shown at once while a page loads, so a tap always answers right away. */
export default function Loading() {
  return (
    <div className="stack-l" aria-busy="true" aria-label="Laden">
      <div className="skeleton" style={{ height: 150 }} />
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  )
}
