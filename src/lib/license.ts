// 오프라인 라이선스 검증 유틸리티 (AES-256-GCM + HMAC-SHA256)
const LICENSE_STORAGE_KEY = 'mindmap_license_data'
const LAST_TIME_KEY = 'mindmap_last_used_time'

const SECRET_KEY = import.meta.env.VITE_LICENSE_SECRET || 'MindMapPro2024DefaultFallbackKey!'

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

// --- Web Crypto 기반 암호화 ---

const getKeyMaterial = async (): Promise<CryptoKey> => {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
}

const deriveKey = async (salt: Uint8Array): Promise<CryptoKey> => {
  const keyMaterial = await getKeyMaterial()
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

const encrypt = async (text: string): Promise<string> => {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(salt)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  )

  // salt(16) + iv(12) + ciphertext → Base64
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)

  return btoa(String.fromCharCode(...combined))
}

const decrypt = async (encoded: string): Promise<string> => {
  try {
    const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const ciphertext = combined.slice(28)

    const key = await deriveKey(salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

// --- HMAC-SHA256 서명 ---

const createSignature = async (data: Omit<LicenseData, 'signature'>): Promise<string> => {
  const enc = new TextEncoder()
  const payload = `${data.userId}|${data.email}|${data.licenseKey}|${data.expiresAt}|${SECRET_KEY}`

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const verifySignature = async (data: LicenseData): Promise<boolean> => {
  const expected = await createSignature({
    userId: data.userId,
    email: data.email,
    licenseKey: data.licenseKey,
    expiresAt: data.expiresAt,
    lastVerified: data.lastVerified,
  })
  return data.signature === expected
}

// --- 라이선스 저장/로드/삭제 ---

export const saveLicense = async (
  userId: string,
  email: string,
  licenseKey: string,
  expiresAt: string
): Promise<void> => {
  const now = new Date().toISOString()

  const licenseData: Omit<LicenseData, 'signature'> = {
    userId,
    email,
    licenseKey,
    expiresAt,
    lastVerified: now,
  }

  const signature = await createSignature(licenseData)
  const fullData: LicenseData = { ...licenseData, signature }

  const encrypted = await encrypt(JSON.stringify(fullData))
  localStorage.setItem(LICENSE_STORAGE_KEY, encrypted)
  localStorage.setItem(LAST_TIME_KEY, now)
}

export const loadLicense = async (): Promise<LicenseData | null> => {
  try {
    const encrypted = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (!encrypted) return null

    const decrypted = await decrypt(encrypted)
    if (!decrypted) return null

    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

export const clearLicense = (): void => {
  localStorage.removeItem(LICENSE_STORAGE_KEY)
  localStorage.removeItem(LAST_TIME_KEY)
}

// --- 시간 조작 감지 ---

const detectTimeManipulation = (): { isManipulated: boolean; reason?: string } => {
  const lastUsedStr = localStorage.getItem(LAST_TIME_KEY)
  if (!lastUsedStr) {
    return { isManipulated: false }
  }

  const lastUsed = new Date(lastUsedStr)
  const now = new Date()

  const hourInMs = 60 * 60 * 1000
  if (now.getTime() < lastUsed.getTime() - hourInMs) {
    return {
      isManipulated: true,
      reason: `시스템 시간이 과거로 변경되었습니다. (마지막 사용: ${lastUsed.toLocaleString()})`,
    }
  }

  return { isManipulated: false }
}

export const updateLastUsedTime = (): void => {
  localStorage.setItem(LAST_TIME_KEY, new Date().toISOString())
}

// --- 라이선스 검증 (앱 시작 시) ---

export const verifyLicense = async (): Promise<LicenseStatus> => {
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
  const license = await loadLicense()
  if (!license) {
    return {
      isValid: false,
      daysRemaining: 0,
      message: '라이선스 정보가 없습니다. 로그인이 필요합니다.',
    }
  }

  // 3. 서명 검증 (위변조 체크)
  if (!await verifySignature(license)) {
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

// --- 온라인 라이선스 갱신 ---

export const refreshLicense = async (
  supabase: any,
  userId: string
): Promise<LicenseStatus> => {
  try {
    // 1. 프로필 기본 정보 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, license_key, license_expires_at')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return {
        isValid: false,
        daysRemaining: 0,
        message: '사용자 정보를 가져올 수 없습니다.',
      }
    }

    // 2. license_members에서 활성 멤버십 조회
    const { data: membership } = await supabase
      .from('license_members')
      .select('*, licenses(*)')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (membership && membership.length > 0) {
      const activeMembership = membership.find(
        (m: any) => m.licenses?.is_active && new Date(m.licenses.expires_at) > new Date()
      )

      if (activeMembership) {
        const license = activeMembership.licenses
        if (profile.license_key !== license.license_key) {
          await supabase
            .from('profiles')
            .update({
              license_key: license.license_key,
              license_expires_at: license.expires_at,
            })
            .eq('id', userId)
        }

        await saveLicense(userId, profile.email, license.license_key, license.expires_at)
        return verifyLicense()
      }
    }

    // 3. profiles에 라이선스 정보가 있는 경우 (직접 할당 또는 하위 호환)
    if (profile.license_key && profile.license_expires_at) {
      await saveLicense(userId, profile.email, profile.license_key, profile.license_expires_at)
      return verifyLicense()
    }

    // 4. 라이선스가 없는 경우
    clearLicense()
    return {
      isValid: false,
      daysRemaining: 0,
      message: '할당된 라이선스가 없습니다. 관리자에게 문의하세요.',
    }
  } catch (err) {
    console.error('License refresh failed:', err)
    return verifyLicense()
  }
}

// --- UI 표시용 ---

export const getLicenseInfo = async (): Promise<{
  email?: string
  licenseKey?: string
  expiresAt?: string
  lastVerified?: string
} | null> => {
  const license = await loadLicense()
  if (!license) return null

  return {
    email: license.email,
    licenseKey: license.licenseKey,
    expiresAt: license.expiresAt,
    lastVerified: license.lastVerified,
  }
}
