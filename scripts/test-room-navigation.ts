import assert from 'node:assert/strict'
import {
  isRoomRoute,
  shouldAutoMinimizeRoom,
  shouldShowFullRoomPlayer,
} from '../src/room/roomNavigation.ts'

assert.equal(isRoomRoute('/room/abc123'), true)
assert.equal(isRoomRoute('/discover'), false)

assert.equal(shouldAutoMinimizeRoom('room1', '/discover', 'full'), true)
assert.equal(shouldAutoMinimizeRoom('room1', '/room/abc', 'full'), false)
assert.equal(shouldAutoMinimizeRoom('room1', '/discover', 'minimized'), false)

assert.equal(shouldShowFullRoomPlayer('room1', '/room/abc', 'full'), true)
assert.equal(shouldShowFullRoomPlayer('room1', '/discover', 'full'), false)
assert.equal(shouldShowFullRoomPlayer('room1', '/discover', 'minimized'), false)

console.log('All room navigation unit tests passed.')
