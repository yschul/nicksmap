-- ============================================
-- 공유받은 사용자도 마인드맵 수정 및 재공유 가능하도록 RLS 정책 업데이트
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 기존 업데이트 정책 삭제
DROP POLICY IF EXISTS "Users can update own mindmaps" ON mindmaps;

-- 새 업데이트 정책: 소유자 또는 공유받은 사용자 모두 수정 가능
CREATE POLICY "Users can update own or shared mindmaps" ON mindmaps
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = ANY(shared_with)
  );
