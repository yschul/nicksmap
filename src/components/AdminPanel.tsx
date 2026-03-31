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
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Edit3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppModal } from './AppModal'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  license_key?: string
  license_expires_at?: string
  created_at: string
}

interface LicenseMember {
  id: string
  license_id: string
  user_id: string
  is_active: boolean
  assigned_at: string
  user?: User
}

interface License {
  id: string
  name?: string
  license_key: string
  max_users: number
  current_users: number
  expires_at: string
  is_active: boolean
  created_at: string
  members?: LicenseMember[]
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
  const { showAlert, showConfirm, showSuccess, showError } = useAppModal()

  // 라이선스 펼침 상태
  const [expandedLicenses, setExpandedLicenses] = useState<Set<string>>(new Set())

  // 새 라이선스 생성 폼
  const [showNewLicense, setShowNewLicense] = useState(false)
  const [newLicense, setNewLicense] = useState({
    name: '',
    maxUsers: 5,
    expiresInDays: 365,
  })

  // 사용자 라이선스 할당 모달
  const [showAssignLicense, setShowAssignLicense] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [assignMode, setAssignMode] = useState<'existing' | 'direct'>('existing')
  const [selectedLicenseKey, setSelectedLicenseKey] = useState('')
  const [directExpireDays, setDirectExpireDays] = useState(365)

  // 라이선스에 사용자 추가 모달
  const [showAddMember, setShowAddMember] = useState(false)
  const [targetLicense, setTargetLicense] = useState<License | null>(null)
  const [memberEmail, setMemberEmail] = useState('')

  // 라이선스 이름 편집
  const [editingLicenseName, setEditingLicenseName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')

  // 임시 비밀번호 표시 모달
  const [showTempPassword, setShowTempPassword] = useState(false)
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  useEffect(() => {
    loadLicenses()
  }, [])

  const loadLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // 각 라이선스의 멤버 로드
      const licensesWithMembers = await Promise.all(
        (data || []).map(async (license: License) => {
          const { data: members } = await supabase
            .from('license_members')
            .select('*')
            .eq('license_id', license.id)
            .order('assigned_at', { ascending: false })

          // 멤버별 사용자 정보 조회
          const membersWithUsers = await Promise.all(
            (members || []).map(async (member: LicenseMember) => {
              const { data: userData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', member.user_id)
                .single()
              return { ...member, user: userData }
            })
          )

          return {
            ...license,
            members: membersWithUsers,
            current_users: membersWithUsers.filter((m: LicenseMember) => m.is_active).length,
          }
        })
      )

      setLicenses(licensesWithMembers)
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
        await loadLicenses()
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
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('licenses').insert({
        name: newLicense.name || null,
        license_key: licenseKey,
        max_users: newLicense.maxUsers,
        current_users: 0,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        created_by: user?.id,
      })

      if (error) throw error

      setShowNewLicense(false)
      setNewLicense({ name: '', maxUsers: 5, expiresInDays: 365 })
      loadData()
      showSuccess(`라이선스가 생성되었습니다: ${licenseKey}`)
    } catch (err) {
      console.error('Failed to create license:', err)
      showError('라이선스 생성에 실패했습니다.')
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

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleResetPassword = async (userId: string, email: string) => {
    if (!await showConfirm(`${email} 사용자의 비밀번호를 초기화하시겠습니까?`)) return

    const tempPassword = generateTempPassword()

    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        target_user_id: userId,
        new_password: tempPassword,
      })

      if (error) throw error

      setTempPasswordInfo({ email, password: tempPassword })
      setShowTempPassword(true)
    } catch (err) {
      console.error('Failed to reset password:', err)
      showError('비밀번호 초기화에 실패했습니다.')
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!await showConfirm(`${email} 사용자를 삭제하시겠습니까?\n\n삭제하면 해당 사용자의 모든 데이터가 영구 삭제됩니다.`)) return

