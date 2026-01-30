// 로컬 저장소 유틸리티
const STORAGE_KEY = 'mindmap_local_maps'

export interface LocalMindMap {
  id: string
  title: string
  data: object
  created_at: string
  updated_at: string
}

// 고유 ID 생성
export const generateId = (): string => {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 모든 로컬 마인드맵 가져오기
export const getLocalMaps = (): LocalMindMap[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (err) {
    console.error('Failed to load local maps:', err)
    return []
  }
}

// 특정 마인드맵 가져오기
export const getLocalMap = (id: string): LocalMindMap | null => {
  const maps = getLocalMaps()
  return maps.find(m => m.id === id) || null
}

// 마인드맵 저장 (새로 생성 또는 업데이트)
export const saveLocalMap = (map: { id?: string; title: string; data: object }): LocalMindMap => {
  const maps = getLocalMaps()
  const now = new Date().toISOString()

  if (map.id) {
    // 기존 맵 업데이트
    const index = maps.findIndex(m => m.id === map.id)
    if (index !== -1) {
      maps[index] = {
        ...maps[index],
        title: map.title,
        data: map.data,
        updated_at: now,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(maps))
      return maps[index]
    }
  }

  // 새 맵 생성
  const newMap: LocalMindMap = {
    id: map.id || generateId(),
    title: map.title,
    data: map.data,
    created_at: now,
    updated_at: now,
  }
  maps.unshift(newMap)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps))
  return newMap
}

// 마인드맵 삭제
export const deleteLocalMap = (id: string): void => {
  const maps = getLocalMaps()
  const filtered = maps.filter(m => m.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

// 로컬 저장소 용량 확인 (대략적)
export const getStorageUsage = (): { used: number; limit: number } => {
  let used = 0
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage.getItem(key)?.length || 0
    }
  }
  // localStorage 제한은 보통 5MB
  return { used: used * 2, limit: 5 * 1024 * 1024 } // UTF-16이므로 *2
}
