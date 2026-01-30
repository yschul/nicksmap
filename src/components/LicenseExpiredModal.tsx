import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react'

interface LicenseExpiredModalProps {
  message: string
  onLogout: () => void
  onRetry: () => void
}

export default function LicenseExpiredModal({
  message,
  onLogout,
  onRetry,
}: LicenseExpiredModalProps) {
  return (
    <div className="license-expired-overlay">
      <div className="license-expired-modal">
        <div className="license-expired-icon">
          <AlertTriangle size={48} />
        </div>
        <h2>라이선스 만료</h2>
        <p className="license-expired-message">{message}</p>
        <p className="license-expired-help">
          라이선스 갱신이 필요합니다. 관리자에게 문의하거나 다시 로그인해주세요.
        </p>
        <div className="license-expired-actions">
          <button className="btn-secondary" onClick={onRetry}>
            <RefreshCw size={18} />
            다시 확인
          </button>
          <button className="btn-primary" onClick={onLogout}>
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
