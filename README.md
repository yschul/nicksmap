# MindMap Pro

협업 마인드맵 도구 - 실시간 협업과 오프라인 지원을 제공하는 마인드맵 애플리케이션

## 주요 기능

- 마인드맵 생성/편집 (다양한 레이아웃, 분기 스타일)
- 실시간 협업 (Supabase Realtime)
- 로컬 저장 (오프라인 지원)
- 클라우드 저장 (Supabase)
- 라이선스 관리 (오프라인 검증, 시간 조작 감지)
- 관리자 패널 (사용자/라이선스 관리, 비밀번호 초기화)
- Electron 데스크톱 앱 (Windows/Mac/Linux)
- Portable 버전 지원

---

## 설치 및 사용 방법

### 1단계: 프로그램 설치

1. `MindMap Pro Setup 1.0.0.exe` 실행
2. 설치 언어: 한국어 선택
3. 설치 경로 선택 (기본값 권장)
4. **설치** 클릭
5. 완료 후 프로그램 실행

---

### 2단계: 환경 설정 (개발자용)

프로그램이 서버와 연결되려면 `.env` 파일이 필요합니다.

프로젝트 루트에 `.env` 파일 생성:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

### 3단계: 회원가입/로그인

#### 일반 사용자
1. 프로그램 실행
2. **회원가입** 탭 클릭
3. 이메일, 비밀번호 입력
4. **가입하기** 클릭
5. 이메일 인증 (Supabase 설정에 따라)

#### 데모 모드 (서버 없이)
- **데모로 시작** 클릭
- 로컬 저장만 가능

---

### 4단계: 관리자 계정 설정

#### 방법 1: Supabase 대시보드에서

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택 → **SQL Editor**
3. 다음 SQL 실행:

```sql
-- 특정 사용자를 관리자로 변경
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

#### 방법 2: Table Editor에서

1. Supabase 대시보드 → **Table Editor**
2. `profiles` 테이블 선택
3. 해당 사용자의 `role` 값을 `admin`으로 변경

---

### 5단계: 관리자 기능 사용

관리자로 로그인하면 사이드바에 **관리자 설정** 메뉴가 나타납니다.

#### 사용자 관리

| 버튼 | 기능 |
|------|------|
| 🛡️ | 역할 변경 (관리자/사용자) |
| 🔑 | 비밀번호 초기화 |
| ➕ | 라이선스 할당 |
| ➖ | 라이선스 해제 |

#### 라이선스 관리

1. **새 라이선스** 클릭
2. 최대 사용자 수, 유효 기간 설정
3. **생성** 클릭

---

### 6단계: 사용자에게 라이선스 할당

1. **사용자 관리** 탭
2. 사용자 선택 → **➕** 버튼
3. 할당 방식 선택:
   - **기존 라이선스 선택**: 생성된 라이선스 중 선택
   - **직접 기간 설정**: 일 단위 입력 (예: 365)
4. **할당** 클릭

---

### 7단계: 라이선스 동작 확인

| 상태 | 동작 |
|------|------|
| 라이선스 있음 | 정상 사용 |
| 30일 이하 남음 | 상단에 경고 표시 |
| 만료됨 | 차단 모달 표시 |
| 관리자 | 라이선스 검증 없음 (무제한) |

---

## 전체 흐름 요약

```
┌─────────────────────────────────────────────────────────┐
│ 1. 관리자가 Supabase에서 본인 계정을 admin으로 설정     │
│ 2. 관리자 로그인 → 라이선스 생성                        │
│ 3. 사용자 회원가입                                      │
│ 4. 관리자가 사용자에게 라이선스 할당                    │
│ 5. 사용자 로그인 → 라이선스 검증 → 사용 가능            │
│ 6. 오프라인에서도 만료일까지 사용 가능                  │
└─────────────────────────────────────────────────────────┘
```

---

## 개발 환경 설정

### 필수 요구사항

- Node.js 18+
- npm 9+

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
# 웹 빌드
npm run build

# Windows 데스크톱 앱 빌드
npm run electron:build:win

# macOS 데스크톱 앱 빌드
npm run electron:build:mac

# Linux 데스크톱 앱 빌드
npm run electron:build:linux
```

### 빌드 결과물

```
release/
├── MindMap Pro Setup 1.0.0.exe   # Windows 설치 파일
├── MindMapPro-Portable.exe       # Windows Portable 버전
└── win-unpacked/                 # 압축 안 된 버전
```

---

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite
- **Mind Map**: simple-mind-map
- **Backend**: Supabase (Auth, Database, Realtime)
- **Desktop**: Electron
- **Icons**: Lucide React

---

## 데이터베이스 스키마

Supabase SQL Editor에서 `supabase-schema.sql` 파일 내용을 실행하세요.

주요 테이블:
- `profiles`: 사용자 프로필 (역할, 라이선스 정보)
- `mindmaps`: 마인드맵 데이터
- `licenses`: 라이선스 관리

---

## 라이선스

MIT License
