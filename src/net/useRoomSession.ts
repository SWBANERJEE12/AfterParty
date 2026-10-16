import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { EMPTY_VOTE_STATE, type MovieMeta, type VoteState } from '../shared/movies'
import type {
  ClientToServerEvents,
  JoinedRoomPayload,
  RoomErrorCode,
  ServerToClientEvents,
  WorldLocation,
} from '../shared/protocol'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

type Session = JoinedRoomPayload & {
  connected: boolean
}

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  ROOM_FULL: 'This room already has 10 players.',
  ROOM_NOT_FOUND: 'Room not found. Check the code.',
  INVALID_CODE: 'Enter a 4-character room code.',
  NAME_REQUIRED: 'Please enter a display name.',
  SHORTLIST_FULL: 'Shortlist is full (5 movies max).',
}

export function useRoomSession() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(
    null,
  )
  const [session, setSession] = useState<Session | null>(null)
  const [vote, setVote] = useState<VoteState>(EMPTY_VOTE_STATE)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSession((prev) => (prev ? { ...prev, connected: true } : prev))
    })
    socket.on('disconnect', () => {
      setSession((prev) => (prev ? { ...prev, connected: false } : prev))
    })

    socket.on('roomPlayers', (players) => {
      setSession((prev) => (prev ? { ...prev, players } : prev))
    })

    socket.on('playerJoined', (player) => {
      setSession((prev) => {
        if (!prev) return prev
        if (prev.players.some((p) => p.id === player.id)) return prev
        return { ...prev, players: [...prev.players, player] }
      })
    })

    socket.on('playerLeft', (playerId) => {
      setSession((prev) =>
        prev
          ? { ...prev, players: prev.players.filter((p) => p.id !== playerId) }
          : prev,
      )
    })

    socket.on('playerMotion', (motion) => {
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === motion.id
              ? {
                  ...p,
                  x: motion.x,
                  z: motion.z,
                  yaw: motion.yaw,
                  moving: motion.moving,
                  location: motion.location,
                }
              : p,
          ),
        }
      })
    })

    socket.on('voteState', (state) => {
      setVote(state)
      setSession((prev) => (prev ? { ...prev, vote: state } : prev))
    })

    return socket
  }, [])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  const createRoom = useCallback(
    (name: string) => {
      setError(null)
      setConnecting(true)
      const socket = ensureSocket()
      socket.emit('createRoom', name, (res) => {
        setConnecting(false)
        if ('error' in res) {
          setError(ERROR_MESSAGES[res.error])
          return
        }
        setVote(res.vote)
        setSession({ ...res, connected: socket.connected })
      })
    },
    [ensureSocket],
  )

  const joinRoom = useCallback(
    (code: string, name: string) => {
      setError(null)
      setConnecting(true)
      const socket = ensureSocket()
      socket.emit('joinRoom', { code, name }, (res) => {
        setConnecting(false)
        if ('error' in res) {
          setError(ERROR_MESSAGES[res.error])
          return
        }
        setVote(res.vote)
        setSession({ ...res, connected: socket.connected })
      })
    },
    [ensureSocket],
  )

  const sendMotion = useCallback(
    (state: {
      x: number
      z: number
      yaw: number
      moving: boolean
      location: WorldLocation
    }) => {
      socketRef.current?.emit('playerState', state)
    },
    [],
  )

  const travel = useCallback((to: WorldLocation, from: WorldLocation) => {
    socketRef.current?.emit('travel', { to, from })
  }, [])

  const addToShortlist = useCallback((movie: MovieMeta) => {
    socketRef.current?.emit('shortlistAdd', movie, (res) => {
      if ('error' in res) setError(ERROR_MESSAGES[res.error])
    })
  }, [])

  const removeFromShortlist = useCallback((movieId: number) => {
    socketRef.current?.emit('shortlistRemove', movieId)
  }, [])

  const castVote = useCallback((movieId: number) => {
    socketRef.current?.emit('castVote', movieId)
  }, [])

  return {
    session,
    vote,
    error,
    connecting,
    createRoom,
    joinRoom,
    sendMotion,
    travel,
    addToShortlist,
    removeFromShortlist,
    castVote,
    clearError: () => setError(null),
  }
}
