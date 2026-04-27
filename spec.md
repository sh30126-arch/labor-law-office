# 노동법률사무소 "이해" 홈페이지 리디자인 명세서

> **이 문서는 단일 진실원(Single Source of Truth)이다.**
> HTML 빌더 / CSS 디자이너 / JS 개발자는 이 문서에 적힌 값을 그대로 사용한다.
> 가설·대안·"또는"은 없다. 모든 값은 결정되어 있다.

---

## 0. 프로젝트 메타

| 항목 | 값 |
|---|---|
| 사무소 한글명 | 노동법률사무소 이해 |
| 영문 워드마크 | `leehae` (소문자, sans-serif) |
| 도메인 톤 | 신뢰감 있는 블루, 보수적이지만 모던한 Apple-스타일 |
| 운영자 | 와이프(노무사) — 일반 시민·근로자 대상 |
| AI 챗 위치 | 우측 하단 floating 버튼 + 모달 (Google Gemini 기반) |
| 외부 라이브러리 | 금지 (Pretendard CDN 1개만 허용) |
| 주석 언어 | 한국어 (초보자 친화) |

---

## 1. 컬러 시스템

CSS `:root`에 그대로 박아 넣을 변수. `hex` 값은 결정되어 있다.

```css
:root {
  /* 다크 톤 */
  --ink: #0A1628;          /* 메인 다크. 거의 검정에 가까운 네이비. Hero·다크 섹션 본문 텍스트 위에 깔리는 베이스 */
  --ink-soft: #122238;     /* 다크 섹션의 카드/보조 배경. --ink 보다 한 단계 밝음 */

  /* 라이트 톤 */
  --paper: #FCFCFD;        /* 메인 라이트. 거의 흰색, 약간의 따뜻한 끼 */
  --paper-soft: #F4F6FA;   /* 라이트 섹션 보조 배경 (예: About 인용 박스 뒤) */

  /* 브랜드 블루 (IBM/삼성 SDS 톤의 conservative blue) */
  --primary: #1E40AF;      /* 브랜드 블루. CTA·링크·강조. 형광X, 깊은 신뢰 톤 */
  --primary-soft: #2952C8; /* 호버·active 상태. --primary 대비 한 단계 밝음 */

  /* 포인트 (골드 — Practice Areas 번호, 다크 섹션 강조 텍스트) */
  --accent: #C8A961;       /* 차분한 골드. 다크 배경에서만 사용 */

  /* 회색 텍스트·보조 */
  --silver: #6B7280;       /* 본문 보조 텍스트, 캡션 */
  --line: #E5E7EB;         /* 라이트 섹션 구분선 */
  --line-dark: #1E3050;    /* 다크 섹션 구분선 */
}
```

**사용 규칙**
- CTA 버튼 배경 = `--primary` / 호버 시 `--primary-soft`
- 다크 섹션의 본문 = `#FFFFFF` 90% (= `rgba(255,255,255,0.9)`), 보조 = 60%
- 라이트 섹션의 본문 = `--ink`, 보조 = `--silver`
- `--accent`는 **다크 배경에서만** 사용 (라이트에서는 가독성 떨어짐)

---

## 2. 타이포그래피

### 2.1 폰트

```html
<!-- <head> 안 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
```

```css
:root {
  --font-sans: "Pretendard", -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --font-mark: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; /* leehae 워드마크 전용 */
}

body {
  font-family: var(--font-sans);
  font-feature-settings: "ss06" on; /* Pretendard 한글 가독성 옵션 */
}
```

### 2.2 사이즈 스케일 (clamp)

