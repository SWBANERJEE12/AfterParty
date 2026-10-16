/**
 * Vote pass/fail rules (mirrors finalize_room_vote_poll logic).
 * Run: npm run test:vote-rules
 */
let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

function result(up: number, down: number): 'passed' | 'failed' {
  return up > 0 && up > down ? 'passed' : 'failed'
}

ok('passes with more up', result(3, 1) === 'passed')
ok('fails on tie', result(2, 2) === 'failed')
ok('fails with no up', result(0, 2) === 'failed')
ok('fails down wins', result(1, 4) === 'failed')

if (failed) process.exit(1)
console.log('\nAll vote rule unit tests passed.')
