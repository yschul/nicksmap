import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface CollaborationUser {
  id: string
  email: string
  cursorPosition?: { x: number; y: number }
  color: string
}

interface UseRealtimeCollaborationProps {
  mapId: string | null
  userId: string | null
  onDataChange: (data: object) => void
  onUsersChange: (users: CollaborationUser[]) => void
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
]

export function useRealtimeCollaboration({
  mapId,
  userId,
  onDataChange,
  onUsersChange,
}: UseRealtimeCollaborationProps) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const usersRef = useRef<Map<string, CollaborationUser>>(new Map())

  const broadcastChange = useCallback(
    (data: object) => {
      if (channelRef.current && mapId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'mindmap_change',
          payload: { data, userId },
        })
      }
    },
    [mapId, userId]
  )

  const broadcastCursor = useCallback(
    (position: { x: number; y: number }) => {
      if (channelRef.current && mapId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'cursor_move',
          payload: { position, userId },
        })
      }
    },
    [mapId, userId]
  )

  useEffect(() => {
    if (!mapId || !userId) return

    // 채널 생성
    const channel = supabase.channel(`mindmap:${mapId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    // 마인드맵 데이터 변경 수신
    channel.on('broadcast', { event: 'mindmap_change' }, ({ payload }) => {
      if (payload.userId !== userId) {
        onDataChange(payload.data)
      }
    })

    // 커서 이동 수신
    channel.on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
      if (payload.userId !== userId) {
        const user = usersRef.current.get(payload.userId)
        if (user) {
          user.cursorPosition = payload.position
          onUsersChange(Array.from(usersRef.current.values()))
        }
      }
    })

    // Presence 추적
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      usersRef.current.clear()

      Object.entries(state).forEach(([key, presences]) => {
        const presence = presences[0] as { email?: string }
        usersRef.current.set(key, {
          id: key,
          email: presence?.email || 'Unknown',
          color: COLORS[usersRef.current.size % COLORS.length],
        })
      })

      onUsersChange(Array.from(usersRef.current.values()))
    })

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const presence = newPresences[0] as { email?: string }
      usersRef.current.set(key, {
        id: key,
        email: presence?.email || 'Unknown',
        color: COLORS[usersRef.current.size % COLORS.length],
      })
      onUsersChange(Array.from(usersRef.current.values()))
    })

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      usersRef.current.delete(key)
      onUsersChange(Array.from(usersRef.current.values()))
    })

    // 채널 구독 및 presence 트래킹
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          online_at: new Date().toISOString(),
        })
      }
    })

    channelRef.current = channel

    // 데이터베이스 실시간 변경 구독
    const subscription = supabase
      .channel(`mindmap_db:${mapId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mindmaps',
          filter: `id=eq.${mapId}`,
        },
        (payload) => {
          if (payload.new && payload.new.data) {
            onDataChange(payload.new.data)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      subscription.unsubscribe()
      channelRef.current = null
    }
  }, [mapId, userId, onDataChange, onUsersChange])

  return {
    broadcastChange,
    broadcastCursor,
  }
}
