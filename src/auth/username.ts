const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const AUTH_EMAIL_DOMAIN = '@auth.afterparty.local'

/** Maps unique username to Supabase Auth email (not shown to users). */
export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}${AUTH_EMAIL_DOMAIN}`
}

export function validateUsername(username: string): string | null {
  const u = username.trim()
  if (!USERNAME_RE.test(u)) {
    return 'Username must be 3–20 characters: letters, numbers, underscore.'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}
