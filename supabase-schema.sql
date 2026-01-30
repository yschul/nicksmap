-- Supabase 데이터베이스 스키마
-- 이 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  license_key TEXT,
  license_expires_at TIMESTAMPTZ,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 라이선스 테이블 (관리자용)
CREATE TABLE IF NOT EXISTS licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  max_users INTEGER DEFAULT 1,
  current_users INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 협업 세션 테이블 (실시간 협업용)
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mindmap_id UUID REFERENCES mindmaps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cursor_position JSONB,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mindmap_id, user_id)
);

-- RLS (Row Level Security) 정책 설정

-- profiles 테이블 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- mindmaps 테이블 RLS
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mindmaps" ON mindmaps
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY "Users can create mindmaps" ON mindmaps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mindmaps" ON mindmaps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mindmaps" ON mindmaps
  FOR DELETE USING (auth.uid() = user_id);

-- licenses 테이블 RLS (관리자만 접근)
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage licenses" ON licenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

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

-- 트리거: 새 사용자 생성 시 프로필 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 트리거: updated_at 자동 업데이트
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

-- 실시간 구독을 위한 publication 설정
ALTER PUBLICATION supabase_realtime ADD TABLE mindmaps;
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_sessions;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id ON mindmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_shared_with ON mindmaps USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_mindmap ON collaboration_sessions(mindmap_id);
