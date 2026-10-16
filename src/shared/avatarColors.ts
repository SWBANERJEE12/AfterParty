/** Distinct cozy palette — one per room slot (max 4). */
export const AVATAR_COLORS = ['#7c6bff', '#ff6b9d', '#3dd6c3', '#ffb347'] as const

export function colorForSlot(slot: number): string {
  return AVATAR_COLORS[Math.max(0, Math.min(AVATAR_COLORS.length - 1, slot))]!
}

export function accentForColor(main: string): string {
  const accents: Record<string, string> = {
    '#7c6bff': '#c4b8ff',
    '#ff6b9d': '#ffc4d6',
    '#3dd6c3': '#b8fff2',
    '#ffb347': '#ffe4b8',
  }
  return accents[main] ?? '#e8e0ff'
}
