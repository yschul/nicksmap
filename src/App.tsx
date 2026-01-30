import { useState, useRef, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isDemoMode as isSupabaseDemoMode } from './lib/supabase'
import type { MindMapData } from './lib/supabase'
import { saveLocalMap, type LocalMindMap } from './lib/localStorage'
import {
  verifyLicense,
  refreshLicense,
  clearLicense,
  type LicenseStatus,
} from './lib/license'
import MindMapEditor from './components/MindMapEditor'
import type { MindMapEditorRef } from './components/MindMapEditor'
import Toolbar from './components/Toolbar'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import ShareModal from './components/ShareModal'
import CollaboratorsList from './components/CollaboratorsList'
import AdminPanel from './components/AdminPanel'
import LicenseExpiredModal from './components/LicenseExpiredModal'
import './App.css'

interface Collaborator {
  id: string
  email: string
  color: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(isSupabaseDemoMode)
  const [currentLayout, setCurrentLayout] = useState('logicalStructure')
  const [currentMapId, setCurrentMapId] = useState<string | null>(null)
  const [currentMapTitle, setCurrentMapTitle] = useState('새 마인드맵')
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [sidebarRefresh, setSidebarRefresh] = useState(0)
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)
  const [showLicenseExpired, setShowLicenseExpired] = useState(false)
  const mindMapRef = useRef<MindMapEditorRef>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // 현재 맵이 로컬인지 확인
  const isLocalMap = currentMapId?.startsWith('local_') ?? false

  useEffect(() => {
    if (isSupabaseDemoMode) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        checkAdminStatus(session.user.id)
        // 라이선스 검증 및 갱신
        handleLicenseCheck(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        checkAdminStatus(session.user.id)
        // 라이선스 검증 및 갱신
        handleLicenseCheck(session.user.id)
      } else {
        setUser(null)
        setIsAuthenticated(false)
        clearLicense()
        setLicenseStatus(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 라이선스 검증 함수
  const handleLicenseCheck = async (userId: string) => {
    // 먼저 관리자인지 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    // 관리자는 라이선스 검증 건너뛰기
    if (profile?.role === 'admin') {
      setLicenseStatus({ isValid: true, daysRemaining: 9999, message: '관리자 계정' })
      setShowLicenseExpired(false)
      return
    }

    // 일반 사용자는 라이선스 검증
    const status = await refreshLicense(supabase, userId)
    setLicenseStatus(status)

    if (!status.isValid) {
      setShowLicenseExpired(true)
    }
  }

  // 앱 시작 시 오프라인 라이선스 검증
  useEffect(() => {
    if (isSupabaseDemoMode || !isAuthenticated || isDemoMode) return

    // 관리자는 라이선스 검증 건너뛰기
    if (isAdmin) {
      setLicenseStatus({ isValid: true, daysRemaining: 9999, message: '관리자 계정' })
      setShowLicenseExpired(false)
      return
    }

    // 로컬 라이선스 검증
    const status = verifyLicense()
    setLicenseStatus(status)

    if (!status.isValid) {
      setShowLicenseExpired(true)
    }
  }, [isAuthenticated, isDemoMode, isAdmin])

  // 실시간 협업 채널 설정
  useEffect(() => {
    if (!currentMapId || !user || isDemoMode) {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      setCollaborators([])
      return
    }

    const channel = supabase.channel(`mindmap:${currentMapId}`, {
      config: { presence: { key: user.id } },
    })

    // 다른 사용자의 변경사항 수신
    channel.on('broadcast', { event: 'mindmap_update' }, ({ payload }) => {
      if (payload.userId !== user.id && payload.data) {
        mindMapRef.current?.setData(payload.data)
      }
    })

    // 접속자 목록 관리
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const users: Collaborator[] = []
      let colorIndex = 0

      Object.entries(state).forEach(([key, presences]) => {
        const presence = presences[0] as { email?: string }
        users.push({
          id: key,
          email: presence?.email || '사용자',
          color: COLORS[colorIndex % COLORS.length],
        })
        colorIndex++
      })
      setCollaborators(users)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ email: user.email })
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [currentMapId, user, isDemoMode])

  // 마인드맵 변경시 브로드캐스트
  const broadcastChange = useCallback((data: object) => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'mindmap_update',
        payload: { data, userId: user.id },
      })
    }
  }, [user])

  const handleDataChange = useCallback((data: object) => {
    broadcastChange(data)
  }, [broadcastChange])

  const checkAdminStatus = async (userId: string) => {
    if (isDemoMode) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      setIsAdmin(data?.role === 'admin')
    } catch (err) {
      console.error('Failed to check admin status:', err)
    }
  }

  const handleAuthSuccess = () => {
    if (isSupabaseDemoMode) {
      setIsDemoMode(true)
      setIsAuthenticated(true)
      return
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        setIsAuthenticated(true)
      } else {
        setIsDemoMode(true)
        setIsAuthenticated(true)
      }
    })
  }

  const handleLogout = async () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    if (!isDemoMode) {
      await supabase.auth.signOut({ scope: 'local' })
    }
    // 로컬 스토리지 세션 완전 삭제
    localStorage.removeItem('sb-vsntviuwmtffeejhailh-auth-token')
    // 라이선스 정보 삭제
    clearLicense()
    setUser(null)
    setIsAuthenticated(false)
    setIsDemoMode(isSupabaseDemoMode)
    setCurrentMapId(null)
    setCollaborators([])
    setIsAdmin(false)
    setLicenseStatus(null)
    setShowLicenseExpired(false)
  }

  const handleSave = async () => {
    const data = mindMapRef.current?.getData()
    if (!data) return

    // 새 마인드맵이거나 기본 제목인 경우 이름 입력 요청
    let titleToSave = currentMapTitle
    if (!currentMapId || currentMapTitle === '새 마인드맵') {
      const inputTitle = prompt('마인드맵 이름을 입력하세요:', currentMapTitle)
      if (inputTitle === null) return // 취소 시 저장 안 함
      titleToSave = inputTitle.trim() || '새 마인드맵'
      setCurrentMapTitle(titleToSave)
    }

    // 데모 모드이거나 로컬 맵인 경우 로컬에 저장
    if (isDemoMode || isLocalMap || !user) {
      handleSaveLocal(titleToSave, data)
      return
    }

    // 클라우드 저장
    setIsSaving(true)
    try {
      if (currentMapId) {
        const { error } = await supabase
          .from('mindmaps')
          .update({
            data,
            title: titleToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentMapId)

        if (error) throw error
      } else {
        const { data: newMap, error } = await supabase
          .from('mindmaps')
          .insert({
            user_id: user.id,
            title: titleToSave,
            data,
            is_shared: false,
            shared_with: [],
          })
          .select()
          .single()

        if (error) throw error
        setCurrentMapId(newMap.id)
      }
      alert('클라우드에 저장되었습니다!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveLocal = (title: string, data: object) => {
    setIsSaving(true)
    try {
      const savedMap = saveLocalMap({
        id: isLocalMap && currentMapId ? currentMapId : undefined,
        title,
        data,
      })
      setCurrentMapId(savedMap.id)
      setSidebarRefresh(prev => prev + 1)
      alert('로컬에 저장되었습니다!')
    } catch (err) {
      console.error('Local save failed:', err)
      alert('로컬 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAs = (type: 'local' | 'cloud') => {
    const data = mindMapRef.current?.getData()
    if (!data) return

    const inputTitle = prompt('마인드맵 이름을 입력하세요:', currentMapTitle)
    if (inputTitle === null) return
    const titleToSave = inputTitle.trim() || '새 마인드맵'
    setCurrentMapTitle(titleToSave)

    if (type === 'local') {
      // 새 로컬 맵으로 저장
      setIsSaving(true)
      try {
        const savedMap = saveLocalMap({
          title: titleToSave,
          data,
        })
        setCurrentMapId(savedMap.id)
        setSidebarRefresh(prev => prev + 1)
        alert('로컬에 저장되었습니다!')
      } catch (err) {
        console.error('Local save failed:', err)
        alert('로컬 저장에 실패했습니다.')
      } finally {
        setIsSaving(false)
      }
    } else {
      // 클라우드에 새로 저장
      if (isDemoMode || !user) {
        alert('클라우드 저장은 로그인이 필요합니다.')
        return
      }
      setCurrentMapId(null) // 새 맵으로 저장
      handleSave()
    }
  }

  const handleShare = () => {
    if (isDemoMode) {
      alert('데모 모드에서는 공유가 불가능합니다. 로그인해주세요.')
      return
    }
    if (!currentMapId) {
      alert('먼저 마인드맵을 저장해주세요.')
      return
    }
    setShowShareModal(true)
  }

  const handleSelectMap = (map: MindMapData | LocalMindMap) => {
    setCurrentMapId(map.id)
    setCurrentMapTitle(map.title)
    mindMapRef.current?.setData(map.data)
  }

  const handleNewMap = () => {
    setCurrentMapId(null)
    setCurrentMapTitle('새 마인드맵')
    setCollaborators([])
    mindMapRef.current?.setData({
      data: {
        text: '중심 주제',
        expand: true,
      },
      children: [],
    })
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMapTitle(e.target.value)
  }

  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        currentMapId={currentMapId}
        onSelectMap={handleSelectMap}
        onNewMap={handleNewMap}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isDemoMode={isDemoMode}
        onOpenAdmin={() => setShowAdminPanel(true)}
        refreshTrigger={sidebarRefresh}
      />

      <div className="main-content">
        <div className="header">
          <input
            type="text"
            className="map-title-input"
            value={currentMapTitle}
            onChange={handleTitleChange}
            placeholder="마인드맵 제목"
          />
          {isDemoMode && <span className="demo-badge">데모 모드</span>}
          {!isDemoMode && licenseStatus && licenseStatus.daysRemaining <= 30 && licenseStatus.daysRemaining > 0 && (
            <span className="license-warning-badge">
              라이선스 {licenseStatus.daysRemaining}일 남음
            </span>
          )}
          {isSaving && <span className="saving-indicator">저장 중...</span>}
          {collaborators.length > 0 && (
            <CollaboratorsList collaborators={collaborators} currentUserId={user?.id} />
          )}
        </div>

        <Toolbar
          mindMapRef={mindMapRef}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onShare={handleShare}
          currentLayout={currentLayout}
          onLayoutChange={setCurrentLayout}
          isDemoMode={isDemoMode}
        />

        <div className="editor-container">
          <MindMapEditor
            ref={mindMapRef}
            layout={currentLayout}
            onDataChange={handleDataChange}
          />
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          mapId={currentMapId}
          mapTitle={currentMapTitle}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {showLicenseExpired && !isDemoMode && (
        <LicenseExpiredModal
          message={licenseStatus?.message || '라이선스가 만료되었습니다.'}
          onLogout={handleLogout}
          onRetry={() => user && handleLicenseCheck(user.id)}
        />
      )}
    </div>
  )
}

export default App
