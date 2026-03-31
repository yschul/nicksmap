import { useState } from 'react'
import { supabase, isDemoMode as isSupabaseDemoMode } from '../lib/supabase'
import { LogIn, UserPlus, Mail, Lock, Key } from 'lucide-react'

interface AuthProps {
  onAuthSuccess: () => void
}

const SAVED_EMAIL_KEY = 'mindmap_saved_email'
const REMEMBER_EMAIL_KEY = 'mindmap_remember_email'
export const AUTO_LOGIN_KEY = 'mindmap_auto_login'

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY)
    return saved || ''
  })
  const [password, setPassword] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [rememberEmail, setRememberEmail] = useState(() => {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) === 'true'
  })
  const [autoLogin, setAutoLogin] = useState(() => {
    return localStorage.getItem(AUTO_LOGIN_KEY) === 'true'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSupabaseDemoMode) {
      setError('Supabase가 설정되지 않았습니다. 데모 모드를 사용하세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              license_key: licenseKey,
            },
          },
        })
        if (error) throw error
      }
      // 아이디 저장 처리
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, email)
        localStorage.setItem(REMEMBER_EMAIL_KEY, 'true')
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY)
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }

      // 자동 로그인 처리
      if (autoLogin) {
        localStorage.setItem(AUTO_LOGIN_KEY, 'true')
      } else {
        localStorage.removeItem(AUTO_LOGIN_KEY)
      }

      onAuthSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoMode = () => {
    onAuthSuccess()
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>MindMap Pro</h1>
          <p>협업 마인드맵 도구</p>
        </div>

        {isSupabaseDemoMode ? (
          <>
            <div className="demo-notice">
              <p>Supabase가 설정되지 않았습니다.</p>
              <p>데모 모드로 기능을 체험해보세요.</p>
            </div>
            <button className="demo-btn primary" onClick={handleDemoMode}>
              데모 모드로 시작하기
            </button>
            <p className="auth-note">
              데모 모드에서는 저장 및 협업 기능이 제한됩니다.
            </p>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(true)}
              >
                <LogIn size={18} />
                로그인
              </button>
              <button
                className={`auth-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(false)}
              >
                <UserPlus size={18} />
                회원가입
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label>
                  <Mail size={16} />
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <Lock size={16} />
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label>
                    <Key size={16} />
                    라이선스 키 (선택)
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="라이선스 키가 있으면 입력하세요"
                  />
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
              </button>
            </form>

            {isLogin && (
              <div className="remember-options">
                <div
                  className="remember-email"
                  onClick={() => setRememberEmail(!rememberEmail)}
                >
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    readOnly
                  />
                  <span>아이디 저장</span>
                </div>
                <div
                  className="remember-email"
                  onClick={() => setAutoLogin(!autoLogin)}
                >
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    readOnly
                  />
                  <span>자동 로그인</span>
                </div>
              </div>
            )}

            <div className="auth-divider">
              <span>또는</span>
            </div>

            <button className="demo-btn" onClick={handleDemoMode}>
              데모 모드로 시작하기
            </button>

            <p className="auth-note">
              데모 모드에서는 저장 및 협업 기능이 제한됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
