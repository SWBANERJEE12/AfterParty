import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  roomId?: string
  onRetry?: () => void
}

type State = { error: Error | null }

export class RoomRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[afterparty] Room route error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const message = error.message || 'Something went wrong loading this room.'
    return (
      <div className="afterparty-gradient flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">Could not load the room</h1>
        <p className="max-w-md text-sm text-red-200/90">{message}</p>
        {this.props.roomId && (
          <p className="font-mono text-xs text-[var(--color-muted)]">Room: {this.props.roomId}</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
            onClick={() => {
              this.setState({ error: null })
              this.props.onRetry?.()
            }}
          >
            Retry
          </button>
          <a
            href="/party"
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
          >
            Back to watch party
          </a>
        </div>
      </div>
    )
  }
}