```css
:root {
  --fs-display: clamp(2.75rem, 6vw, 5.5rem);   /* Hero 메인 헤드라인 */
  --fs-h1: clamp(2.25rem, 4.5vw, 3.75rem);     /* 섹션 타이틀 */
  --fs-h2: clamp(1.75rem, 3vw, 2.5rem);        /* 서브 타이틀 */
  --fs-h3: clamp(1.25rem, 2vw, 1.5rem);        /* 카드 타이틀 */
  --fs-lead: clamp(1.125rem, 1.6vw, 1.375rem); /* 리드 문장 */
  --fs-body: 1rem;                              /* 본문 (16px) */
  --fs-small: 0.9375rem;                        /* 보조 (15px) */
  --fs-caption: 0.8125rem;                      /* 캡션 (13px) */
  --fs-mark: 1.125rem;                          /* leehae 워드마크 (헤더) */
}
```

### 2.3 weight·line-height·letter-spacing

| 용도 | weight | line-height | letter-spacing |
|---|---|---|---|
| Display (Hero) | 800 | 1.1 | -0.03em |
| H1 (섹션 타이틀) | 700 | 1.2 | -0.02em |
| H2 | 700 | 1.3 | -0.015em |
| H3 (카드 타이틀) | 700 | 1.4 | -0.01em |
| Lead | 500 | 1.6 | -0.005em |
| Body | 400 | 1.75 | 0 |
| Small / Caption | 400 | 1.6 | 0 |
| 한글 헤드라인 | 800 | 1.25 | -0.04em |
| 영문 워드마크 `leehae` | 500 | 1 | -0.02em |

**weight 사용 가능 값:** `400 / 500 / 700 / 800` (그 외 weight 금지 — 화면 일관성)

---

## 3. Spacing scale (8px base)

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --space-10: 128px;
  --space-11: 160px;
  --space-12: 200px;

  /* 섹션 상하 여백 (반응형) */
  --section-py: clamp(80px, 12vw, 160px);
  --container-px: clamp(20px, 5vw, 48px);
  --container-max: 1200px;
}
```

**컨테이너 규칙**
```css
.container {
  width: 100%;
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--container-px);
}
```

---

## 4. CSS 클래스 네이밍 규칙 (BEM-라이트)

**확정: BEM-라이트 사용.**

```
.block               /* 블록 (=섹션 또는 컴포넌트) */
.block__element      /* 자식 요소 */
.block--modifier     /* 변형 */
.block__element--mod /* 자식 요소의 변형 */
```

**예시**
```html
<section class="hero hero--dark">
  <div class="hero__inner container">
    <h1 class="hero__title">한 사람을 이해합니다</h1>
    <p class="hero__lead">…</p>
    <a class="btn btn--primary btn--lg" href="#contact">상담 신청</a>
  </div>
</section>
```

**전역 재사용 클래스 (블록과 무관, 유틸리티 최소화)**
- `.container` — 컨테이너 폭 제어
- `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--lg`, `.btn--sm` — 버튼
- `.reveal`, `.reveal.is-revealed` — 스크롤 인터랙션
- `.is-dark`, `.is-light` — 섹션 테마 보조
- `.sr-only` — 스크린리더 전용

---

## 5. 8개 섹션 와이어프레임 + 카피

> 각 섹션은 `<section>` 태그로 감싸고, 첫 자식은 `.<block>__inner.container` 로 폭을 제어한다.

상세 와이어프레임은 본 spec의 v1.0 기준으로 9개 섹션(헤더·Hero·About·Practice·Process·Profile·Insights·Contact·Footer)을 다룬다.
구현된 index.html / styles.css 가 이 spec의 모든 결정값을 반영하고 있으니, 변경이 필요하면 spec → 코드 순으로 갱신할 것.

---

## 6. AI 챗 모달 명세

### 6.1 Floating 버튼 `.chatbot-fab`

| 항목 | 값 |
|---|---|
| 위치 | `position: fixed; right: 24px; bottom: 24px; z-index: 90` |
| 크기 | 데스크톱 64px × 64px, 모바일 56px × 56px (원형) |
| 배경 | `--primary`, 호버 시 `--primary-soft` |
| 그림자 | `0 12px 28px -8px rgba(30, 64, 175, 0.45)` |
| 아이콘 | 인라인 SVG 말풍선 (24px, `#FFFFFF`) |
| 라벨 | `aria-label="AI 노무 상담 열기"` (시각 숨김) |
| 호버 | 우측에 라벨 칩 슬라이드 표시 — 텍스트: `AI 노무 상담` (`--ink` 텍스트, 흰 배경 칩, 그림자) |
| 클릭 | `.chatbot-modal--open` 클래스 토글 |

