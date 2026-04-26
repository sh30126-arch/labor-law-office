/* ============================================================================
 * 노동법률사무소 24시간 노무 상담 — 메인 컨트롤러 (app.js)
 * ============================================================================
 *
 * [이 파일이 하는 일]
 * 사용자 화면(HTML/CSS)과 Gemini API 호출 모듈을 연결하는 "중간 관리자"입니다.
 * - 사용자가 입력한 메시지를 받아서
 * - Gemini API로 보내고
 * - 받은 답변을 화면에 예쁘게 그려주는 역할을 합니다.
 *
 * [의존하는 외부 인터페이스]
 * 1) DOM 요소 (frontend 에이전트가 index.html에 미리 만들어 둠)
 *    - #api-key-section       : API 키 입력 영역 (처음에 보임)
 *    - #api-key-input         : API 키 입력칸 (type="password")
 *    - #api-key-save-btn      : "저장" 버튼
 *    - #chat-container        : 채팅 영역 전체 (처음엔 hidden 속성으로 숨김)
 *    - #chat-messages         : 메시지가 한 줄씩 쌓이는 영역
 *    - #chat-form             : 입력 form (submit 이벤트로 메시지 전송 처리)
 *    - #chat-input            : <textarea> 사용자 입력칸
 *    - #chat-send-btn         : 전송 버튼
 *
 * 2) Gemini API 모듈 (backend 에이전트가 만든 window.GeminiAPI)
 *    - window.GeminiAPI.sendMessage(apiKey, history, userMessage) → Promise<string>
 *    - history 형식: [{role: "user"|"model", text: "..."}]
 *    - 실패 시 reject하는 Error의 message는 이미 한국어로 만들어져 있음
 *
 * [메시지 마크업 규약]
 *    봇:        <div class="message message-bot">텍스트</div>
 *    사용자:    <div class="message message-user">텍스트</div>
 *    입력 중:   <div class="message message-bot typing">...</div>
 *
 * [저장하는 데이터]
 *    localStorage["gemini_api_key"]  : 사용자 API 키 (영구 저장, 브라우저 재시작해도 유지)
 *    대화 히스토리                    : 메모리 변수에만 보관 (새로고침 시 초기화)
 * ==========================================================================*/


