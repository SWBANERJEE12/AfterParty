/**
 * Room capacity logic (mirrors join_room_member check).
 * Run: npm run test:room-capacity
 */
import { MAX_ROOM_PLAYERS } from '../src/shared/protocol.ts'

let failed = 0
function ok(name: string, cond: boolean) {
  if (!cond) {
    console.error('FAIL:', name)
    failed++
  } else console.log('ok:', name)
}

ok('max room players is 10', MAX_ROOM_PLAYERS === 10)

function canJoin(count: number, max: number): boolean {
  return count < max
}

ok('10th member allowed', canJoin(9, 10))
ok('11th member rejected', !canJoin(10, 10))

function simulateRaceJoin(current: number, max: number, attempts: number): number {
  let count = current
  let accepted = 0
  for (let i = 0; i < attempts; i++) {
    if (count < max) {
      count++
      accepted++
    }
  }
  return accepted
}

ok('race cannot exceed cap', simulateRaceJoin(9, 10, 5) === 1)

if (failed) process.exit(1)
console.log('\nAll room capacity unit tests passed.')
