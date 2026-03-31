-- ============================================
-- 회원가입 시 라이선스 키 자동 할당 수정
-- Supabase SQL Editor에서 실행하세요
-- ============================================

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
