import { useState } from 'react'
import { X, Copy, Users, Link, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ShareModalProps {
  mapId: string | null
  mapTitle: string
  onClose: () => void
}

export default function ShareModal({ mapId, mapTitle, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [sharedUsers, setSharedUsers] = useState<string[]>([])

  const handleShare = async () => {
    if (!email || !mapId) return

    setSharing(true)
    try {
      // Get user by email
      const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (userData) {
        // Update shared_with array
        const { error } = await supabase
          .from('mindmaps')
          .update({
            is_shared: true,
            shared_with: [...sharedUsers, userData.id],
          })
          .eq('id', mapId)

        if (error) throw error
        setSharedUsers([...sharedUsers, email])
        setEmail('')
      } else {
        alert('해당 이메일의 사용자를 찾을 수 없습니다.')
      }
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setSharing(false)
    }
  }

  const generateShareLink = async () => {
    if (!mapId) return

    // In production, this would generate a unique share token
    const link = `${window.location.origin}/shared/${mapId}`
    setShareLink(link)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
              <Users size={16} />
              사용자 초대
            </h3>
            <div className="share-input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소 입력"
              />
              <button onClick={handleShare} disabled={sharing || !email}>
                {sharing ? '공유 중...' : '초대'}
              </button>
            </div>
            {sharedUsers.length > 0 && (
              <div className="shared-users">
                <p>공유된 사용자:</p>
                {sharedUsers.map((user, i) => (
                  <span key={i} className="shared-user-tag">
                    {user}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="share-section">
            <h3>
              <Link size={16} />
              링크로 공유
            </h3>
            {shareLink ? (
              <div className="share-link-group">
                <input type="text" value={shareLink} readOnly />
                <button onClick={copyLink}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            ) : (
              <button className="generate-link-btn" onClick={generateShareLink}>
                공유 링크 생성
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
