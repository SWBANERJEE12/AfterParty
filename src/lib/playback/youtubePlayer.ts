export type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  setPlaybackRate: (rate: number) => void
  destroy: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId?: string
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (e: { target: YTPlayer }) => void
            onStateChange?: (e: { data: number; target: YTPlayer }) => void
            onError?: (e: { data: number }) => void
          }
        },
      ) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

export function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

export function createYoutubePlayer(
  container: HTMLElement,
  videoId: string,
  events: {
    onReady?: (player: YTPlayer) => void
    onStateChange?: (state: number, player: YTPlayer) => void
    onError?: (code: number) => void
  },
): Promise<YTPlayer> {
  return loadYouTubeIframeApi().then(
    () =>
      new Promise((resolve, reject) => {
        try {
          const player = new window.YT!.Player(container, {
            videoId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (e) => {
                events.onReady?.(e.target)
                resolve(e.target)
              },
              onStateChange: (e) => events.onStateChange?.(e.data, e.target),
              onError: (e) => {
                events.onError?.(e.data)
                reject(new Error(`YouTube player error ${e.data}`))
              },
            },
          })
          void player
        } catch (err) {
          reject(err)
        }
      }),
  )
}
