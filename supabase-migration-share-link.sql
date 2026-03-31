-- ============================================
-- 링크 공유 기능 마이그레이션
-- 기존 환경에서 이 SQL을 Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. mindmaps 테이블에 share_token 컬럼 추가
ALTER TABLE mindmaps ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- 2. share_token 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_mindmaps_share_token ON mindmaps(share_token);

-- 3. 공개 링크로 마인드맵 조회 함수 (RLS 우회, 읽기 전용)
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
