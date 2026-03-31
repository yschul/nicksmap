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
import ChangePasswordModal from './components/ChangePasswordModal'
import { useAppModal } from './components/AppModal'
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
  const [sharedViewData, setSharedViewData] = useState<{ title: string; data: object } | null>(null)
  const [sharedViewLoading, setSharedViewLoading] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [sidebarRefresh, setSidebarRefresh] = useState(0)
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)
  const [showLicenseExpired, setShowLicenseExpired] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  const { showAlert, showSuccess, showError } = useAppModal()

  // 제목 입력 모달
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [pendingSaveAction, setPendingSaveAction] = useState<((title: string) => void) | null>(null)
  const mindMapRef = useRef<MindMapEditorRef>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isReceivingRemote = useRef(false)
  const isLoggingOut = useRef(false)

  // 현재 맵이 로컬인지 확인
  const isLocalMap = currentMapId?.startsWith('local_') ?? false

  // 공유 링크 감지
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareToken = params.get('share')
    if (!shareToken) return

    setSharedViewLoading(true)
    const loadShared = async () => {
      try {
        const { data, error } = await supabase.rpc('get_shared_mindmap', { token: shareToken })
        if (error || !data) {
          setSharedViewData(null)
        } else {
          const result = data as { title: string; data: object }
          setSharedViewData({ title: result.title, data: result.data })
        }
      } catch {
        setSharedViewData(null)
      } finally {
        setSharedViewLoading(false)
      }
    }
    loadShared()
  }, [])

  useEffect(() => {
    if (isSupabaseDemoMode) return

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (isLoggingOut.current) return
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        const isAdminUser = await checkAdminStatus(session.user.id)
        if (!isAdminUser) {
          handleLicenseCheck(session.user.id)
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // 로그아웃 중이면 재인증 방지
      if (isLoggingOut.current) return
      if (session?.user) {
        setUser(session.user)
        setIsAuthenticated(true)
        const isAdminUser = await checkAdminStatus(session.user.id)
        if (!isAdminUser) {
          handleLicenseCheck(session.user.id)
        }
      } else {
        setUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        setAdminChecked(false)
        clearLicense()
        setLicenseStatus(null)
        setShowLicenseExpired(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Electron 앱 종료 시 자동 로그아웃
  useEffect(() => {
    if (!window.electronAPI?.onAppClosing) return
    window.electronAPI.onAppClosing(() => {
      // Supabase 관련 localStorage 삭제
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    })
  }, [])

  // 라이선스 검증 함수 (관리자가 아닌 사용자만 호출됨)
  const handleLicenseCheck = async (userId: string) => {
    const status = await refreshLicense(supabase, userId)
    setLicenseStatus(status)
    setShowLicenseExpired(!status.isValid)
  }

  // 앱 시작 시 오프라인 라이선스 검증 (관리자 확인 완료 후 실행)
  useEffect(() => {
    if (isSupabaseDemoMode || !isAuthenticated || isDemoMode || !adminChecked) return

    // 관리자는 라이선스 검증 건너뛰기
    if (isAdmin) {
      setLicenseStatus({ isValid: true, daysRemaining: 9999, message: '관리자 계정' })
      setShowLicenseExpired(false)
      return
    }

    // 로컬 라이선스 검증
    const checkOffline = async () => {
      const status = await verifyLicense()
      setLicenseStatus(status)
      if (!status.isValid) {
        setShowLicenseExpired(true)
      }
    }
    checkOffline()
  }, [isAuthenticated, isDemoMode, isAdmin, adminChecked])

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
        isReceivingRemote.current = true
        mindMapRef.current?.setData(payload.data)
        // setData 후 data_change 이벤트가 동기적으로 발생하므로 다음 틱에서 해제
        setTimeout(() => { isReceivingRemote.current = false }, 100)
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

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleDataChange = useCallback((data: object) => {
    // 원격 수신 중이면 다시 브로드캐스트하지 않음 (순환 방지)
    if (isReceivingRemote.current) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      broadcastChange(data)
    }, 500)
  }, [broadcastChange])

  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    if (isDemoMode) {
      setAdminChecked(true)
      return false
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role, must_change_password')
        .eq('id', userId)
        .single()

      const admin = data?.role === 'admin'
      setIsAdmin(admin)

      // 비밀번호 변경 필요 확인
      if (data?.must_change_password) {
        setMustChangePassword(true)
      }

      return admin
    } catch (err) {
      console.error('Failed to check admin status:', err)
      return false
    } finally {
      setAdminChecked(true)
    }
  }

  const handleAuthSuccess = () => {
    if (isSupabaseDemoMode) {
      setIsDemoMode(true)
    }
    setIsAuthenticated(true)
  }

  const clearSupabaseStorage = () => {
    // Supabase 관련 localStorage 전체 삭제
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  const handleLogout = async () => {
    // 로그아웃 플래그 설정 (onAuthStateChange에서 재인증 방지)
    isLoggingOut.current = true

    // 1. 채널 정리
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    // 2. 로컬 스토리지 먼저 삭제 (signOut 실패해도 세션 제거됨)
    clearSupabaseStorage()
    clearLicense()

    // 3. 상태 즉시 초기화
    setUser(null)
    setIsAuthenticated(false)
    setIsDemoMode(isSupabaseDemoMode)
    setCurrentMapId(null)
    setCurrentMapTitle('새 마인드맵')
    setCollaborators([])
    setIsAdmin(false)
    setAdminChecked(false)
    setLicenseStatus(null)
    setShowLicenseExpired(false)
    setMustChangePassword(false)

    // 4. Supabase signOut (실패해도 이미 로컬은 정리됨)
    if (!isDemoMode) {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (err) {
        console.error('SignOut error:', err)
      }
    }

    // 5. 혹시 남은 스토리지 한 번 더 정리
    clearSupabaseStorage()

    // 6. 로그아웃 플래그 해제
    isLoggingOut.current = false
  }

  // 제목 입력 모달을 띄우고 콜백 저장
  const requestTitle = (defaultTitle: string, callback: (title: string) => void) => {
    setTitleInput(defaultTitle)
    setPendingSaveAction(() => callback)
    setShowTitleModal(true)
  }

  const handleTitleConfirm = () => {
    const title = titleInput.trim() || '새 마인드맵'
    setCurrentMapTitle(title)
    setShowTitleModal(false)
    if (pendingSaveAction) {
      pendingSaveAction(title)
      setPendingSaveAction(null)
    }
  }

  const handleTitleCancel = () => {
    setShowTitleModal(false)
    setPendingSaveAction(null)
  }

  const handleSave = async () => {
    const data = mindMapRef.current?.getData()
    if (!data) return

    // 새 마인드맵이거나 기본 제목인 경우 이름 입력 요청
    if (!currentMapId || currentMapTitle === '새 마인드맵') {
      requestTitle(currentMapTitle, (titleToSave) => {
        executeSave(titleToSave, data)
      })
      return
    }

    executeSave(currentMapTitle, data)
  }

  const executeSave = async (titleToSave: string, data: object) => {
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
      setSidebarRefresh(prev => prev + 1)
      showSuccess('클라우드에 저장되었습니다.')
    } catch (err) {
      console.error('Save failed:', err)
      showError('클라우드 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveLocal = async (title: string, data: object) => {
    setIsSaving(true)
    try {
      // localStorage에 저장 (사이드바 목록용)
      const savedMap = saveLocalMap({
        id: isLocalMap && currentMapId ? currentMapId : undefined,
        title,
        data,
      })
      setCurrentMapId(savedMap.id)
      setSidebarRefresh(prev => prev + 1)

      // Electron: 추가로 파일로도 저장
      if (window.electronAPI) {
        const result = await window.electronAPI.saveFile(`${title}.json`, data)
        if (result.success) {
          showSuccess(`저장 완료: ${result.filePath}`)
        } else {
          showSuccess('로컬에 저장되었습니다.')
        }
      } else {
        showSuccess('로컬에 저장되었습니다.')
      }
    } catch (err) {
      console.error('Local save failed:', err)
      showError('로컬 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAs = (type: 'local' | 'cloud') => {
    const data = mindMapRef.current?.getData()
    if (!data) return

    if (type === 'cloud' && (isDemoMode || !user)) {
      return
    }

    requestTitle(currentMapTitle, (titleToSave) => {
      if (type === 'local') {
        handleSaveLocal(titleToSave, data)
      } else {
        setCurrentMapId(null)
        executeSave(titleToSave, data)
      }
    })
  }

  const handleShare = () => {
    if (isDemoMode) {
      showAlert('데모 모드에서는 공유가 불가능합니다. 로그인해주세요.')
      return
    }
    if (!currentMapId) {
      showAlert('먼저 마인드맵을 저장해주세요.')
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

  // 공유 링크로 접근한 경우 - 읽기 전용 뷰
  const shareToken = new URLSearchParams(window.location.search).get('share')
  if (shareToken) {
    if (sharedViewLoading) {
      return (
        <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>마인드맵을 불러오는 중...</p>
        </div>
      )
    }
    if (sharedViewData) {
      return (
        <div className="app">
          <div className="main-content" style={{ marginLeft: 0 }}>
            <div className="header">
              <span className="map-title-input" style={{ cursor: 'default', border: 'none' }}>
                {sharedViewData.title}
              </span>
              <span className="demo-badge" style={{ background: '#4ecdc4', color: '#fff' }}>읽기 전용</span>
            </div>
            <div className="editor-container">
              <MindMapEditor
                ref={mindMapRef}
                layout={currentLayout}
                onDataChange={() => {}}
                initialData={sharedViewData.data}
                readOnly
              />
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p>공유 링크가 유효하지 않거나 만료되었습니다.</p>
          <a href={window.location.pathname} style={{ color: '#667eea' }}>메인 페이지로 이동</a>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Auth key={Date.now()} onAuthSuccess={handleAuthSuccess} />
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

      {showLicenseExpired && !isDemoMode && !isAdmin && adminChecked && (
        <LicenseExpiredModal
          message={licenseStatus?.message || '라이선스가 만료되었습니다.'}
          onLogout={handleLogout}
          onRetry={() => user && handleLicenseCheck(user.id)}
        />
      )}

      {mustChangePassword && user && !isDemoMode && (
        <ChangePasswordModal
          onComplete={() => setMustChangePassword(false)}
        />
      )}

      {showTitleModal && (
        <div className="modal-overlay" onClick={handleTitleCancel}>
          <div className="title-modal" onClick={(e) => e.stopPropagation()}>
            <h3>마인드맵 이름</h3>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleConfirm()
                if (e.key === 'Escape') handleTitleCancel()
              }}
              placeholder="마인드맵 이름을 입력하세요"
              autoFocus
            />
            <div className="title-modal-actions">
              <button className="btn-secondary" onClick={handleTitleCancel}>취소</button>
              <button className="btn-primary" onClick={handleTitleConfirm}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
