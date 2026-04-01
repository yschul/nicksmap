-- ============================================
-- MindMap Pro - Supabase 데이터베이스 스키마 (전체)
-- 새 환경 구축 시 이 SQL을 Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  license_key TEXT,
  license_expires_at TIMESTAMPTZ,
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 마인드맵 테이블
CREATE TABLE IF NOT EXISTS mindmaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT '새 마인드맵',
  data JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN DEFAULT FALSE,
  shared_with UUID[] DEFAULT '{}',
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 라이선스 테이블 (관리자용)
CREATE TABLE IF NOT EXISTS licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  license_key TEXT UNIQUE NOT NULL,
  max_users INTEGER DEFAULT 1,
  current_users INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 라이선스 멤버 테이블 (라이선스-사용자 매핑)
CREATE TABLE IF NOT EXISTS license_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(license_id, user_id)
);

-- 5. 협업 세션 테이블 (실시간 협업용)
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mindmap_id UUID REFERENCES mindmaps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cursor_position JSONB,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mindmap_id, user_id)
);

-- ============================================
-- 유틸리티 함수
-- ============================================

-- 관리자 체크 함수 (SECURITY DEFINER = RLS 무한참조 방지)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- profiles 테이블 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- mindmaps 테이블 RLS
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mindmaps" ON mindmaps
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY "Users can create mindmaps" ON mindmaps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared mindmaps" ON mindmaps
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY "Users can delete own mindmaps" ON mindmaps
  FOR DELETE USING (auth.uid() = user_id);

-- licenses 테이블 RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage licenses" ON licenses
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view own licenses" ON licenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM license_members
      WHERE license_members.license_id = licenses.id
      AND license_members.user_id = auth.uid()
      AND license_members.is_active = true
    )
  );

-- license_members 테이블 RLS
ALTER TABLE license_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage license members" ON license_members
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view own license membership" ON license_members
  FOR SELECT USING (auth.uid() = user_id);

-- collaboration_sessions 테이블 RLS
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON collaboration_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view sessions for shared mindmaps" ON collaboration_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM mindmaps
      WHERE id = mindmap_id AND (
        user_id = auth.uid() OR
        auth.uid() = ANY(shared_with)
      )
    )
  );

-- ============================================
-- 트리거
-- ============================================

-- 새 사용자 생성 시 프로필 자동 생성 + 라이선스 키 자동 할당
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_license_key TEXT;
  v_license RECORD;
BEGIN
  -- 메타데이터에서 라이선스 키 추출
  v_license_key := NEW.raw_user_meta_data ->> 'license_key';

  -- 프로필 생성
  INSERT INTO public.profiles (id, email, role, license_key)
  VALUES (NEW.id, NEW.email, 'user', NULL);

  -- 라이선스 키가 입력된 경우 유효성 검증 후 할당
  IF v_license_key IS NOT NULL AND v_license_key != '' THEN
    SELECT * INTO v_license
    FROM public.licenses
    WHERE license_key = v_license_key
      AND is_active = TRUE
      AND expires_at > NOW()
    LIMIT 1;

    IF v_license.id IS NOT NULL THEN
      -- license_members에 등록
      INSERT INTO public.license_members (license_id, user_id, is_active, assigned_at)
      VALUES (v_license.id, NEW.id, TRUE, NOW())
      ON CONFLICT (license_id, user_id) DO NOTHING;

      -- profiles에 라이선스 정보 반영
      UPDATE public.profiles
      SET license_key = v_license.license_key,
          license_expires_at = v_license.expires_at
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mindmaps_updated_at
  BEFORE UPDATE ON mindmaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 관리자 전용 RPC 함수
-- ============================================

-- 관리자: 사용자 비밀번호 초기화
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

  UPDATE profiles
  SET must_change_password = TRUE
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 관리자: 사용자 삭제
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

-- 사용자: 본인 비밀번호 변경
CREATE OR REPLACE FUNCTION change_own_password(new_password TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    updated_at = now()
  WHERE id = auth.uid();

  UPDATE profiles
  SET must_change_password = FALSE
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 실시간 구독 설정
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE mindmaps;
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_sessions;

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id ON mindmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_shared_with ON mindmaps USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_mindmaps_share_token ON mindmaps(share_token);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_mindmap ON collaboration_sessions(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_license_members_license ON license_members(license_id);
CREATE INDEX IF NOT EXISTS idx_license_members_user ON license_members(user_id);

-- ============================================
-- 링크 공유 기능
-- ============================================

-- share_token 컬럼 추가 (기존 테이블에 적용 시)
-- ALTER TABLE mindmaps ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- 이메일로 사용자 검색 (RLS 우회, 공유 초대용)
CREATE OR REPLACE FUNCTION find_user_by_email(target_email TEXT)
RETURNS JSON AS $$
  SELECT json_build_object('id', id, 'email', email)
  FROM profiles
  WHERE email = target_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 공개 링크로 마인드맵 조회 (RLS 우회, 읽기 전용)
CREATE OR REPLACE FUNCTION get_shared_mindmap(token TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'id', id,
    'title', title,
    'data', data,
    'user_id', user_id,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM mindmaps
  WHERE share_token = token
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
