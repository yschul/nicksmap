import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crown,
  HardDrive,
  Cloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MindMapData } from '../lib/supabase'
import { getLocalMaps, deleteLocalMap, type LocalMindMap } from '../lib/localStorage'
import type { User } from '@supabase/supabase-js'
import { useAppModal } from './AppModal'

interface SidebarProps {
  user: User | null
  currentMapId: string | null
  onSelectMap: (map: MindMapData | LocalMindMap) => void
  onNewMap: () => void
  onLogout: () => void
  isAdmin: boolean
  isDemoMode?: boolean
  onOpenAdmin?: () => void
  refreshTrigger?: number
}

export default function Sidebar({
  user,
  currentMapId,
  onSelectMap,
  onNewMap,
  onLogout,
  isAdmin,
  isDemoMode = false,
  onOpenAdmin,
  refreshTrigger = 0,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [maps, setMaps] = useState<MindMapData[]>([])
  const [localMaps, setLocalMaps] = useState<LocalMindMap[]>([])
  const [loading, setLoading] = useState(false)
  const { showConfirm } = useAppModal()

  // 클라우드 맵 로드 (refreshTrigger 변경 시에도 다시 로드)
  useEffect(() => {
    if (user && !isDemoMode) {
      loadMaps()
    } else {
      setLoading(false)
    }
  }, [user, isDemoMode, refreshTrigger])

  // 로컬 맵 로드
  useEffect(() => {
    loadLocalMaps()
  }, [refreshTrigger])

  const loadMaps = async () => {
    if (!user || isDemoMode) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mindmaps')
        .select('*')
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setMaps(data || [])
    } catch (err) {
      console.error('Failed to load maps:', err)
      // 토큰 갱신 중일 수 있으므로 3초 후 재시도
      setTimeout(() => {
        if (user && !isDemoMode) loadMaps()
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  const loadLocalMaps = () => {
    const maps = getLocalMaps()
    setLocalMaps(maps)
  }

  const handleDeleteMap = async (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!await showConfirm('이 마인드맵을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase.from('mindmaps').delete().eq('id', mapId)
      if (error) throw error
      setMaps(maps.filter((m) => m.id !== mapId))
    } catch (err) {
      console.error('Failed to delete map:', err)
    }
  }

  const handleDeleteLocalMap = async (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!await showConfirm('이 로컬 마인드맵을 삭제하시겠습니까?')) return

    deleteLocalMap(mapId)
    loadLocalMaps()
  }

  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={() => setIsCollapsed(false)}>
          <ChevronRight size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>MindMap Pro</h2>
        <button className="sidebar-toggle" onClick={() => setIsCollapsed(true)}>
          <ChevronLeft size={20} />
        </button>
      </div>

      {isDemoMode ? (
        <div className="user-info">
          <div className="user-avatar">D</div>
          <div className="user-details">
            <span className="user-email">데모 사용자</span>
          </div>
        </div>
      ) : user && (
        <div className="user-info">
          <div className="user-avatar">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-email">{user.email}</span>
            {isAdmin && (
              <span className="admin-badge">
                <Crown size={12} /> 관리자
              </span>
            )}
          </div>
        </div>
      )}

      <button className="new-map-btn" onClick={onNewMap}>
        <Plus size={18} />
        새 마인드맵
      </button>

      {/* 로컬 저장 마인드맵 */}
      <div className="sidebar-section">
        <h3>
          <HardDrive size={16} />
          로컬 저장
        </h3>
        <div className="map-list">
          {localMaps.length === 0 ? (
            <div className="empty">로컬에 저장된 맵이 없습니다</div>
          ) : (
            localMaps.map((map) => (
              <div
                key={map.id}
                className={`map-item ${currentMapId === map.id ? 'active' : ''}`}
                onClick={() => onSelectMap(map as unknown as MindMapData)}
              >
                <span className="map-title">{map.title}</span>
                <div className="map-actions">
                  <HardDrive size={12} className="local-icon" />
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteLocalMap(map.id, e)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 클라우드 저장 마인드맵 */}
      {!isDemoMode && (
        <div className="sidebar-section">
          <h3>
            <Cloud size={16} />
            클라우드 저장
          </h3>
          <div className="map-list">
            {loading ? (
              <div className="loading">로딩 중...</div>
            ) : maps.length === 0 ? (
              <div className="empty">클라우드에 저장된 맵이 없습니다</div>
            ) : (
              maps.map((map) => (
                <div
                  key={map.id}
                  className={`map-item ${currentMapId === map.id ? 'active' : ''}`}
                  onClick={() => onSelectMap(map)}
                >
                  <span className="map-title">{map.title}</span>
                  <div className="map-actions">
                    {map.is_shared && <Users size={14} className="shared-icon" />}
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteMap(map.id, e)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isAdmin && !isDemoMode && (
        <div className="sidebar-section">
          <h3>
            <Settings size={16} />
            관리자 설정
          </h3>
          <div className="admin-panel">
            <button className="admin-btn" onClick={onOpenAdmin}>
              <Users size={16} />
              사용자 관리
            </button>
            <button className="admin-btn" onClick={onOpenAdmin}>
              <Settings size={16} />
              라이선스 관리
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </div>
  )
}
