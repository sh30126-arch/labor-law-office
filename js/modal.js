/* ============================================================================
 * modal.js — AI 챗 모달 열고/닫고/포커스 트랩 관리 모듈 (v2)
 * ----------------------------------------------------------------------------
 * 이 파일이 하는 일
 *   1) Floating 버튼(.chatbot-fab) 클릭 → 모달(.chatbot-modal) 열기
 *   2) 닫기: X 버튼 / ESC 키 / 배경 오버레이 클릭 — 3가지 모두 지원
 *   3) 모달 열림 동안 body 스크롤 잠금 (배경이 같이 스크롤되지 않게)
 *   4) 포커스 트랩: 모달 안에서 Tab 키가 밖으로 빠져나가지 않도록 가둠
 *      - 열림 시 #chat-input 으로 자동 포커스 (입력 영역이 보일 때)
 *      - 닫힘 시 호출 버튼(FAB)으로 포커스 복귀 (키보드 사용자 흐름 유지)
 *   5) 모달이 열릴 때 #chat-input 에 자동 포커스
 *      - 단, app.js 의 함수를 직접 호출하지 않고 단순히 DOM API(focus())만 사용
 *
 * 코딩 스타일
 *   - 'use strict' + IIFE 로 전역 오염 방지
 *   - 외부 라이브러리 0개 (바닐라 JS)
 *   - DOMContentLoaded 후 초기화
 *
 * spec_v2.md §8 (AI 챗 모달 명세) 를 따릅니다.
 *   - §8.1 Floating 버튼: `.chatbot-fab` (pill 형태)
 *   - §8.2 모달:        `.chatbot-modal` + `.chatbot-modal--open` 토글
 *   - §8.2 닫기 트리거:  헤더 X, ESC, 오버레이 클릭 (3가지)
 *                       닫기 버튼/오버레이 모두 `data-chatbot-close` 속성을 가짐
 *   - §8.3 내부 ID:     `#chat-input`, `#api-key-section`, `#chat-container` 등
 *   - §8.4 보존 DOM IDs는 절대 변경 금지 (JS 의존)
 * ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * 0) 모듈 상태
   * ------------------------------------------------------------------------
   * - lastFocusedElement: 모달 열기 직전 포커스를 가지고 있던 요소.
   *   닫을 때 이 요소로 포커스를 돌려놓아야 키보드/스크린리더 사용자가
   *   원래 흐름을 유지할 수 있습니다.
   * - savedBodyOverflow: 모달 열기 전 body 의 overflow 값.
   *   닫을 때 원복해야 다른 영역에서 overflow 를 직접 제어하던 것과 충돌하지
   *   않습니다.
   * ------------------------------------------------------------------------ */
  let lastFocusedElement = null;
  let savedBodyOverflow = '';

  /* --------------------------------------------------------------------------
   * 1) DOM 캐싱
   * ------------------------------------------------------------------------
   * 매번 querySelector 를 다시 부르지 않도록 한 번만 잡아둡니다.
   * - 이 모듈에서 다루는 모든 DOM 참조는 `els` 안에 모여 있습니다.
   * ------------------------------------------------------------------------ */
  const els = {
    fab: null,
    modal: null,
    chatInput: null,
  };

  /* --------------------------------------------------------------------------
   * 2) 포커스 가능한 요소 수집기
   * ------------------------------------------------------------------------
   * 키보드 접근성의 핵심입니다. 시각 사용자에게는 영향이 없지만,
   * 스크린리더/키보드 전용 사용자에게는 모달이 "갇힌 공간" 으로 동작해야
   * 자연스럽습니다.
   *
   * 보이지 않는 요소(display:none / visibility:hidden / hidden 속성)는
   * 제외해야 모달 내부 영역 전환(api-key-section ↔ chat-container) 시에도
   * 올바른 트랩 범위가 유지됩니다.
   * ------------------------------------------------------------------------ */
  function getFocusableElements(container) {
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const nodes = container.querySelectorAll(selectors);
    return Array.prototype.filter.call(nodes, (el) => {
      if (el.hasAttribute('hidden')) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      // 부모가 hidden 인 경우(섹션 토글)도 거른다
      if (el.offsetParent === null && style.position !== 'fixed') return false;
      return true;
    });
  }

  /* --------------------------------------------------------------------------
   * 3) 포커스 트랩 — Tab/Shift+Tab 이 모달 밖으로 새지 않게 막기
   * ------------------------------------------------------------------------
   * 동작
   *   - Tab: 마지막 포커스 가능 요소에서 Tab → 첫 요소로 이동
   *   - Shift+Tab: 첫 요소에서 Shift+Tab → 마지막 요소로 이동
   * ------------------------------------------------------------------------ */
  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    if (!els.modal) return;

    const focusables = getFocusableElements(els.modal);
    if (focusables.length === 0) {
      // 포커스 받을 요소가 하나도 없으면 그냥 모달에 묶어두기
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      // Shift+Tab: 첫 요소에서 더 앞으로 가려 하면 마지막으로 점프
      if (active === first || !els.modal.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: 마지막 요소에서 더 뒤로 가려 하면 첫 요소로 점프
      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /* --------------------------------------------------------------------------
   * 4) 키보드 핸들러 — ESC 로 닫기 + Tab 포커스 트랩
   * ------------------------------------------------------------------------ */
  function onKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeModal();
      return;
    }
    trapFocus(event);
  }

  /* --------------------------------------------------------------------------
   * 5) 모달 열기
   * ------------------------------------------------------------------------
   * - 호출 직전 포커스를 기억(lastFocusedElement) → 닫을 때 복귀용
   * - aria-hidden / hidden 속성을 정리해서 스크린리더에도 모달이 노출되게 함
   * - body 스크롤 잠금
   * - 첫 포커스를 #chat-input → 닫기 버튼 → 모달 자체 순으로 시도
   *   (입력에 바로 타이핑할 수 있는 게 사용자에게 가장 친절)
   * ------------------------------------------------------------------------ */
  function openModal() {
    if (!els.modal) return;
    if (els.modal.classList.contains('chatbot-modal--open')) return; // 이미 열림

    lastFocusedElement = document.activeElement;

    // hidden 속성이 걸려 있으면 제거 (CSS 전환과 별개로 접근성 트리에서 보이게)
    if (els.modal.hasAttribute('hidden')) {
      els.modal.removeAttribute('hidden');
    }
    els.modal.classList.add('chatbot-modal--open');
    els.modal.setAttribute('aria-hidden', 'false');

    // body 스크롤 잠금: 기존 overflow 값을 백업했다가 닫을 때 복구
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 키보드 이벤트 등록 (ESC + Tab 트랩)
    document.addEventListener('keydown', onKeydown);

    // 첫 포커스 이동
    // - app.js 가 키 입력 영역(#api-key-section) 을 보여주는 상태일 수도 있으므로
    //   "현재 보이는" 첫 포커스 가능 요소를 찾아 보내는 게 안전합니다.
    // - 우선순위: #chat-input(보일 때) → #api-key-input → 닫기 버튼 → 첫 포커스 가능 요소
    //   ※ app.js 의 함수를 직접 호출하지 않고 DOM API(focus())만 사용 — spec 준수
    window.requestAnimationFrame(() => {
      // 다음 프레임에 포커스를 주는 이유:
      // hidden 제거/클래스 추가 직후 일부 브라우저에서 focus() 가
      // 무시될 수 있어, 한 프레임 양보한 뒤 시도합니다.
      const isVisible = (el) => {
        if (!el) return false;
        if (el.hasAttribute('hidden')) return false;
        if (el.disabled) return false;
        // offsetParent 가 null 이면 화면에 렌더되지 않은 요소(섹션 hidden 포함)
        return el.offsetParent !== null;
      };

      // 1순위: chat-input (채팅 영역이 보일 때 — 가장 자주 쓰는 흐름)
      if (isVisible(els.chatInput)) {
        els.chatInput.focus();
        return;
      }

      // 2순위: api-key-input (최초 진입 시 키 입력 화면)
      const apiKeyInput = document.getElementById('api-key-input');
      if (isVisible(apiKeyInput)) {
        apiKeyInput.focus();
        return;
      }

      // 3순위: 닫기 버튼
      const closeBtn = els.modal.querySelector('.chatbot-modal__close');
      if (closeBtn) {
        closeBtn.focus();
        return;
      }

      // 4순위: 모달 내 첫 포커스 가능 요소
      const focusables = getFocusableElements(els.modal);
      if (focusables.length > 0) focusables[0].focus();
    });
  }

  /* --------------------------------------------------------------------------
   * 6) 모달 닫기
   * ------------------------------------------------------------------------
   * - 클래스 제거 + body overflow 복구 + ESC/Tab 핸들러 해제
   * - 마지막으로 열기 직전 요소(보통 FAB)로 포커스 복귀
   * ------------------------------------------------------------------------ */
  function closeModal() {
    if (!els.modal) return;
    if (!els.modal.classList.contains('chatbot-modal--open')) return; // 이미 닫힘

    els.modal.classList.remove('chatbot-modal--open');
    els.modal.setAttribute('aria-hidden', 'true');

    // body overflow 복구 (다른 곳이 직접 다루던 값 그대로 돌려놓음)
    document.body.style.overflow = savedBodyOverflow;
    savedBodyOverflow = '';

    document.removeEventListener('keydown', onKeydown);

    // 포커스 복귀: 호출자가 사라졌거나 비활성이면 FAB 로 fallback
    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus === 'function' &&
      document.contains(lastFocusedElement)
    ) {
      lastFocusedElement.focus();
    } else if (els.fab) {
      els.fab.focus();
    }
    lastFocusedElement = null;
  }

  /* --------------------------------------------------------------------------
   * 7) 닫기 트리거 바인딩
   * ------------------------------------------------------------------------
   * spec_v2 §8.2: 닫기 X 버튼과 배경 오버레이 모두
   *   `data-chatbot-close` 속성(또는 v1 호환을 위한 `data-close` 속성)을 갖습니다.
   * - 모달 박스 내부 클릭은 오버레이 클릭으로 오인되지 않도록
   *   `data-chatbot-close` 속성을 가진 요소(또는 그 자손) 클릭만 닫기로 인정.
   * - 자식 요소가 클릭됐을 때도 closest 로 부모를 찾아 동작합니다(이벤트 위임).
   * ------------------------------------------------------------------------ */
  function bindCloseTriggers() {
    if (!els.modal) return;

    els.modal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // spec_v2 표준은 data-chatbot-close. v1 호환을 위해 data-close 도 함께 인정.
      const closer = target.closest('[data-chatbot-close], [data-close]');
      if (closer) {
        closeModal();
      }
    });
  }

  /* --------------------------------------------------------------------------
   * 8) FAB 클릭 → 모달 열기
   * ------------------------------------------------------------------------ */
  function bindFab() {
    if (!els.fab) return;
    els.fab.addEventListener('click', () => {
      openModal();
    });
  }

  /* --------------------------------------------------------------------------
   * 9) 초기화 진입점
   * ------------------------------------------------------------------------
   * - DOM 캐싱 → 트리거 바인딩 순서로 초기화
   * - 필수 요소(fab/modal)가 없으면 조용히 종료(에러 던지지 않음)
   * ------------------------------------------------------------------------ */
  function init() {
    els.fab = document.querySelector('.chatbot-fab');
    els.modal = document.querySelector('.chatbot-modal');
    els.chatInput = document.getElementById('chat-input');

    // 둘 중 하나라도 없으면 모듈을 켤 수 없으니 종료
    if (!els.fab || !els.modal) return;

    // 초기 상태에서는 모달이 닫혀 있어야 함(접근성 트리에서도 숨김)
    if (!els.modal.classList.contains('chatbot-modal--open')) {
      els.modal.setAttribute('aria-hidden', 'true');
    }

    bindFab();
    bindCloseTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
