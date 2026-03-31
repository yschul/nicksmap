import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppModal } from './AppModal'

interface ChangePasswordModalProps {
  onComplete: () => void
}

export default function ChangePasswordModal({ onComplete }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { showSuccess } = useAppModal()

  const handleSubmit = async () => {
    setError('')

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      // DB 함수로 직접 비밀번호 변경 (must_change_password 플래그도 함께 해제)
      const { error: rpcError } = await supabase.rpc('change_own_password', {
        new_password: newPassword,
      })

      if (rpcError) throw rpcError

      showSuccess('비밀번호가 변경되었습니다.')
      onComplete()
    } catch (err: any) {
      console.error('Failed to change password:', err)
      setError(err.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="license-expired-overlay">
      <div className="change-password-modal">
        <div className="change-password-icon">
          <Lock size={40} />
        </div>
        <h2>비밀번호 변경 필요</h2>
        <p className="change-password-desc">
          관리자에 의해 비밀번호가 초기화되었습니다.<br />
          새 비밀번호를 설정해 주세요.
        </p>

        <div className="change-password-form">
          <div className="form-group">
            <label>새 비밀번호</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상 입력"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>비밀번호 확인</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
              />
            </div>
          </div>

          {error && <p className="change-password-error">{error}</p>}

          <button
            className="btn-primary change-password-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>
    </div>
  )
}