**모바일 동작:** Hero 영역 통과 후(`scrollY > 80vh`)부터 표시. 그 전에는 `opacity: 0; pointer-events: none`. 이유 — Hero CTA와 시각 충돌 방지.

### 6.2 모달 `.chatbot-modal`

| 항목 | 값 |
|---|---|
| 위치 | `position: fixed; inset: 0; z-index: 110` |
| 배경 오버레이 | `rgba(10, 22, 40, 0.45)` + `backdrop-filter: blur(8px)` |
| 모달 박스 위치 | 데스크톱: `right: 24px; bottom: 96px;` 우측 하단 고정 (FAB 위로 띄움) / 모바일: 화면 중앙 + 좌우 16px 마진 |
| 모달 박스 크기 | 데스크톱 `width: 420px; height: 640px`, 모바일 `width: calc(100vw - 32px); height: calc(100vh - 96px)` |
| 배경 | `#FFFFFF` |
| border-radius | 24px |
| 그림자 | `0 40px 80px -20px rgba(10,22,40,0.4)` |

**진입 애니메이션:** `opacity 0→1` (220ms ease) + `transform: translateY(24px) scale(0.98) → translateY(0) scale(1)` (320ms cubic-bezier(0.16, 1, 0.3, 1))
**퇴장 애니메이션:** 위 역순, 200ms

**닫는 방법 (3가지 모두 활성):**
1. 모달 헤더 우측 X 버튼 클릭
2. 키보드 `Esc`
3. 배경 오버레이 클릭 (모달 박스 내부 클릭은 전파 차단)

### 6.3 보존 필수 DOM IDs (JS 개발자가 의존, 변경 금지)
- `#api-key-section` — 키 입력 영역 wrapper
- `#api-key-input` — `<input type="password">`
- `#api-key-save-btn` — 저장 버튼
- `#chat-container` — 채팅 영역 wrapper
- `#chat-messages` — 메시지 리스트 컨테이너
- `#chat-form` — 입력 폼
- `#chat-input` — 사용자 입력
- `#chat-send-btn` — 전송 버튼

**메시지 버블 스타일**
- 사용자 버블: 우측 정렬, 배경 `--primary`, 글자 `#FFFFFF`, border-radius `16px 16px 4px 16px`
- AI 버블: 좌측 정렬, 배경 `--paper-soft`, 글자 `--ink`, border-radius `16px 16px 16px 4px`
- 메시지 간 gap `var(--space-3)`, 패딩 `var(--space-3) var(--space-4)`
- max-width 80%

---

## 7. 스크롤 인터랙션 명세

### 7.1 IntersectionObserver `.reveal → .reveal.is-revealed`

**대상:** Hero 제외 모든 섹션의 주요 텍스트·카드 블록 (`.about__quote`, `.about__body`, `.practice__card`, `.profile__bio > *`, `.insights__card`, `.contact__info > *`)에 `.reveal` 클래스 부여.

**Observer 설정**
- `threshold: 0.15`
- `rootMargin: "0px 0px -10% 0px"` (뷰포트 하단에서 10% 일찍 트리거)
- 한 번 활성화되면 unobserve (재진입 시 다시 페이드 금지 — 산만함)

**카드 그리드의 stagger:** 같은 그리드 내 카드는 `transition-delay: calc(var(--i) * 80ms)` 적용. JS는 NodeList 순회하며 `style.setProperty('--i', index)` 설정.

### 7.2 Process sticky pin 매핑

**JS 진행도 계산**
```js
const rect = section.getBoundingClientRect();
const total = section.offsetHeight - window.innerHeight;
const scrolled = Math.min(Math.max(-rect.top, 0), total);
const progress = scrolled / total; // 0 ~ 1
```

