import { useTheme } from '../theme/ThemeProvider'

export function ThemeToggle() {
  const { mode, setMode } = useTheme()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-[10px]">
      {(['light', 'dark', 'system'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`rounded-md px-2 py-1 capitalize transition ${
            mode === m
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