// ==========================================================================
// 모듈 전체에서 공유하는 상태 변수들
// IIFE(즉시 실행 함수) 안에 넣어 전역 오염을 막습니다.
// ==========================================================================
(function () {
  'use strict';

  // localStorage에서 API 키를 저장/조회할 때 사용할 키 이름.
  // 이름을 상수로 빼두면 나중에 바꾸기 쉽고 오타도 줄어듭니다.
  const STORAGE_KEY_API = 'gemini_api_key';

  // 현재 세션의 대화 히스토리.
  // 새로고침하면 사라지는 것이 의도입니다(개인정보 보호 + 단순함).
  // 형식: [{role: "user", text: "..."}, {role: "model", text: "..."}, ...]
  let conversationHistory = [];

  // 자주 쓰는 DOM 요소들을 한 번 찾아서 변수에 보관해 두면
  // 매번 document.getElementById를 부르지 않아도 됩니다.
  // 단, DOM이 준비되기 전에는 찾을 수 없으므로 initApp에서 채워 넣습니다.
  let elApiKeySection = null;
  let elApiKeyInput = null;
  let elApiKeySaveBtn = null;
  let elChatContainer = null;
  let elChatMessages = null;
  let elChatForm = null;
  let elChatInput = null;
  let elChatSendBtn = null;


  // ========================================================================
  // initApp
  // ------------------------------------------------------------------------
  // 페이지가 처음 열릴 때 단 한 번 실행되는 "시작 함수"입니다.
  // DOMContentLoaded 이벤트가 발생한 직후에 호출되며,
  //   1) DOM 요소를 변수에 담고
  //   2) 저장된 API 키가 있는지 확인해 적절한 화면을 보여주고
  //   3) 모든 버튼/입력 이벤트 핸들러를 연결하는 일을 합니다.
  // ========================================================================
  function initApp() {
    // 1) DOM 요소 캐싱.
    //    한번만 찾아두면 나중에 빠르게 다시 사용할 수 있습니다.
    elApiKeySection = document.getElementById('api-key-section');
    elApiKeyInput = document.getElementById('api-key-input');
    elApiKeySaveBtn = document.getElementById('api-key-save-btn');
    elChatContainer = document.getElementById('chat-container');
    elChatMessages = document.getElementById('chat-messages');
    elChatForm = document.getElementById('chat-form');
    elChatInput = document.getElementById('chat-input');
    elChatSendBtn = document.getElementById('chat-send-btn');

    // 2) 저장된 키가 있는지 확인하여 첫 화면을 결정합니다.
    loadApiKey();

    // 3) 사용자 인터랙션 이벤트를 연결합니다.
    //    - API 키 저장 버튼 클릭
    //    - 채팅 form 제출 (Enter 또는 전송 버튼)
    //    - textarea 키 입력 (Enter/Shift+Enter 분기 + 자동 높이 조절)
    //    - "API 키 변경" 링크 (없으면 만들어 줌)
    elApiKeySaveBtn.addEventListener('click', handleSaveApiKey);
    elChatForm.addEventListener('submit', handleSendMessage);
    elChatInput.addEventListener('keydown', handleInputKeydown);
    elChatInput.addEventListener('input', adjustTextareaHeight);

    // "API 키 변경" 작은 링크를 채팅 컨테이너 위쪽에 추가합니다.
    // frontend가 따로 두지 않았을 수 있으므로 여기서 동적으로 생성합니다.
    ensureChangeKeyLink();
  }


  // ========================================================================
  // loadApiKey
  // ------------------------------------------------------------------------
  // localStorage에서 저장된 API 키를 읽어옵니다.
  // - 키가 있으면: 입력 화면을 숨기고 채팅 화면을 보여줍니다.
  // - 키가 없으면: 입력 화면을 그대로 두고 사용자가 키를 넣기를 기다립니다.
  // 이 함수는 페이지가 처음 열릴 때 한 번 호출됩니다.
  // ========================================================================
  function loadApiKey() {
    const savedKey = localStorage.getItem(STORAGE_KEY_API);

    if (savedKey && savedKey.length > 0) {
      // 키가 있으면 채팅 화면으로 이동합니다.
      showChatScreen();
    } else {
      // 키가 없으면 키 입력 화면을 보여줍니다.
      showApiKeyScreen();
    }
  }


  // ========================================================================
  // handleSaveApiKey
  // ------------------------------------------------------------------------
  // "저장" 버튼이 눌렸을 때 호출됩니다.
  //   1) 입력값을 trim해서 빈 값이면 alert으로 안내
  //   2) Google API 키는 보통 "AIza"로 시작하므로 그렇지 않으면 confirm으로 한 번 더 물음
  //   3) localStorage에 저장
  //   4) 입력칸을 비우고 채팅 화면으로 전환
  // ========================================================================
  function handleSaveApiKey() {
    const rawValue = elApiKeyInput.value;
    const apiKey = rawValue.trim();

    // 빈 값 체크 — 가장 흔한 실수를 잡아줍니다.
    if (apiKey.length === 0) {
      alert('API 키를 입력해주세요');
      elApiKeyInput.focus();
      return;
    }

    // Google API 키 형식이 아니면 정말 저장할지 한번 더 물어봅니다.
    // 다른 형식의 키라도 일단 저장은 가능하게 하되 사용자가 인지하도록 합니다.
    if (!apiKey.startsWith('AIza')) {
      const okToSaveAnyway = confirm(
        'Google API 키 형식이 아닙니다. 그래도 저장하시겠습니까?'
      );
      if (!okToSaveAnyway) {
        // 사용자가 취소를 누르면 아무 것도 하지 않고 다시 입력하게 합니다.
        return;
      }
    }

    // localStorage에 저장합니다. 보안상 console.log로 키를 절대 찍지 않습니다.
    localStorage.setItem(STORAGE_KEY_API, apiKey);

    // 화면 정리 — 입력칸을 비우고 채팅 화면을 보여줍니다.
    elApiKeyInput.value = '';
    showChatScreen();

    // 채팅 입력에 자동으로 커서가 가도록 포커스해줍니다.
    elChatInput.focus();
  }


  // ========================================================================
  // showChatScreen / showApiKeyScreen
  // ------------------------------------------------------------------------
  // 두 개의 큰 영역(키 입력 / 채팅) 중 어느 쪽을 보여줄지 결정합니다.
  // 단순히 hidden 속성을 토글하는 헬퍼 함수입니다.
  // ========================================================================
  function showChatScreen() {
    elApiKeySection.hidden = true;
    elChatContainer.hidden = false;
  }

  function showApiKeyScreen() {
    elApiKeySection.hidden = false;
    elChatContainer.hidden = true;
  }


  // ========================================================================
  // ensureChangeKeyLink
  // ------------------------------------------------------------------------
  // 채팅 영역 위쪽에 "API 키 변경" 작은 링크를 만들어 둡니다.
  // 사용자가 잘못된 키를 저장했거나 다른 키로 바꾸고 싶을 때 누르는 출구입니다.
  // 이미 같은 ID의 링크가 있으면(다시 그릴 일은 없지만) 중복 생성하지 않습니다.
  // ========================================================================
  function ensureChangeKeyLink() {
    if (document.getElementById('change-key-link')) {
      return;
    }

    const link = document.createElement('button');
    link.id = 'change-key-link';
    link.type = 'button';
    link.textContent = 'API 키 변경';
    // 인라인 스타일은 최소한만. 실제 디자인은 styles.css가 담당합니다.
    link.style.background = 'none';
    link.style.border = 'none';
    link.style.color = '#888';
    link.style.fontSize = '12px';
    link.style.cursor = 'pointer';
    link.style.textDecoration = 'underline';
    link.style.padding = '4px 8px';
    link.style.float = 'right';

    link.addEventListener('click', resetApiKey);

    // 채팅 컨테이너 안쪽 맨 위에 끼워 넣습니다.
    if (elChatContainer && elChatContainer.firstChild) {
      elChatContainer.insertBefore(link, elChatContainer.firstChild);
    } else if (elChatContainer) {
      elChatContainer.appendChild(link);
    }
  }


  // ========================================================================
  // resetApiKey
  // ------------------------------------------------------------------------
  // 저장된 API 키를 지우고 키 입력 화면으로 되돌립니다.
  // - "API 키 변경" 링크를 누를 때
  // - API 응답이 401/403 같은 인증 실패였을 때 사용자가 "다시 입력하기"를 누를 때
  // 두 경우 모두에서 호출됩니다.
  // ========================================================================
  function resetApiKey() {
    localStorage.removeItem(STORAGE_KEY_API);
    // 메모리상의 대화 히스토리도 같이 지웁니다(다른 사람이 다른 키로 들어올 수 있으니).
    conversationHistory = [];
    showApiKeyScreen();
    elApiKeyInput.focus();
  }


  // ========================================================================
  // handleSendMessage
  // ------------------------------------------------------------------------
  // 사용자가 form을 submit했을 때(전송 버튼 클릭 또는 Enter) 호출됩니다.
  //
  // 흐름:
  //  1) 기본 form 동작을 막는다(페이지 새로고침 방지).
  //  2) 입력값을 trim. 빈 값이면 무시.
  //  3) 사용자 메시지를 화면에 그린다.
  //  4) 입력칸을 비우고 잠깐 비활성화한다(중복 전송 방지).
  //  5) 봇이 입력 중인 것처럼 typing 인디케이터를 보여준다.
  //  6) GeminiAPI.sendMessage 호출. 이때 history는 "이번 사용자 턴 직전"까지의 것만 넘긴다.
  //  7) 성공: typing 제거 → 봇 메시지 그리기 → history에 양쪽 턴을 기록.
  //     실패: typing 제거 → 에러 메시지 봇 말풍선으로 보여주기 + (인증 실패면) 키 재입력 버튼.
  //  8) 마지막에 입력칸/전송 버튼을 다시 활성화하고 포커스 복원.
  // ========================================================================
  async function handleSendMessage(event) {
    event.preventDefault();

    const userMessage = elChatInput.value.trim();
    if (userMessage.length === 0) {
      return;
    }

    // 매 호출마다 localStorage에서 다시 읽습니다.
    // 다른 탭에서 키를 바꿨을 가능성도 있고, 단순함을 위해 매번 가져옵니다.
    const apiKey = localStorage.getItem(STORAGE_KEY_API);
    if (!apiKey) {
      // 이론상 여기 오면 안 되지만 안전장치로 둡니다.
      showApiKeyScreen();
      return;
    }

    // 1) 사용자 메시지를 화면에 추가
    appendMessage('user', userMessage);

    // 2) 입력칸 비우기 + 비활성화 (UX: 사용자가 같은 걸 두 번 보내지 못하도록)
    elChatInput.value = '';
    adjustTextareaHeight(); // 비웠으니 높이도 원상복구
    setInputEnabled(false);

    // 3) typing 인디케이터 표시
    const typingEl = appendTypingIndicator();

    // 4) API 호출에 넘길 히스토리는 "이번 사용자 턴을 push하기 전" 상태입니다.
    //    backend 모듈이 마지막 인자로 새 메시지를 따로 받기 때문입니다.
    //    히스토리 배열은 얕은 복사본을 넘겨 backend가 변형해도 안전합니다.
    const historyForApi = conversationHistory.slice();

    // 5) 이번 사용자 턴은 메모리 히스토리에는 미리 push해 둡니다.
    //    봇 응답이 성공하면 이어서 model 턴을 push할 것이고,
    //    실패해도 사용자가 무엇을 물었는지는 기록으로 남기는 편이 자연스럽습니다.
    conversationHistory.push({ role: 'user', text: userMessage });

    try {
      const botReply = await window.GeminiAPI.sendMessage(
        apiKey,
        historyForApi,
        userMessage
      );

      // 성공: typing 제거 후 봇 메시지 그리기
      removeElement(typingEl);
      appendMessage('bot', botReply);

      // 히스토리에 모델 턴 추가
      conversationHistory.push({ role: 'model', text: botReply });
    } catch (err) {
      // 실패: typing 제거 후 에러 말풍선
      removeElement(typingEl);
      showError(err);
    } finally {
      // 성공이든 실패든 입력칸을 다시 살리고 포커스 복원
      setInputEnabled(true);
      elChatInput.focus();
      scrollMessagesToBottom();
    }
  }


  // ========================================================================
  // appendMessage
  // ------------------------------------------------------------------------
  // 채팅 영역에 새 말풍선 한 개를 추가합니다.
  //   role: 'user' 또는 'bot'
  //   text: 말풍선에 들어갈 평문 텍스트
  //
  // [구조] index.html/styles.css가 가정하는 BEM 구조와 동일하게 그립니다:
  //   봇:        .message.message-bot > .message__avatar(⚖️) + .message__bubble(텍스트)
  //   사용자:    .message.message-user > .message__bubble(텍스트)
  //
  // [보안] 사용자 입력을 innerHTML로 직접 넣으면 XSS 위험이 있으므로
  //        textContent로만 텍스트를 넣습니다. 줄바꿈(\n)은
  //        styles.css의 `white-space: pre-wrap` 덕분에 자동으로 보존됩니다.
  //
  // [반환] 말풍선 본체(.message__bubble) 요소를 돌려줍니다.
  //        showError가 이 안에 "키 다시 입력하기" 버튼을 추가할 수 있도록 하기 위함입니다.
  // ========================================================================
  function appendMessage(role, text) {
    // 1) 바깥 컨테이너
    const wrapper = document.createElement('div');
    wrapper.className = role === 'user' ? 'message message-user' : 'message message-bot';

    // 2) 봇 메시지에는 좌측 아바타(⚖️)를 추가합니다. (CSS가 위치/크기 처리)
    if (role !== 'user') {
      const avatar = document.createElement('div');
      avatar.className = 'message__avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = '⚖️';
      wrapper.appendChild(avatar);
    }

    // 3) 말풍선 본체 — 텍스트는 textContent로 안전하게 삽입.
    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.textContent = String(text);
    wrapper.appendChild(bubble);

    elChatMessages.appendChild(wrapper);
    scrollMessagesToBottom();

    // showError가 말풍선 안에 버튼을 붙일 수 있도록 bubble을 반환합니다.
    return bubble;
  }


  // ========================================================================
  // appendTypingIndicator
  // ------------------------------------------------------------------------
  // "입력 중..." 표시를 추가하고 그 DOM을 돌려줍니다.
  // styles.css가 점 3개 애니메이션을 그리는 구조에 맞춰
  //   .message.message-bot.typing > .message__avatar + .message__bubble > <span></span>
  // 형태로 만듭니다. (가운데 점은 <span>, 양옆 점은 ::before/::after)
  // 응답이 도착하면 호출자가 이 요소를 그대로 제거하면 됩니다.
  // ========================================================================
  function appendTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message message-bot typing';

    const avatar = document.createElement('div');
    avatar.className = 'message__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '⚖️';
    wrapper.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    // 가운데 점 1개를 위한 빈 <span> — 양옆 점은 CSS ::before/::after가 그립니다.
    bubble.appendChild(document.createElement('span'));
    wrapper.appendChild(bubble);

    elChatMessages.appendChild(wrapper);
    scrollMessagesToBottom();
    return wrapper;
  }


  // ========================================================================
  // showError
  // ------------------------------------------------------------------------
  // API 호출 실패 시 사용자에게 에러를 보여줍니다.
  // - backend 에이전트가 이미 한국어 메시지를 만들어 주므로 그대로 표시합니다.
  // - 메시지가 인증 실패(401/403/유효하지 않은 키 등)로 보이면
  //   "API 키 다시 입력하기" 버튼을 봇 말풍선 안에 같이 그려줍니다.
  // ========================================================================
  function showError(err) {
    const message =
      (err && err.message) ? err.message : '알 수 없는 오류가 발생했습니다.';

    // 1) 일반 봇 말풍선으로 에러 텍스트 표시
    const bubble = appendMessage('bot', message);

    // 2) 인증 실패로 추정되면 키 재입력 버튼을 같은 말풍선에 붙입니다.
    if (looksLikeAuthError(message)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'API 키 다시 입력하기';
      btn.style.display = 'block';
      btn.style.marginTop = '8px';
      btn.style.padding = '6px 12px';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', resetApiKey);
      bubble.appendChild(btn);
      scrollMessagesToBottom();
    }
  }


  // ========================================================================
  // looksLikeAuthError
  // ------------------------------------------------------------------------
  // 에러 메시지 문자열을 보고 "이게 인증 문제인가?"를 어림짐작합니다.
  // backend 에이전트가 한국어로 만들어준 메시지를 키워드로 매칭합니다.
  // 100% 정확할 필요는 없고, 키 재입력 안내가 도움이 될 만한 상황을 잡는 게 목표입니다.
  // ========================================================================
  function looksLikeAuthError(message) {
    if (!message) return false;
    const m = message.toLowerCase();
    return (
      m.includes('401') ||
      m.includes('403') ||
      m.includes('unauthorized') ||
      m.includes('forbidden') ||
      message.includes('API 키') && (
        message.includes('유효하지') ||
        message.includes('잘못') ||
        message.includes('확인') ||
        message.includes('인증')
      )
    );
  }


  // ========================================================================
  // handleInputKeydown
  // ------------------------------------------------------------------------
  // textarea에서 키가 눌렸을 때의 동작을 결정합니다.
  //   - Enter (Shift 없이): 메시지 전송 (form submit 트리거)
  //   - Shift + Enter      : 기본 동작(줄바꿈) 유지
  //   - 한글 조합 중(IME)  : 무시 — 한국어 사용자가 받침 입력 중에 전송되는 사고를 막습니다.
  // ========================================================================
  function handleInputKeydown(event) {
    if (event.key !== 'Enter') {
      return;
    }
    // IME 조합 중에는 e.isComposing 또는 keyCode 229로 들어옵니다.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.shiftKey) {
      return; // Shift+Enter는 줄바꿈 그대로
    }

    // 그 외엔 form submit을 직접 호출합니다.
    event.preventDefault();
    // requestSubmit이 표준이지만 일부 구버전 브라우저는 dispatchEvent로 우회합니다.
    if (typeof elChatForm.requestSubmit === 'function') {
      elChatForm.requestSubmit();
    } else {
      elChatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }


  // ========================================================================
  // adjustTextareaHeight
  // ------------------------------------------------------------------------
  // textarea를 입력 길이에 따라 자동으로 키워줍니다.
  // 최대 5줄까지만 늘어나고 그 이상은 내부 스크롤이 생깁니다.
  // 동작 원리: 일단 height를 비우고 scrollHeight를 측정해서 다시 채워 넣습니다.
  // ========================================================================
  function adjustTextareaHeight() {
    if (!elChatInput) return;

    // 한 줄 높이를 line-height로 가져오기 어렵기 때문에 대략 24px로 가정합니다.
    // (실제 css에서 line-height가 다르면 styles.css에서 조정 가능)
    const LINE_HEIGHT_PX = 24;
    const MAX_LINES = 5;

    elChatInput.style.height = 'auto';
    const desired = Math.min(elChatInput.scrollHeight, LINE_HEIGHT_PX * MAX_LINES);
    elChatInput.style.height = desired + 'px';

    // 5줄을 넘기면 내부 스크롤이 생기도록 overflow를 켭니다.
    elChatInput.style.overflowY =
      elChatInput.scrollHeight > LINE_HEIGHT_PX * MAX_LINES ? 'auto' : 'hidden';
  }


  // ========================================================================
  // setInputEnabled
  // ------------------------------------------------------------------------
  // 입력칸과 전송 버튼을 한꺼번에 켜고 끕니다.
  // 메시지를 보내는 동안에는 끄고, 응답이 오거나 실패하면 다시 켭니다.
  // ========================================================================
  function setInputEnabled(enabled) {
    elChatInput.disabled = !enabled;
    elChatSendBtn.disabled = !enabled;
  }


  // ========================================================================
  // scrollMessagesToBottom
  // ------------------------------------------------------------------------
  // 새 메시지가 들어오면 항상 최신 메시지가 보이도록 가장 아래로 스크롤합니다.
  // ========================================================================
  function scrollMessagesToBottom() {
    if (!elChatMessages) return;
    // requestAnimationFrame으로 한 프레임 미뤄야 새로 추가된 노드 높이가 반영됩니다.
    requestAnimationFrame(function () {
      elChatMessages.scrollTop = elChatMessages.scrollHeight;
    });
  }


  // ========================================================================
  // removeElement
  // ------------------------------------------------------------------------
  // DOM 요소 하나를 안전하게 제거하는 헬퍼.
  // 이미 떨어져 나간 노드여도 에러가 나지 않도록 부모 존재 여부를 확인합니다.
  // ========================================================================
  function removeElement(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }


  // ==========================================================================
  // 진입점: DOM이 준비되면 initApp을 호출합니다.
  // 이미 DOMContentLoaded가 지난 시점에 스크립트가 실행되는 경우(예: 비동기 로드)도
  // 대비해서 readyState도 함께 확인합니다.
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