**단계별 활성 매핑 (확정값)**

| progress 구간 | active stage |
|---|---|
| 0.00 ~ 0.25 | 1 |
| 0.25 ~ 0.50 | 2 |
| 0.50 ~ 0.75 | 3 |
| 0.75 ~ 1.00 | 4 |

### 7.3 헤더 transparent → opaque 임계값

**확정값:** `window.scrollY > 80` 시 `.header` 에 `.header--solid` 토글
- `--transparent`: 배경 transparent, 텍스트 흰색
- `--solid`: 배경 `rgba(252, 252, 253, 0.92)` + `backdrop-filter: blur(16px)`, 텍스트 `--ink`, 하단 1px `--line` 보더
- transition: `background 220ms ease, color 220ms ease`

스크롤 이벤트는 `requestAnimationFrame` 으로 throttle (한 프레임당 1회).

### 7.4 prefers-reduced-motion 처리

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
  .reveal { opacity: 1 !important; transform: none !important; }
  .process__stage { opacity: 1 !important; transform: none !important; position: static !important; }
}
```

---

## 8. 반응형 브레이크포인트

| 구간 | 폭 | 모토 |
|---|---|---|
| Mobile | ~767px | 1열 stack, 헤더 햄버거, FAB는 Hero 통과 후 표시 |
| Tablet | 768~1023px | Practice 2열, Process sticky 유지, 헤더 메뉴 노출 |
| Desktop | 1024px+ | Practice 3열, Profile/Contact 2단 그리드, Hero 콘텐츠 좌측 정렬 max 720px |

---

## 9. 코딩 규칙 (HTML / CSS / JS 공통)

### 9.1 공통 원칙
- 외부 라이브러리·프레임워크 **금지**. 단 Pretendard CDN(`<link>` 1줄)만 허용.
- jQuery, Tailwind CDN, GSAP, Lottie, Swiper 등 **모두 금지**.
- 한국어 주석 필수.
- 초보자 친화: 약어보다 풀네임. `.btn` 같은 보편 약어는 OK, 그 외 자체 약어 금지.

### 9.2 CSS
- 변수는 `:root`에 모두 선언
- BEM-라이트
- `!important` 금지 (단 `prefers-reduced-motion` 블록 내부는 예외)
- 색상 hard-code 금지 (모두 변수로). 단 `rgba(255,255,255, x)` 같은 흰 알파만 예외.

### 9.3 JS
- ES2020+ 문법 (`const`, `let`, arrow, template literal). var 금지.
- 파일 분리:
  - `js/scroll-fx.js` — 스크롤 reveal, 헤더 토글, Process sticky, 푸터 연도
  - `js/modal.js` — 챗 모달 열고닫기, 포커스 트랩
  - `js/gemini-api.js` — Gemini API 호출 모듈 (key 저장/검증, sendMessage 함수)
  - `js/app.js` — DOM 부착, 채팅 흐름 제어
- 모든 함수에 한국어 주석 1줄 (역할 설명).

---

## 10. 파일 구조 (최종)

```
labor-law-office/
├── spec.md            ← 이 문서 (단일 진실원)
├── index.html         ← HTML 빌더 산출물
├── styles.css         ← CSS 디자이너 산출물 (단일 파일)
├── js/
│   ├── scroll-fx.js   ← 스크롤 인터랙션
│   ├── modal.js       ← AI 챗 모달
│   ├── gemini-api.js  ← Gemini API 통신
│   └── app.js         ← 채팅 흐름 컨트롤러
└── assets/            ← 사진·아이콘 도입 시 (현재 비어 있음, placeholder div로 대체)
```

---

## 11. 변경 이력

| 일자 | 버전 | 비고 |
|---|---|---|
| 2026-04-27 | 1.0 | 초안 작성. HTML/CSS/JS 병렬 작업용 단일 진실원으로 확정. |
