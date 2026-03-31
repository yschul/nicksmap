import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react'

type ModalType = 'alert' | 'confirm' | 'success' | 'error'

interface ModalState {
  visible: boolean
  type: ModalType
  message: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface AppModalContextType {
  showAlert: (message: string) => Promise<void>
  showConfirm: (message: string) => Promise<boolean>
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const AppModalContext = createContext<AppModalContextType | null>(null)

export function useAppModal(): AppModalContextType {
  const ctx = useContext(AppModalContext)
  if (!ctx) throw new Error('useAppModal must be used within AppModalProvider')
  return ctx
}

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ visible: false, type: 'alert', message: '' })
  const [toast, setToast] = useState<{ visible: boolean; type: 'success' | 'error'; message: string }>({
    visible: false,
    type: 'success',
    message: '',
  })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setModal(prev => ({ ...prev, visible: false }))
  }, [])

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise(resolve => {
      setModal({
        visible: true,
        type: 'alert',
        message,
        onConfirm: () => { close(); resolve() },
      })
    })
  }, [close])

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setModal({
        visible: true,
        type: 'confirm',
        message,
        onConfirm: () => { close(); resolve(true) },
        onCancel: () => { close(); resolve(false) },
      })
    })
  }, [close])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ visible: true, type, message })
    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, 3000)
  }, [])

  const showSuccess = useCallback((message: string) => showToast('success', message), [showToast])
  const showError = useCallback((message: string) => showToast('error', message), [showToast])

  const iconMap = {
    alert: <Info size={32} />,
    confirm: <AlertTriangle size={32} />,
    success: <CheckCircle size={32} />,
    error: <AlertTriangle size={32} />,
  }

  const iconClassMap = {
    alert: 'app-modal-icon info',
    confirm: 'app-modal-icon warning',
    success: 'app-modal-icon success',
    error: 'app-modal-icon error',
  }

  return (
    <AppModalContext.Provider value={{ showAlert, showConfirm, showSuccess, showError }}>
      {children}

      {/* 모달 (alert / confirm) */}
      {modal.visible && (
        <div className="app-modal-overlay">
          <div className="app-modal">
            <div className={iconClassMap[modal.type]}>
              {iconMap[modal.type]}
            </div>
            <p className="app-modal-message">{modal.message}</p>
            <div className="app-modal-actions">
              {modal.type === 'confirm' && (
                <button className="btn-secondary" onClick={modal.onCancel}>
                  취소
                </button>
              )}
              <button className="btn-primary" onClick={modal.onConfirm} autoFocus>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 (success / error) */}
      {toast.visible && (
        <div className={`app-toast ${toast.type} ${toast.visible ? 'show' : ''}`}>
          <div className="app-toast-content">
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
            <button className="app-toast-close" onClick={() => setToast(prev => ({ ...prev, visible: false }))}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </AppModalContext.Provider>
  )
}