    try {
      const { error } = await supabase.rpc('delete_user', {
        target_user_id: userId,
      })

      if (error) throw error
      loadData()
      loadLicenses()
      showSuccess(`${email} 사용자가 삭제되었습니다.`)
    } catch (err) {
      console.error('Failed to delete user:', err)
      showError('사용자 삭제에 실패했습니다.')
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
    if (!await showConfirm('이 라이선스를 삭제하시겠습니까?\n소속된 모든 사용자의 라이선스가 해제됩니다.')) return

    try {
      // license_members는 CASCADE로 자동 삭제됨
      // 소속 사용자들의 profiles.license_key도 정리
      const license = licenses.find(l => l.id === licenseId)
      if (license?.members) {
        for (const member of license.members) {
          await supabase
            .from('profiles')
            .update({ license_key: null, license_expires_at: null })
            .eq('id', member.user_id)
        }
      }

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

  // 라이선스 이름 수정
  const handleUpdateLicenseName = async (licenseId: string) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ name: editNameValue || null })
        .eq('id', licenseId)

      if (error) throw error
      setEditingLicenseName(null)
      loadLicenses()
    } catch (err) {
      console.error('Failed to update license name:', err)
    }
  }

  // -- 사용자 탭: 라이선스 할당 --

  const openAssignLicenseModal = (user: User) => {
    setSelectedUser(user)
    setAssignMode('existing')
    setSelectedLicenseKey('')
    setDirectExpireDays(365)
    setShowAssignLicense(true)
  }

  const handleAssignLicense = async () => {
    if (!selectedUser) return

    const { data: { user: currentUser } } = await supabase.auth.getUser()

    let licenseKey = ''
    let expiresAt: Date

    if (assignMode === 'existing') {
      if (!selectedLicenseKey) {
        await showAlert('라이선스를 선택해주세요.')
        return
      }
      const license = licenses.find(l => l.license_key === selectedLicenseKey)
      if (!license) return

      const activeMembers = (license.members || []).filter(m => m.is_active).length
      if (activeMembers >= license.max_users) {
        await showAlert('이 라이선스의 최대 사용자 수에 도달했습니다.')
        return
      }

      licenseKey = license.license_key
      expiresAt = new Date(license.expires_at)

      // license_members에 추가
      const { error: memberError } = await supabase
        .from('license_members')
        .upsert({
          license_id: license.id,
          user_id: selectedUser.id,
          is_active: true,
          assigned_by: currentUser?.id,
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'license_id,user_id' })

      if (memberError) {
        console.error('Failed to add license member:', memberError)
        showError('라이선스 멤버 추가에 실패했습니다.')
        return
      }
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
      loadLicenses()
      showSuccess('라이선스가 할당되었습니다.')
    } catch (err) {
      console.error('Failed to assign license:', err)
      showError('라이선스 할당에 실패했습니다.')
    }
  }

  const handleRemoveLicense = async (user: User) => {
    if (!await showConfirm(`${user.email}의 라이선스를 해제하시겠습니까?`)) return

    try {
      // license_members에서도 제거
      if (user.license_key && !user.license_key.startsWith('DIRECT-')) {
        const license = licenses.find(l => l.license_key === user.license_key)
        if (license) {
          await supabase
            .from('license_members')
            .delete()
            .eq('license_id', license.id)
            .eq('user_id', user.id)
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
      showError('라이선스 해제에 실패했습니다.')
    }
  }

  // -- 라이선스 탭: 멤버 관리 --

  const openAddMemberModal = (license: License) => {
    setTargetLicense(license)
    setMemberEmail('')
    setShowAddMember(true)
  }

  const handleAddMember = async () => {
    if (!targetLicense || !memberEmail.trim()) return

    const { data: { user: currentUser } } = await supabase.auth.getUser()

    // 이메일로 사용자 찾기
    const { data: targetUser, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', memberEmail.trim())
      .single()

    if (findError || !targetUser) {
      await showAlert('해당 이메일의 사용자를 찾을 수 없습니다.')
      return
    }

    // 이미 이 라이선스에 등록되어 있는지 확인
    const existing = targetLicense.members?.find(m => m.user_id === targetUser.id)
    if (existing) {
      if (!existing.is_active) {
        // 비활성 상태면 재활성화
        await supabase
          .from('license_members')
          .update({ is_active: true })
          .eq('id', existing.id)
      } else {
        await showAlert('이미 이 라이선스에 등록된 사용자입니다.')
        return
      }
    } else {
      const activeMembers = (targetLicense.members || []).filter(m => m.is_active).length
      if (activeMembers >= targetLicense.max_users) {
        await showAlert('이 라이선스의 최대 사용자 수에 도달했습니다.')
        return
      }

      // license_members에 추가
      const { error: memberError } = await supabase
        .from('license_members')
        .insert({
          license_id: targetLicense.id,
          user_id: targetUser.id,
          is_active: true,
          assigned_by: currentUser?.id,
        })

      if (memberError) {
        console.error('Failed to add member:', memberError)
        showError('멤버 추가에 실패했습니다.')
        return
      }
    }

    // profiles에도 라이선스 정보 동기화
    await supabase
      .from('profiles')
      .update({
        license_key: targetLicense.license_key,
        license_expires_at: targetLicense.expires_at,
      })
      .eq('id', targetUser.id)

    setShowAddMember(false)
    setMemberEmail('')
    loadLicenses()
    showSuccess(`${memberEmail} 사용자가 추가되었습니다.`)
  }

  const handleToggleMember = async (member: LicenseMember, license: License) => {
    const newActive = !member.is_active

    try {
      const { error } = await supabase
        .from('license_members')
        .update({ is_active: newActive })
        .eq('id', member.id)

      if (error) throw error

      // profiles 동기화
      if (newActive) {
        await supabase
          .from('profiles')
          .update({
            license_key: license.license_key,
            license_expires_at: license.expires_at,
          })
          .eq('id', member.user_id)
      } else {
        await supabase
          .from('profiles')
          .update({
            license_key: null,
            license_expires_at: null,
          })
          .eq('id', member.user_id)
      }

      loadLicenses()
    } catch (err) {
      console.error('Failed to toggle member:', err)
    }
  }

  const handleRemoveMember = async (member: LicenseMember) => {
    if (!await showConfirm(`${member.user?.email || '사용자'}를 이 라이선스에서 제거하시겠습니까?`)) return

    try {
      const { error } = await supabase
        .from('license_members')
        .delete()
        .eq('id', member.id)

      if (error) throw error

      // profiles에서도 라이선스 정보 제거
      await supabase
        .from('profiles')
        .update({
          license_key: null,
          license_expires_at: null,
        })
        .eq('id', member.user_id)

      loadLicenses()
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  const toggleLicenseExpand = (licenseId: string) => {
    setExpandedLicenses(prev => {
      const next = new Set(prev)
      if (next.has(licenseId)) {
        next.delete(licenseId)
      } else {
        next.add(licenseId)
      }
      return next
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // 사용자의 라이선스 소속 정보 조회
  const getUserLicenseInfo = (user: User) => {
    for (const license of licenses) {
      const member = license.members?.find(m => m.user_id === user.id && m.is_active)
      if (member) {
        return { license, member }
      }
    }
    return null
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredLicenses = licenses.filter((license) =>
    license.license_key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    license.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isExpiredDate = (dateString: string) => {
    return new Date(dateString) < new Date()
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
            /* ===== 사용자 관리 탭 ===== */
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
                    const licenseInfo = getUserLicenseInfo(user)
                    const hasDirectLicense = user.license_key?.startsWith('DIRECT-')
                    const hasLicense = licenseInfo || hasDirectLicense || user.license_key
                    const isExpired = user.license_expires_at && isExpiredDate(user.license_expires_at)

                    return (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>
                            {user.role === 'admin' ? '관리자' : '사용자'}
                          </span>
                        </td>
                        <td>
                          {hasLicense ? (
                            <div>
                              <span className={`license-badge ${isExpired ? 'expired' : 'active'}`}>
                                {isExpired ? '만료됨' : '활성'}
                              </span>
                              {licenseInfo?.license.name && (
                                <span className="license-name-tag">
                                  {licenseInfo.license.name}
                                </span>
                              )}
                            </div>
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
                              onClick={() => handleResetPassword(user.id, user.email)}
                              title="비밀번호 초기화"
                            >
                              <KeyRound size={16} />
                            </button>
                            {hasLicense ? (
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
                            <button
                              className="btn-icon danger"
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              title="사용자 삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ===== 라이선스 관리 탭 ===== */
            <div className="license-list">
              {filteredLicenses.length === 0 ? (
                <div className="empty-state">라이선스가 없습니다</div>
              ) : (
                filteredLicenses.map((license) => {
                  const isExpanded = expandedLicenses.has(license.id)
                  const activeMembers = (license.members || []).filter(m => m.is_active).length
                  const isLicenseExpired = isExpiredDate(license.expires_at)

                  return (
                    <div key={license.id} className={`license-card ${!license.is_active ? 'disabled' : ''} ${isLicenseExpired ? 'expired' : ''}`}>
                      {/* 라이선스 헤더 */}
                      <div className="license-card-header" onClick={() => toggleLicenseExpand(license.id)}>
                        <div className="license-card-toggle">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>

                        <div className="license-card-info">
                          <div className="license-card-title">
                            {editingLicenseName === license.id ? (
                              <div className="inline-edit" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={e => setEditNameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleUpdateLicenseName(license.id)
                                    if (e.key === 'Escape') setEditingLicenseName(null)
                                  }}
                                  placeholder="라이선스 이름"
                                  autoFocus
                                />
                                <button className="btn-icon small" onClick={() => handleUpdateLicenseName(license.id)}>
                                  <Check size={14} />
                                </button>
                                <button className="btn-icon small" onClick={() => setEditingLicenseName(null)}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="license-card-name">
                                  {license.name || '이름 없음'}
                                </span>
                                <button
                                  className="btn-icon small"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingLicenseName(license.id)
                                    setEditNameValue(license.name || '')
                                  }}
                                  title="이름 편집"
                                >
                                  <Edit3 size={12} />
                                </button>
                              </>
                            )}
                          </div>

                          <div className="license-card-meta">
                            <code className="license-key-display">{license.license_key}</code>
                            <button
                              className="btn-icon small"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(license.license_key)
                              }}
                            >
                              {copiedKey === license.license_key ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <div className="license-card-stats">
                          <span className="stat-item">
                            <Users size={14} />
                            {activeMembers} / {license.max_users}명
                          </span>
                          <span className={`stat-item ${isLicenseExpired ? 'text-danger' : ''}`}>
                            <Calendar size={14} />
                            {formatDate(license.expires_at)}
                          </span>
                          <span className={`license-badge ${license.is_active && !isLicenseExpired ? 'active' : 'expired'}`}>
                            {!license.is_active ? '비활성' : isLicenseExpired ? '만료' : '활성'}
                          </span>
                        </div>

                        <div className="license-card-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleLicense(license.id, license.is_active)}
                            title={license.is_active ? '비활성화' : '활성화'}
                          >
                            {license.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDeleteLicense(license.id)}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* 펼쳐진 멤버 목록 */}
                      {isExpanded && (
                        <div className="license-card-body">
                          <div className="license-members-header">
                            <h4>소속 사용자 ({(license.members || []).length}명)</h4>
                            <button
                              className="btn-small btn-primary"
                              onClick={() => openAddMemberModal(license)}
                              disabled={activeMembers >= license.max_users}
                            >
                              <UserPlus size={14} />
                              사용자 추가
                            </button>
                          </div>

                          {(!license.members || license.members.length === 0) ? (
                            <div className="empty-members">등록된 사용자가 없습니다</div>
                          ) : (
                            <table className="admin-table members-table">
                              <thead>
                                <tr>
                                  <th>이메일</th>
                                  <th>상태</th>
                                  <th>할당일</th>
                                  <th>작업</th>
                                </tr>
                              </thead>
                              <tbody>
                                {license.members.map((member) => (
                                  <tr key={member.id} className={!member.is_active ? 'row-disabled' : ''}>
                                    <td>{member.user?.email || '알 수 없음'}</td>
                                    <td>
                                      <span className={`license-badge ${member.is_active ? 'active' : 'inactive'}`}>
                                        {member.is_active ? '활성' : '비활성'}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="date-cell">
                                        <Calendar size={14} />
                                        {formatDate(member.assigned_at)}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="action-buttons">
                                        <button
                                          className="btn-icon"
                                          onClick={() => handleToggleMember(member, license)}
                                          title={member.is_active ? '비활성화' : '활성화'}
                                        >
                                          {member.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                        </button>
                                        <button
                                          className="btn-icon danger"
                                          onClick={() => handleRemoveMember(member)}
                                          title="제거"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* 새 라이선스 생성 모달 */}
        {showNewLicense && (
          <div className="sub-modal">
            <div className="sub-modal-content">
              <h3>새 라이선스 생성</h3>

              <div className="form-group">
                <label>라이선스 이름 (선택)</label>
                <input
                  type="text"
                  value={newLicense.name}
                  onChange={(e) =>
                    setNewLicense({ ...newLicense, name: e.target.value })
                  }
                  placeholder="예: 개발팀, 마케팅팀"
                />
              </div>

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

        {/* 사용자에게 라이선스 할당 모달 */}
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
                      .filter(l => {
                        const activeMembers = (l.members || []).filter(m => m.is_active).length
                        return l.is_active && activeMembers < l.max_users && !isExpiredDate(l.expires_at)
                      })
                      .map((license) => {
                        const activeMembers = (license.members || []).filter(m => m.is_active).length
                        return (
                          <option key={license.id} value={license.license_key}>
                            {license.name ? `${license.name} - ` : ''}{license.license_key} ({activeMembers}/{license.max_users}명, 만료: {formatDate(license.expires_at)})
                          </option>
                        )
                      })}
                  </select>
                  {licenses.filter(l => l.is_active && (l.members || []).filter(m => m.is_active).length < l.max_users).length === 0 && (
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

        {/* 라이선스에 사용자 추가 모달 */}
        {showAddMember && targetLicense && (
          <div className="sub-modal">
            <div className="sub-modal-content">
              <h3>사용자 추가</h3>
              <p className="modal-subtitle">
                {targetLicense.name ? `${targetLicense.name} (${targetLicense.license_key})` : targetLicense.license_key}
              </p>

              <div className="form-group">
                <label>사용자 이메일</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMember()
                  }}
                />
                <p className="form-hint">
                  등록된 사용자의 이메일을 입력하세요.
                </p>
              </div>

              <div className="sub-modal-actions">
                <button className="btn-secondary" onClick={() => setShowAddMember(false)}>
                  취소
                </button>
                <button className="btn-primary" onClick={handleAddMember}>
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
        {/* 임시 비밀번호 표시 모달 */}
        {showTempPassword && tempPasswordInfo && (
          <div className="sub-modal">
            <div className="sub-modal-content">
              <h3>비밀번호 초기화 완료</h3>
              <p className="modal-subtitle">{tempPasswordInfo.email}</p>

              <div className="temp-password-box">
                <label>임시 비밀번호</label>
                <div className="temp-password-display">
                  <code>{tempPasswordInfo.password}</code>
                  <button
                    className="btn-icon small"
                    onClick={() => copyToClipboard(tempPasswordInfo.password)}
                    title="복사"
                  >
                    {copiedKey === tempPasswordInfo.password ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="form-hint warning">
                  이 비밀번호를 사용자에게 전달하세요. 사용자가 로그인하면 비밀번호 변경 화면이 표시됩니다.
                </p>
              </div>

              <div className="sub-modal-actions">
                <button className="btn-primary" onClick={() => {
                  setShowTempPassword(false)
                  setTempPasswordInfo(null)
                }}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
