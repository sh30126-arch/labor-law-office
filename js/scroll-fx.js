/* ============================================================================
 * scroll-fx.js — 스크롤 기반 시각 효과 모듈
 * ----------------------------------------------------------------------------
 * 이 파일이 하는 일 (4가지)
 *   1) Reveal-on-scroll
 *      - `.reveal` 요소가 뷰포트에 들어오면 `.is-revealed` 클래스를 부여해서
 *        CSS가 정의한 페이드/슬라이드 애니메이션을 발동시킵니다.
 *      - 한 번 보여진 요소는 다시 감추지 않습니다(재등장 시 깜빡거림 방지).
 *
 *   2) 헤더 transparent → solid 토글
 *      - 사용자가 80px 이상 스크롤하면 `.header` 에 `.header--solid` 클래스를
 *        붙여 흰 배경 + 다크 텍스트 상태로 전환합니다.
 *
 *   3) Process 섹션의 sticky pin 진행도 계산
 *      - `.process` 섹션은 height: 400vh, 내부 sticky 박스는 100vh 입니다.
 *      - 섹션이 화면을 지나가는 동안의 진행도(0~1)를 계산해서
 *        섹션에 CSS 변수 `--progress` 로 넣어 줍니다(추후 CSS가 활용).
 *      - 진행도에 따라 0~3 중 하나의 활성 stage 인덱스를 계산해
 *        `.process__stage` 각각에 `data-active="true|false"` 를 셋팅합니다.
 *
 *   4) Footer 연도 자동 갱신
 *      - `#footer-year` 텍스트를 올해 연도로 채웁니다.
 *
 * 코딩 스타일
 *   - 'use strict' + IIFE 패턴으로 전역 오염 방지
 *   - 외부 라이브러리 0개 (바닐라 JS)
 *   - DOMContentLoaded 후 초기화
 *   - prefers-reduced-motion 매치 시: reveal 즉시 적용 + sticky 진행도 비활성
 *
 * spec.md 7장(스크롤 인터랙션 명세)을 그대로 따릅니다.
 * ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 0) 공통 유틸 / 상수
   * ------------------------------------------------------------------------ */

  // 헤더 transparent → solid 전환 임계값 (spec 7.3 확정값)
  const HEADER_SCROLL_THRESHOLD = 80;

  // IntersectionObserver 옵션 (spec 7.1 확정값)
  // threshold 0.15 = 요소의 15%가 보이면 트리거
  // rootMargin 하단 -10% = 뷰포트 바닥에서 10% 더 안쪽에서 트리거 (살짝 일찍)
  const REVEAL_THRESHOLD = 0.15;
  const REVEAL_ROOT_MARGIN = '0px 0px -10% 0px';

  // 사용자가 모션 감소를 선호하는지 확인 (접근성)
  // - 매번 호출하지 않도록 한 번만 평가하고 보관합니다.
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // 값을 [min, max] 범위로 잘라주는 작은 헬퍼
  // - sticky 진행도 계산에서 음수/1 초과를 막는 용도입니다.
  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  /* --------------------------------------------------------------------------
   * 1) Reveal-on-scroll
   * ------------------------------------------------------------------------
   * `.reveal` 클래스를 가진 모든 요소를 IntersectionObserver 로 감시합니다.
   * 화면에 들어오는 즉시 `.is-revealed` 를 추가하고, 같은 요소를 다시 감시하지
   * 않도록 unobserve 합니다. (한 번만 실행되는 일회성 효과)
   *
   * 같은 그리드 안의 카드들은 stagger(시차) 효과를 주기 위해
   * `--i` CSS 변수로 인덱스(0,1,2…)를 셋팅합니다. CSS 측에서
   *   transition-delay: calc(var(--i) * 80ms)
   * 를 활용해 카드가 차례로 등장하도록 합니다.
   * ------------------------------------------------------------------------ */
  function initRevealOnScroll() {
    const targets = document.querySelectorAll('.reveal');
    if (targets.length === 0) return;

    // 카드 그리드 stagger 인덱스 부여
    // - 같은 부모 안에서 몇 번째 reveal 인지 계산해서 --i 로 노출합니다.
    targets.forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      const siblings = parent.querySelectorAll(':scope > .reveal');
      if (siblings.length > 1) {
        // 형제 중 자기 자신의 인덱스를 찾아 셋팅
        const index = Array.prototype.indexOf.call(siblings, el);
        el.style.setProperty('--i', String(index));
      }
    });

    // prefers-reduced-motion: 즉시 보이게 처리하고 끝냅니다.
    // - 모션 감소 모드에서는 페이드 자체가 산만하다는 사용자 선호를 따릅니다.
    if (prefersReducedMotion) {
      targets.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    // IntersectionObserver 미지원 브라우저(아주 구형)에 대한 안전망:
    // 그냥 전부 보이게 처리합니다.
    if (typeof window.IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // 등장 시점에 클래스를 붙이고, 같은 요소는 더 이상 감시하지 않습니다.
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: REVEAL_THRESHOLD,
        rootMargin: REVEAL_ROOT_MARGIN,
      }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* --------------------------------------------------------------------------
   * 2) 헤더 transparent ↔ solid 토글
   * ------------------------------------------------------------------------
   * scrollY > 80 일 때 `.header--solid` 클래스를 추가/제거합니다.
   * scroll 이벤트는 매우 자주 발생하므로 requestAnimationFrame 으로
   * 한 프레임당 1번만 처리하도록 throttle 합니다.
   * ------------------------------------------------------------------------ */
  function initHeaderToggle() {
    // spec 5.1 에 따르면 헤더 ID는 `#site-header`, 블록 클래스는 `.header`.
    // 둘 중 먼저 잡히는 것을 사용 (HTML 빌더 작업 결과에 유연하게 대응).
    const header =
      document.getElementById('site-header') ||
      document.querySelector('.header');
    if (!header) return;

    let ticking = false; // rAF 중복 예약을 막는 락 변수

    function update() {
      const scrolled = window.scrollY > HEADER_SCROLL_THRESHOLD;
      // classList.toggle 두 번째 인자(force) 로 상태를 명시적으로 셋팅합니다.
      header.classList.toggle('header--solid', scrolled);
      ticking = false;
    }

    function onScroll() {
      // 이미 다음 프레임에 update 가 예약돼 있으면 추가 예약하지 않습니다.
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    // passive: true → 스크롤 성능 개선(브라우저가 preventDefault 를 기다리지 않음)
    window.addEventListener('scroll', onScroll, { passive: true });

    // 페이지가 새로고침되어 이미 스크롤된 상태일 수 있으므로 1회 즉시 실행
    update();
  }

  /* --------------------------------------------------------------------------
   * 3) Process 섹션 sticky pin 진행도 계산
   * ------------------------------------------------------------------------
   * spec 7.2 의 공식을 그대로 사용합니다.
   *   const rect = section.getBoundingClientRect();
   *   const total = section.offsetHeight - window.innerHeight;
   *   const scrolled = clamp(-rect.top, 0, total);
   *   const progress = scrolled / total;  // 0 ~ 1
   *
   * 진행도에 따라 4단계 stage 중 활성 인덱스를 계산하고, 각 stage 의
   * `data-active` 속성을 갱신합니다. CSS 는 [data-active="true"] 셀렉터로
   * 카드 transform 을 분기하면 됩니다.
   *
   * prefers-reduced-motion 매치 시에는 sticky 진행도 자체를 등록하지 않고,
   * 모든 stage 를 활성으로 표시해 정적인 stack 으로 보이게 합니다.
   * ------------------------------------------------------------------------ */
  function initProcessSticky() {
    const section = document.getElementById('process');
    if (!section) return;

    const stages = section.querySelectorAll('.process__stage');
    if (stages.length === 0) return;

    // 모션 감소 모드: 진행도 갱신을 등록하지 않고, 모든 stage 를 활성으로 둡니다.
    if (prefersReducedMotion) {
      stages.forEach((stage) => stage.setAttribute('data-active', 'true'));
      section.style.setProperty('--progress', '1');
      return;
    }

    let ticking = false;

    function update() {
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;

      // total 이 0 이하이면(섹션 높이가 viewport 보다 작거나 같으면) 계산 불가 → 0 으로 처리
      const progress =
        total > 0 ? clamp(-rect.top, 0, total) / total : 0;

      // CSS 변수로 진행도를 노출 (CSS 가 변환에 활용 가능)
      section.style.setProperty('--progress', progress.toFixed(4));

      // 활성 stage 인덱스 계산 (0..3)
      // spec 7.2 매핑: 0~0.25 → 0, 0.25~0.50 → 1, 0.50~0.75 → 2, 0.75~1.00 → 3
      // - Math.floor(progress * 4) 가 정확히 위 매핑과 같음.
      // - 단, progress 가 1.0 정확히일 때 4 가 나오므로 Math.min 으로 클램핑.
      const activeIndex = Math.min(3, Math.floor(progress * 4));

      // 각 stage 의 data-active: 활성=true, 지나간=past, 미래=false
      // CSS 가 [data-active="true"] / [data-active="past"] 로 transform 분기.
      stages.forEach((stage, idx) => {
        let value = 'false';
        if (idx === activeIndex) value = 'true';
        else if (idx < activeIndex) value = 'past';
        stage.setAttribute('data-active', value);
      });

      // 하단 진행 도트(.process__progress-dot)도 활성 단계에 맞춰 갱신.
      // 현재 활성 도트만 aria-current="true", 나머지는 속성 제거.
      const dots = section.querySelectorAll('.process__progress-dot');
      dots.forEach((dot, idx) => {
        if (idx === activeIndex) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });

      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // 리사이즈 시에도 offsetHeight / innerHeight 가 바뀌므로 다시 계산
    window.addEventListener('resize', onScroll, { passive: true });

    // 초기 1회 실행 (페이지 로드 직후 위치에 맞는 상태로 그리기)
    update();
  }

  /* --------------------------------------------------------------------------
   * 4) Footer 연도 자동 갱신
   * ------------------------------------------------------------------------
   * `#footer-year` 가 있으면 올해 연도(YYYY)로 채웁니다.
   * 매년 수기 수정하지 않아도 자동으로 최신 연도가 표시됩니다.
   * ------------------------------------------------------------------------ */
  function initFooterYear() {
    const yearEl = document.getElementById('footer-year');
    if (!yearEl) return;
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* --------------------------------------------------------------------------
   * 5) 초기화 진입점
   * ------------------------------------------------------------------------
   * DOMContentLoaded 가 끝난 후에 모든 init 함수를 실행합니다.
   * - 이미 DOM 이 준비된 상태(예: defer 스크립트)라면 즉시 실행.
   * ------------------------------------------------------------------------ */
  function init() {
    initRevealOnScroll();
    initHeaderToggle();
    initProcessSticky();
    initFooterYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
