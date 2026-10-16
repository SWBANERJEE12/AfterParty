export const TRAILER_UNAVAILABLE = 'Trailer unavailable'

export function trailerUserMessage(detail?: string | null): string {
  const d = detail?.trim()
  if (!d) return TRAILER_UNAVAILABLE
  if (d.toLowerCase().startsWith('trailer unavailable')) return d
  return `${TRAILER_UNAVAILABLE}. ${d}`
}
