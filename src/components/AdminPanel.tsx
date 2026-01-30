import { useState, useEffect } from 'react'
import {
  X,
  Users,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Calendar,
  Search,
  UserPlus,
  UserMinus,
  KeyRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  license_key?: string
  license_expires_at?: string
  created_at: string
}

interface License {
  id: string
  license_key: string
  max_users: number
  current_users: number
  expires_at: string
  is_active: boolean
  created_at: string
}

interface AdminPanelProps {
  onClose: () => void
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'licenses'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // 새 라이선스 생성 폼
  const [showNewLicense, setShowNewLicense] = useState(false)
  const [newLicense, setNewLicense] = useState({
    maxUsers: 5,
    expiresInDays: 365,
  })

  // 사용자 라이선스 할당 모달
  const [showAssignLicense, setShowAssignLicense] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [assignMode, setAssignMode] = useState<'existing' | 'direct'>('existing')
  const [selectedLicenseKey, setSelectedLicenseKey] = useState('')
  const [directExpireDays, setDirectExpireDays] = useState(365)

  useEffect(() => {
    loadData()
  }, [activeTab])

  // 사용자 탭에서 라이선스 목록도 필요하므로 별도 로드
  useEffect(() => {
    loadLicenses()
  }, [])

  const loadLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLicenses(data || [])
    } catch (err) {
      console.error('Failed to load licenses:', err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setUsers(data || [])
      } else {
        const { data, error } = await supabase
          .from('licenses')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setLicenses(data || [])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const segments = 4
    const segmentLength = 5
    const key = []

    for (let i = 0; i < segments; i++) {
      let segment = ''
      for (let j = 0; j < segmentLength; j++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      key.push(segment)
    }

    return key.join('-')
  }

  const handleCreateLicense = async () => {
    const licenseKey = generateLicenseKey()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + newLicense.expiresInDays)

    try {
      const { error } = await supabase.from('licenses').insert({
        license_key: licenseKey,
        max_users: newLicense.maxUsers,
        current_users: 0,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })

      if (error) throw error

      setShowNewLicense(false)
      loadData()
      alert(`라이선스가 생성되었습니다: ${licenseKey}`)
    } catch (err) {
      console.error('Failed to create license:', err)
      alert('라이선스 생성에 실패했습니다.')
    }
  }

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      loadData()
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  const handleResetPassword = async (email: string) => {
    if (!confirm(`${email} 사용자에게 비밀번호 재설정 이메일을 보내시겠습니까?`)) return

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      alert(`${email}로 비밀번호 재설정 이메일을 발송했습니다.`)
    } catch (err) {
      console.error('Failed to send reset email:', err)
      alert('비밀번호 재설정 이메일 발송에 실패했습니다.')
    }
  }

  const handleToggleLicense = async (licenseId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ is_active: !currentStatus })
        .eq('id', licenseId)

      if (error) throw error
      loadData()
    } catch (err) {
      console.error('Failed to update license:', err)
    }
  }

  const handleDeleteLicense = async (licenseId: string) => {
    if (!confirm('이 라이선스를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('id', licenseId)

      if (error) throw error
      loadData()
    } catch (err) {
      console.error('Failed to delete license:', err)
    }
  }

  const openAssignLicenseModal = (user: User) => {
    setSelectedUser(user)
    setAssignMode('existing')
    setSelectedLicenseKey('')
    setDirectExpireDays(365)
    setShowAssignLicense(true)
  }

  const handleAssignLicense = async () => {
    if (!selectedUser) return

    let licenseKey = ''
    let expiresAt: Date

    if (assignMode === 'existing') {
      if (!selectedLicenseKey) {
        alert('라이선스를 선택해주세요.')
        return
      }
      const license = licenses.find(l => l.license_key === selectedLicenseKey)
      if (!license) return

      licenseKey = license.license_key
      expiresAt = new Date(license.expires_at)

      // 라이선스 현재 사용자 수 증가
      await supabase
        .from('licenses')
        .update({ current_users: license.current_users + 1 })
        .eq('id', license.id)
    } else {
      // 직접 만료일 설정
      licenseKey = `DIRECT-${selectedUser.id.slice(0, 8).toUpperCase()}`
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + directExpireDays)
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          license_key: licenseKey,
          license_expires_at: expiresAt.toISOString(),
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      setShowAssignLicense(false)
      setSelectedUser(null)
      loadData()
      alert('라이선스가 할당되었습니다.')
    } catch (err) {
      console.error('Failed to assign license:', err)
      alert('라이선스 할당에 실패했습니다.')
    }
  }

  const handleRemoveLicense = async (user: User) => {
    if (!confirm(`${user.email}의 라이선스를 해제하시겠습니까?`)) return

    try {
      // 기존 라이선스가 licenses 테이블에 있으면 사용자 수 감소
      if (user.license_key && !user.license_key.startsWith('DIRECT-')) {
        const license = licenses.find(l => l.license_key === user.license_key)
        if (license && license.current_users > 0) {
          await supabase
            .from('licenses')
            .update({ current_users: license.current_users - 1 })
            .eq('id', license.id)
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          license_key: null,
          license_expires_at: null,
        })
        .eq('id', user.id)

      if (error) throw error
      loadData()
      loadLicenses()
    } catch (err) {
      console.error('Failed to remove license:', err)
      alert('라이선스 해제에 실패했습니다.')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredLicenses = licenses.filter((license) =>
    license.license_key?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>관리자 패널</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} />
            사용자 관리
          </button>
          <button
            className={`admin-tab ${activeTab === 'licenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('licenses')}
          >
            <Key size={18} />
            라이선스 관리
          </button>
        </div>

        <div className="admin-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'licenses' && (
            <button className="btn-primary" onClick={() => setShowNewLicense(true)}>
              <Plus size={16} />
              새 라이선스
            </button>
          )}
        </div>

        <div className="admin-content">
          {loading ? (
            <div className="loading-state">로딩 중...</div>
          ) : activeTab === 'users' ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>역할</th>
                  <th>라이선스</th>
                  <th>만료일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      사용자가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isExpired = user.license_expires_at && new Date(user.license_expires_at) < new Date()
                    return (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>
                            {user.role === 'admin' ? '관리자' : '사용자'}
                          </span>
                        </td>
                        <td>
                          {user.license_key ? (
                            <span className={`license-badge ${isExpired ? 'expired' : 'active'}`}>
                              {isExpired ? '만료됨' : '활성'}
                            </span>
                          ) : (
                            <span className="license-badge inactive">없음</span>
                          )}
                        </td>
                        <td>
                          {user.license_expires_at ? (
                            <div className="date-cell">
                              <Calendar size={14} />
                              {formatDate(user.license_expires_at)}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon"
                              onClick={() => handleToggleUserRole(user.id, user.role)}
                              title={user.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              className="btn-icon warning"
                              onClick={() => handleResetPassword(user.email)}
                              title="비밀번호 초기화"
                            >
                              <KeyRound size={16} />
                            </button>
                            {user.license_key ? (
                              <button
                                className="btn-icon danger"
                                onClick={() => handleRemoveLicense(user)}
                                title="라이선스 해제"
                              >
                                <UserMinus size={16} />
                              </button>
                            ) : (
                              <button
                                className="btn-icon success"
                                onClick={() => openAssignLicenseModal(user)}
                                title="라이선스 할당"
                              >
                                <UserPlus size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>라이선스 키</th>
                  <th>사용자</th>
                  <th>만료일</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredLicenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      라이선스가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredLicenses.map((license) => (
                    <tr key={license.id}>
                      <td>
                        <div className="license-key-cell">
                          <code>{license.license_key}</code>
                          <button
                            className="btn-icon small"
                            onClick={() => copyToClipboard(license.license_key)}
                          >
                            {copiedKey === license.license_key ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        {license.current_users} / {license.max_users}
                      </td>
                      <td>
                        <div className="date-cell">
                          <Calendar size={14} />
                          {formatDate(license.expires_at)}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`license-badge ${license.is_active ? 'active' : 'inactive'}`}
                        >
                          {license.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleLicense(license.id, license.is_active)}
                            title={license.is_active ? '비활성화' : '활성화'}
                          >
                            <Shield size={16} />
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDeleteLicense(license.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 새 라이선스 생성 모달 */}
        {showNewLicense && (
          <div className="sub-modal">
            <div className="sub-modal-content">
              <h3>새 라이선스 생성</h3>

              <div className="form-group">
                <label>최대 사용자 수</label>
                <input
                  type="number"
                  min="1"
                  value={newLicense.maxUsers}
                  onChange={(e) =>
                    setNewLicense({ ...newLicense, maxUsers: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="form-group">
                <label>유효 기간 (일)</label>
                <input
                  type="number"
                  min="1"
                  value={newLicense.expiresInDays}
                  onChange={(e) =>
                    setNewLicense({ ...newLicense, expiresInDays: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="sub-modal-actions">
                <button className="btn-secondary" onClick={() => setShowNewLicense(false)}>
                  취소
                </button>
                <button className="btn-primary" onClick={handleCreateLicense}>
                  생성
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 라이선스 할당 모달 */}
        {showAssignLicense && selectedUser && (
          <div className="sub-modal">
            <div className="sub-modal-content">
              <h3>라이선스 할당</h3>
              <p className="modal-subtitle">{selectedUser.email}</p>

              <div className="form-group">
                <label>할당 방식</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="assignMode"
                      checked={assignMode === 'existing'}
                      onChange={() => setAssignMode('existing')}
                    />
                    기존 라이선스 선택
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="assignMode"
                      checked={assignMode === 'direct'}
                      onChange={() => setAssignMode('direct')}
                    />
                    직접 기간 설정
                  </label>
                </div>
              </div>

              {assignMode === 'existing' ? (
                <div className="form-group">
                  <label>라이선스 선택</label>
                  <select
                    value={selectedLicenseKey}
                    onChange={(e) => setSelectedLicenseKey(e.target.value)}
                  >
                    <option value="">라이선스를 선택하세요</option>
                    {licenses
                      .filter(l => l.is_active && l.current_users < l.max_users)
                      .map((license) => (
                        <option key={license.id} value={license.license_key}>
                          {license.license_key} ({license.current_users}/{license.max_users}명, 만료: {formatDate(license.expires_at)})
                        </option>
                      ))}
                  </select>
                  {licenses.filter(l => l.is_active && l.current_users < l.max_users).length === 0 && (
                    <p className="form-hint warning">사용 가능한 라이선스가 없습니다. 새 라이선스를 생성하거나 직접 기간을 설정하세요.</p>
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <label>사용 기간 (일)</label>
                  <input
                    type="number"
                    min="1"
                    value={directExpireDays}
                    onChange={(e) => setDirectExpireDays(parseInt(e.target.value))}
                  />
                  <p className="form-hint">
                    만료일: {formatDate(new Date(Date.now() + directExpireDays * 24 * 60 * 60 * 1000).toISOString())}
                  </p>
                </div>
              )}

              <div className="sub-modal-actions">
                <button className="btn-secondary" onClick={() => setShowAssignLicense(false)}>
                  취소
                </button>
                <button className="btn-primary" onClick={handleAssignLicense}>
                  할당
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
