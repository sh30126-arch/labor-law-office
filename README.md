# 노동법률사무소 이해 홈페이지

노동법률사무소 이해의 공식 홈페이지를 리디자인한 정적 웹사이트입니다. 부당해고·임금체불·퇴직금·산재·직장 내 괴롭힘 등 노동 관련 상담을 안내하며, **24시간 AI 노무 상담 챗(Google Gemini 기반)** 기능을 함께 제공합니다.

> 본 사이트는 일반 시민과 근로자가 손쉽게 노무 정보를 얻을 수 있도록 안내하는 참고용 도구입니다. 정확한 자문은 반드시 전문 노무사와의 상담을 권장합니다.

---

## 주요 특징

- **빌드 도구 없음** — 순수 HTML/CSS/JavaScript로만 구성. 어떤 정적 호스팅(GitHub Pages, Netlify, Vercel)에도 그대로 올라갑니다.
- **반응형 디자인** — 데스크톱·태블릿·모바일 모두 지원.
- **AI 상담 챗** — 사용자가 본인의 Google Gemini API 키를 입력하면 동작. 키는 **브라우저 localStorage에만 저장**되고 외부 서버로 전송되지 않습니다.
- **3D Process 섹션** — sticky pin 스크롤 효과로 상담 진행 단계를 시각화.

---

## 페이지 구성 (9섹션)

| # | 섹션 | 내용 |
|---|------|------|
| 1 | 고정 상단 헤더 | 로고 + 네비게이션 (스무스 스크롤) |
| 2 | Hero | 메인 비주얼 + 핵심 메시지 |
| 3 | About / 철학 | 사무소 철학 인용 박스 |
| 4 | Practice Areas | 업무 분야 (번호형 골드 강조) |
| 5 | Process | sticky pin 3D 스크롤 단계 안내 |
| 6 | 대표 노무사 | 약력·전문분야 소개 |
| 7 | Insights / 칼럼 | 노동법 관련 칼럼 카드 |
| 8 | Contact | 연락처·오시는 길 + AI 상담 챗 모달 |
| 9 | Footer | 면책 조항·연락처 |

---

## 기술 스택

- **HTML5 / CSS3 / Vanilla JavaScript** (프레임워크 없음)
- **Pretendard** — 한글 웹폰트 (CDN 로드)
- **Google Gemini API** — AI 상담 챗 (사용자 키 직접 사용)

---

## 디렉토리 구조

```
labor-law-office/
├── index.html          # 메인 페이지 (9섹션 구조 + 챗 모달)
├── styles.css          # 전체 스타일시트 (CSS 변수 기반 디자인 시스템)
├── js/
│   ├── app.js          # 화면 동작 컨트롤러
│   ├── gemini-api.js   # Google Gemini API 호출 모듈
│   ├── modal.js        # 상담 챗 모달 제어
│   └── scroll-fx.js    # sticky pin·스크롤 애니메이션
├── assets/             # 이미지·아이콘 (정적 리소스)
├── spec.md             # 디자인·구현 사양서
├── README.md           # 본 문서
└── .gitignore
```

---

## 로컬 실행 방법

### 방법 A — `index.html` 더블클릭 (가장 쉬움)

Finder에서 `index.html` 파일을 더블클릭하면 기본 브라우저로 열립니다. 다만 일부 브라우저는 `file://` 환경에서 fetch 요청을 제한할 수 있어, AI 챗이 안 되면 **방법 B**를 사용하세요.

### 방법 B — 로컬 서버 (권장)

터미널에서 프로젝트 폴더로 이동한 뒤:

```bash
python3 -m http.server 8080
```

브라우저에서 다음 주소를 열면 됩니다.

```
http://localhost:8080
```

종료할 때는 터미널에서 `Ctrl + C`.

---

## AI 상담 챗 사용 방법 (선택)

AI 노무 상담 챗을 쓰려면 사용자가 직접 Google Gemini API 키를 발급받아 입력해야 합니다.

### Gemini API 키 발급

1. https://aistudio.google.com/app/apikey 접속
2. Google 계정으로 로그인
3. **Create API key** 버튼 클릭
4. 발급된 키 (예: `AIzaSy...`로 시작) 복사
5. 사이트의 챗 모달에서 API 키 입력란에 붙여넣고 저장

키는 브라우저의 `localStorage`에만 저장되며, 다른 기기·브라우저에서는 다시 입력해야 합니다.

> **주의 — API 키는 비밀번호처럼 다루세요.**
> - 화면 캡처를 SNS·메신저로 공유하지 마세요.
> - 무료 한도를 초과하면 과금될 수 있습니다. AI Studio 사용량 페이지를 주기적으로 확인하세요.
> - 노출 의심 시 즉시 키를 삭제하고 새로 발급받으세요.

---

## 배포 방법

본 리포는 정적 사이트라 어떤 정적 호스팅 서비스에도 그대로 올릴 수 있습니다. 추후 본격 배포 시 옵션:

### 옵션 1 — GitHub Pages (무료)

리포 **Settings → Pages → Source: `main` / `(root)`** 선택 후 저장. 1~2분 후 `https://sh30126-arch.github.io/leehae-labor-law-office/` 에서 접속 가능.

> 단, 현재는 비공개(private) 리포라 Pages 활성화 시 GitHub 유료 플랜이 필요할 수 있습니다. 공개 전환 또는 Netlify/Vercel 사용을 권장합니다.

### 옵션 2 — Netlify Drop (드래그 앤 드롭)

https://app.netlify.com/drop 에 프로젝트 폴더를 통째로 드래그하면 즉시 임시 URL이 발급됩니다.

### 옵션 3 — Vercel

```bash
npm i -g vercel
vercel
```

GitHub 리포를 연결하면 push마다 자동 배포됩니다.

---

## 커스터마이징 안내

- **사무소 이름·연락처 변경**: `index.html` 의 `<header>` 및 `<footer>` 영역
- **색상·폰트 변경**: `styles.css` 상단의 CSS 변수 (`:root { --ink, --gold, --paper, ... }`)
- **AI 답변 톤 변경**: `js/gemini-api.js` 의 `SYSTEM_PROMPT` 상수
- **Gemini 모델 교체**: `js/gemini-api.js` 상단의 모델명 상수 수정

---

## 면책 조항

> 본 서비스의 AI 상담은 **참고용 안내**이며, 법률 자문이 아닙니다.
> 정확한 노무 자문은 전문 노무사 또는 변호사와의 직접 상담을 권장합니다.
> 본 사이트의 답변에 의존하여 발생한 어떠한 결과에 대해서도 운영자는 책임지지 않습니다.
