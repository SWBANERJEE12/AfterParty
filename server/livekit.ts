import { AccessToken } from 'livekit-server-sdk'
import type { Request, Response } from 'express'
import { verifyRoomMember } from './supabaseAdmin'

export function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim() &&
      process.env.LIVEKIT_URL?.trim(),
  )
}

export function livekitStatus(_req: Request, res: Response) {
  res.json({
    configured: livekitConfigured(),
    url: livekitConfigured() ? process.env.LIVEKIT_URL : null,
    membershipCheck: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  })
}

export async function issueLivekitToken(req: Request, res: Response) {
  if (!livekitConfigured()) {
    res.status(503).json({
      error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET on the server.',
    })
    return
  }

  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim() : ''
  const memberKey = typeof req.body?.memberKey === 'string' ? req.body.memberKey.trim() : ''
  const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim().slice(0, 24) : 'Guest'

  if (!roomId || !memberKey) {
    res.status(400).json({ error: 'roomId and memberKey are required.' })
    return
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to verify room membership before issuing call tokens.',
    })
    return
  }

  const isMember = await verifyRoomMember(roomId, memberKey)
  if (!isMember) {
    res.status(403).json({ error: 'You are not a member of this room.' })
    return
  }

  const apiKey = process.env.LIVEKIT_API_KEY!.trim()
  const apiSecret = process.env.LIVEKIT_API_SECRET!.trim()
  const livekitRoom = `afterparty-${roomId}`

  const at = new AccessToken(apiKey, apiSecret, {
    identity: memberKey,
    name: nickname,
    ttl: '2h',
  })
  at.addGrant({
    roomJoin: true,
    room: livekitRoom,
    canPublish: true,
    canSubscribe: true,
  })

  const token = await at.toJwt()
  res.json({
    token,
    serverUrl: process.env.LIVEKIT_URL!.trim(),
    roomName: livekitRoom,
  })
}
