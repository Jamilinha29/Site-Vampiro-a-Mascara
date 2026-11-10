export function PageLoader() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-on-surface-variant"
      role="status"
      aria-live="polite"
    >
      <span className="material-symbols-outlined animate-pulse text-3xl text-secondary">
        hourglass_empty
      </span>
      <p className="font-label-sm text-xs uppercase tracking-widest">Evocando o grimório…</p>
    </div>
  )
}
