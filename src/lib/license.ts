// 오프라인 라이선스 검증 유틸리티
const LICENSE_STORAGE_KEY = 'mindmap_license_data'
const LAST_TIME_KEY = 'mindmap_last_used_time'

// 간단한 암호화 (실제 프로덕션에서는 더 강력한 암호화 사용 권장)
const SECRET_KEY = 'MindMapPro2024SecretKey!'

export interface LicenseData {
  userId: string
  email: string
  licenseKey: string
  expiresAt: string
  lastVerified: string
  signature: string
}

export interface LicenseStatus {
  isValid: boolean
  daysRemaining: number
  message: string
  expiresAt?: Date
}

// 간단한 XOR 기반 암호화 (실제로는 AES 등 사용 권장)
const encrypt = (text: string): string => {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
    )
  }
  return btoa(result) // Base64 인코딩
}

const decrypt = (encoded: string): string => {
  try {
    const text = atob(encoded) // Base64 디코딩
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
      )
    }
    return result
  } catch {
    return ''
  }
}

// 서명 생성 (위변조 방지)
const createSignature = (data: Omit<LicenseData, 'signature'>): string => {
  const payload = `${data.userId}|${data.email}|${data.licenseKey}|${data.expiresAt}|${SECRET_KEY}`
  // 간단한 해시 (실제로는 HMAC-SHA256 등 사용)
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

// 서명 검증
const verifySignature = (data: LicenseData): boolean => {
  const expectedSignature = createSignature({
    userId: data.userId,
    email: data.email,
    licenseKey: data.licenseKey,
    expiresAt: data.expiresAt,
    lastVerified: data.lastVerified,
  })
  return data.signature === expectedSignature
}

// 라이선스 저장 (로그인 성공 시 호출)
export const saveLicense = (
  userId: string,
  email: string,
  licenseKey: string,
  expiresAt: string
): void => {
  const now = new Date().toISOString()

  const licenseData: Omit<LicenseData, 'signature'> = {
    userId,
    email,
    licenseKey,
    expiresAt,
    lastVerified: now,
  }

  const signature = createSignature(licenseData)
  const fullData: LicenseData = { ...licenseData, signature }

  // 암호화하여 저장
  const encrypted = encrypt(JSON.stringify(fullData))
  localStorage.setItem(LICENSE_STORAGE_KEY, encrypted)

  // 마지막 사용 시간 저장
  localStorage.setItem(LAST_TIME_KEY, now)
}

// 라이선스 불러오기
export const loadLicense = (): LicenseData | null => {
  try {
    const encrypted = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (!encrypted) return null

    const decrypted = decrypt(encrypted)
    if (!decrypted) return null

    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

// 라이선스 삭제 (로그아웃 시)
export const clearLicense = (): void => {
  localStorage.removeItem(LICENSE_STORAGE_KEY)
  localStorage.removeItem(LAST_TIME_KEY)
}

// 시간 조작 감지
const detectTimeManipulation = (): { isManipulated: boolean; reason?: string } => {
  const lastUsedStr = localStorage.getItem(LAST_TIME_KEY)
  if (!lastUsedStr) {
    return { isManipulated: false }
  }

  const lastUsed = new Date(lastUsedStr)
  const now = new Date()

  // 현재 시간이 마지막 사용 시간보다 1시간 이상 과거면 조작으로 간주
  const hourInMs = 60 * 60 * 1000
  if (now.getTime() < lastUsed.getTime() - hourInMs) {
    return {
      isManipulated: true,
      reason: `시스템 시간이 과거로 변경되었습니다. (마지막 사용: ${lastUsed.toLocaleString()})`
    }
  }

  // 마지막 사용 시간으로부터 1년 이상 지났으면 의심
  const yearInMs = 365 * 24 * 60 * 60 * 1000
  if (now.getTime() > lastUsed.getTime() + yearInMs) {
    // 이 경우는 정상적일 수 있으므로 경고만
    console.warn('마지막 사용으로부터 1년 이상 경과했습니다.')
  }

  return { isManipulated: false }
}

// 마지막 사용 시간 업데이트
export const updateLastUsedTime = (): void => {
  localStorage.setItem(LAST_TIME_KEY, new Date().toISOString())
}

// 라이선스 검증 (앱 시작 시 호출)
export const verifyLicense = (): LicenseStatus => {
  // 1. 시간 조작 감지
  const timeCheck = detectTimeManipulation()
  if (timeCheck.isManipulated) {
    return {
      isValid: false,
      daysRemaining: 0,
      message: timeCheck.reason || '시스템 시간 오류가 감지되었습니다.',
    }
  }

  // 2. 라이선스 데이터 불러오기
  const license = loadLicense()
  if (!license) {
    return {
      isValid: false,
      daysRemaining: 0,
      message: '라이선스 정보가 없습니다. 로그인이 필요합니다.',
    }
  }

  // 3. 서명 검증 (위변조 체크)
  if (!verifySignature(license)) {
    return {
      isValid: false,
      daysRemaining: 0,
      message: '라이선스 정보가 손상되었습니다. 다시 로그인해주세요.',
    }
  }

  // 4. 만료일 확인
  const now = new Date()
  const expiresAt = new Date(license.expiresAt)
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining <= 0) {
    return {
      isValid: false,
      daysRemaining: 0,
      message: `라이선스가 만료되었습니다. (만료일: ${expiresAt.toLocaleDateString()})`,
      expiresAt,
    }
  }

  // 5. 마지막 사용 시간 업데이트
  updateLastUsedTime()

  // 6. 만료 임박 경고
  let message = '라이선스가 유효합니다.'
  if (daysRemaining <= 7) {
    message = `라이선스가 ${daysRemaining}일 후 만료됩니다.`
  } else if (daysRemaining <= 30) {
    message = `라이선스 만료까지 ${daysRemaining}일 남았습니다.`
  }

  return {
    isValid: true,
    daysRemaining,
    message,
    expiresAt,
  }
}

// 온라인 시 라이선스 갱신 (서버와 동기화)
export const refreshLicense = async (
  supabase: any,
  userId: string
): Promise<LicenseStatus> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('license_key, license_expires_at, email')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return {
        isValid: false,
        daysRemaining: 0,
        message: '라이선스 정보를 가져올 수 없습니다.',
      }
    }

    // 라이선스가 없는 경우
    if (!data.license_key || !data.license_expires_at) {
      clearLicense()
      return {
        isValid: false,
        daysRemaining: 0,
        message: '할당된 라이선스가 없습니다. 관리자에게 문의하세요.',
      }
    }

    // 라이선스 정보 로컬 저장
    saveLicense(userId, data.email, data.license_key, data.license_expires_at)

    // 검증 후 반환
    return verifyLicense()
  } catch (err) {
    console.error('License refresh failed:', err)
    // 오프라인이면 로컬 라이선스로 검증
    return verifyLicense()
  }
}

// 라이선스 정보 가져오기 (UI 표시용)
export const getLicenseInfo = (): {
  email?: string
  licenseKey?: string
  expiresAt?: string
  lastVerified?: string
} | null => {
  const license = loadLicense()
  if (!license) return null

  return {
    email: license.email,
    licenseKey: license.licenseKey,
    expiresAt: license.expiresAt,
    lastVerified: license.lastVerified,
  }
}
