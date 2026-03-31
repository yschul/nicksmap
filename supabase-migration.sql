-- ============================================
-- 마이그레이션: 기존 환경 → 최신 스키마 업데이트
-- 이미 운영 중인 Supabase에 이 SQL을 실행하세요
-- (새 환경은 supabase-schema.sql을 사용)
-- ============================================

-- 1. 컬럼 추가
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 2. license_members 테이블 생성
CREATE TABLE IF NOT EXISTS license_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(license_id, user_id)
);

-- 3. 관리자 체크 함수 (RLS 무한참조 방지)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. profiles RLS 수정
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- 5. license_members RLS
ALTER TABLE license_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage license members" ON license_members;
DROP POLICY IF EXISTS "Users can view own license membership" ON license_members;

CREATE POLICY "Admins can manage license members" ON license_members
  FOR ALL USING (is_admin());
CREATE POLICY "Users can view own license membership" ON license_members
  FOR SELECT USING (auth.uid() = user_id);

-- 6. licenses RLS 추가 (사용자가 소속 라이선스 조회)
DROP POLICY IF EXISTS "Users can view own licenses" ON licenses;

CREATE POLICY "Users can view own licenses" ON licenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM license_members
      WHERE license_members.license_id = licenses.id
      AND license_members.user_id = auth.uid()
      AND license_members.is_active = true
    )
  );

-- 7. 관리자 RPC 함수
CREATE OR REPLACE FUNCTION admin_reset_password(target_user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자만 비밀번호를 초기화할 수 있습니다.';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION '자기 자신의 비밀번호는 설정에서 변경하세요.';
  END IF;
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    updated_at = now(),
    raw_app_meta_data = raw_app_meta_data || '{"password_reset": true}'::jsonb
  WHERE id = target_user_id;
  UPDATE profiles SET must_change_password = TRUE WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자만 사용자를 삭제할 수 있습니다.';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION '자기 자신은 삭제할 수 없습니다.';
  END IF;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION change_own_password(new_password TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    updated_at = now()
  WHERE id = auth.uid();
  UPDATE profiles SET must_change_password = FALSE WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 인덱스
CREATE INDEX IF NOT EXISTS idx_license_members_license ON license_members(license_id);
CREATE INDEX IF NOT EXISTS idx_license_members_user ON license_members(user_id);

-- 9. 기존 데이터 마이그레이션 (profiles → license_members)
INSERT INTO license_members (license_id, user_id, is_active, assigned_at)
SELECT l.id, p.id, TRUE, NOW()
FROM profiles p
JOIN licenses l ON l.license_key = p.license_key
WHERE p.license_key IS NOT NULL
  AND NOT p.license_key LIKE 'DIRECT-%'
ON CONFLICT (license_id, user_id) DO NOTHING;
