import { useState, useEffect } from 'react'
import { X, Users, UserMinus, Loader, Link, Copy, Check, Unlink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppModal } from './AppModal'

interface SharedUser {
  id: string
  email: string
}

interface ShareModalProps {
  mapId: string | null
  mapTitle: string
  onClose: () => void
}

export default function ShareModal({ mapId, mapTitle, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const { showAlert, showConfirm, showSuccess, showError } = useAppModal()

  // 모달 열릴 때 기존 공유 목록 및 링크 토큰 로드
  useEffect(() => {
    if (mapId) {
      loadSharedUsers()
      loadShareToken()
    }
  }, [mapId])

  const loadSharedUsers = async () => {
    if (!mapId) return
    setLoading(true)
    try {
      const { data: map } = await supabase
        .from('mindmaps')
        .select('shared_with')
        .eq('id', mapId)
        .single()

      if (map?.shared_with && map.shared_with.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', map.shared_with)

        setSharedUsers(users || [])
      } else {
        setSharedUsers([])
      }
    } catch (err) {
      console.error('Failed to load shared users:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadShareToken = async () => {
    if (!mapId) return
    try {
      const { data: map, error } = await supabase
        .from('mindmaps')
        .select('share_token')
        .eq('id', mapId)
        .single()

      if (!error && map) {
        setShareToken(map.share_token || null)
      }
    } catch {
      // share_token 컬럼이 없는 경우 무시
      setShareToken(null)
    }
  }

  const generateShareLink = async () => {
    if (!mapId) return
    setGeneratingLink(true)
    try {
      const token = crypto.randomUUID()
      const { error } = await supabase
        .from('mindmaps')
        .update({ share_token: token })
        .eq('id', mapId)

      if (error) throw error
      setShareToken(token)
      showSuccess('공유 링크가 생성되었습니다.')
    } catch (err) {
      console.error('Failed to generate share link:', err)
      showError('링크 생성에 실패했습니다.')
    } finally {
      setGeneratingLink(false)
    }
  }

  const removeShareLink = async () => {
    if (!mapId) return
    if (!await showConfirm('공유 링크를 비활성화하시겠습니까?\n기존 링크로는 더 이상 접근할 수 없게 됩니다.')) return
    try {
      const { error } = await supabase
        .from('mindmaps')
        .update({ share_token: null })
        .eq('id', mapId)

      if (error) throw error
      setShareToken(null)
      showSuccess('공유 링크가 비활성화되었습니다.')
    } catch (err) {
      console.error('Failed to remove share link:', err)
      showError('링크 비활성화에 실패했습니다.')
    }
  }

  const copyShareLink = async () => {
    if (!shareToken) return
    const url = `${window.location.origin}${window.location.pathname}?share=${shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getShareUrl = () => {
    if (!shareToken) return ''
    return `${window.location.origin}${window.location.pathname}?share=${shareToken}`
  }

  const handleShare = async () => {
    if (!email.trim() || !mapId) return

    setSharing(true)
    try {
      // 이메일로 사용자 찾기 (RPC 함수로 RLS 우회)
      const { data: userData, error: findError } = await supabase
        .rpc('find_user_by_email', { target_email: email.trim() })

      if (findError || !userData || !userData.id) {
        await showAlert('해당 이메일의 사용자를 찾을 수 없습니다.')
        return
      }

      // 이미 공유되어 있는지 확인
      if (sharedUsers.some(u => u.id === userData.id)) {
        await showAlert('이미 공유된 사용자입니다.')
        return
      }

      // shared_with 배열 업데이트
      const newSharedIds = [...sharedUsers.map(u => u.id), userData.id]
      const { error } = await supabase
        .from('mindmaps')
        .update({
          is_shared: true,
          shared_with: newSharedIds,
        })
        .eq('id', mapId)

      if (error) throw error

      setSharedUsers([...sharedUsers, userData])
      setEmail('')
      showSuccess(`${userData.email}에게 공유되었습니다.`)
    } catch (err) {
      console.error('Share failed:', err)
      showError('공유에 실패했습니다.')
    } finally {
      setSharing(false)
    }
  }

  const handleUnshare = async (userId: string, userEmail: string) => {
    if (!mapId) return
    if (!await showConfirm(`${userEmail}의 공유를 해제하시겠습니까?`)) return

    try {
      const newSharedIds = sharedUsers.filter(u => u.id !== userId).map(u => u.id)
      const { error } = await supabase
        .from('mindmaps')
        .update({
          is_shared: newSharedIds.length > 0,
          shared_with: newSharedIds,
        })
        .eq('id', mapId)

      if (error) throw error

      setSharedUsers(sharedUsers.filter(u => u.id !== userId))
      showSuccess(`${userEmail}의 공유가 해제되었습니다.`)
    } catch (err) {
      console.error('Unshare failed:', err)
      showError('공유 해제에 실패했습니다.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>마인드맵 공유</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">"{mapTitle}" 공유하기</p>

          <div className="share-section">
            <h3>
              <Link size={16} />
              링크로 공유
            </h3>
            {shareToken ? (
              <>
                <div className="share-link-group">
                  <input
                    type="text"
                    value={getShareUrl()}
                    readOnly
                  />
                  <button onClick={copyShareLink} title="링크 복사">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                <button
                  className="generate-link-btn"
                  onClick={removeShareLink}
                  style={{ marginTop: '8px', color: '#e74c3c' }}
                >
                  <Unlink size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  링크 비활성화
                </button>
              </>
            ) : (
              <button
                className="generate-link-btn"
                onClick={generateShareLink}
                disabled={generatingLink}
              >
                {generatingLink ? '생성 중...' : '🔗 공유 링크 생성'}
              </button>
            )}
            <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '8px' }}>
              링크를 가진 누구나 로그인 없이 읽기 전용으로 볼 수 있습니다.
            </p>
          </div>

          <div className="share-section">
            <h3>
              <Users size={16} />
              사용자 초대
            </h3>
            <div className="share-input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소 입력"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleShare()
                }}
              />
              <button onClick={handleShare} disabled={sharing || !email.trim()}>
                {sharing ? '공유 중...' : '초대'}
              </button>
            </div>
          </div>

          <div className="share-section">
            <h3>
              <Users size={16} />
              공유된 사용자 ({sharedUsers.length}명)
            </h3>
            {loading ? (
              <div className="share-loading">
                <Loader size={16} className="spin" /> 로딩 중...
              </div>
            ) : sharedUsers.length === 0 ? (
              <p className="share-empty">공유된 사용자가 없습니다.</p>
            ) : (
              <div className="shared-users-list">
                {sharedUsers.map((user) => (
                  <div key={user.id} className="shared-user-item">
                    <span className="shared-user-email">{user.email}</span>
                    <button
                      className="btn-icon danger small"
                      onClick={() => handleUnshare(user.id, user.email)}
                      title="공유 해제"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
