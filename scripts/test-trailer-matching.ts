/**
 * Offline scoring checks for trailer title/year matching (no YouTube API calls).
 * Run: npx tsx scripts/test-trailer-matching.ts
 */
import {
  MIN_ACCEPT_SCORE,
  movieYearDigits,
  rankCandidates,
  scoreCandidate,
} from '../server/youtubeTrailer.ts'

let failed = 0

function assert(name: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL: ${name}`)
    failed++
  } else {
    console.log(`ok: ${name}`)
  }
}

const shawshank2019 = scoreCandidate(
  'The Shawshank Redemption',
  '1994',
  {
    title: 'The Shawshank Redemption (1994) Official Trailer',
    description: 'Classic drama',
    channelTitle: 'Warner Bros.',
  },
)

const shawshankWrong = scoreCandidate(
  'The Shawshank Redemption',
  '1994',
  {
    title: 'The Shawshank Redemption 2019 Official Trailer',
    description: '',
    channelTitle: 'Fan Channel',
  },
)

assert('1994 trailer scores acceptably', shawshank2019 >= MIN_ACCEPT_SCORE)
assert('2019 trailer in title penalized vs 1994 film', shawshankWrong < shawshank2019)

const dune2021 = scoreCandidate('Dune', '2021', {
  title: 'Dune (2021) Official Main Trailer',
  description: 'Warner Bros',
  channelTitle: 'Warner Bros. Pictures',
})

const dune1984 = scoreCandidate('Dune', '2021', {
  title: 'Dune (1984) Official Trailer',
  description: '',
  channelTitle: 'Universal Pictures',
})

assert('Dune 2021 prefers 2021 trailer', dune2021 > dune1984)

const ranked = rankCandidates('Inception', '2010', [
  {
    id: { videoId: 'good' },
    snippet: {
      title: 'Inception (2010) Official Trailer',
      description: 'Christopher Nolan',
      channelTitle: 'Warner Bros. Pictures',
    },
  },
  {
    id: { videoId: 'bad' },
    snippet: {
      title: 'Inception Ending Explained',
      description: '',
      channelTitle: 'Reviewer',
    },
  },
])

assert('Ranked list prefers official trailer', ranked[0]?.videoId === 'good')

const noMatch = rankCandidates('Obscure Fake Title XYZ', '2099', [
  {
    id: { videoId: 'x' },
    snippet: {
      title: 'Random vlog',
      description: 'hello',
      channelTitle: 'Someone',
    },
  },
])

assert('No suitable trailer yields empty rank', noMatch.length === 0)
assert('movieYearDigits parses range', movieYearDigits('2010–2012') === '2010')

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll trailer matching assertions passed.')
