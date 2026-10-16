export function PrivacyPolicyPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl glass-panel rounded-xl p-6 text-sm text-[var(--color-muted)]">
      <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Privacy Policy (draft)</h1>
      <p>Afterparty stores account data in Supabase Auth and profiles (username, display name, avatar, preferences).</p>
      <p>Watch-party rooms may store nicknames, member keys, chat messages, and movie proposals while rooms exist.</p>
      <p>My List and watch history are tied to your account when migration 010 is applied.</p>
      <p>Voice chat uses peer-to-peer WebRTC audio; signaling uses Supabase Realtime.</p>
      <p>You provide video URLs or uploads you are authorised to share; we do not supply licensed streams.</p>
      <p>Contact your project operator for data deletion requests. This is not legal advice.</p>
    </article>
  )
}

export function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl glass-panel rounded-xl p-6 text-sm text-[var(--color-muted)]">
      <h1 className="text-2xl font-semibold text-[var(--color-fg)]">Terms of Use (draft)</h1>
      <p>Use Afterparty responsibly. Do not share unlawful content or harass others.</p>
      <p>Accounts are username/password via Supabase; you are responsible for credential security.</p>
      <p>Room access is via private links; do not attempt to access rooms you are not invited to.</p>
      <p>Service may change; features depend on configured Supabase, OMDb, and WebRTC network paths.</p>
    </article>
  )
}

export function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl glass-panel rounded-xl p-6 text-sm text-[var(--color-muted)]">
      <h1 className="text-xl font-semibold text-[var(--color-fg)]">Help & About</h1>
      <p className="mt-2">Afterparty — watch parties with discovery, friends, and chat.</p>
      <p className="mt-2">Configure Supabase (.env.local), run SQL migrations 001–010, OMDB_API_KEY on Express.</p>
      <p className="mt-2">Guests can use /party/join without an account. Signed-in users get home, list, and history.</p>
    </div>
  )
}
