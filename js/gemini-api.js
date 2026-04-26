/**
 * gemini-api.js
 * ----------------------------------------------------------------------------
 * 노동법률사무소 24시간 노무 상담 사이트의 Gemini API 호출 전담 모듈.
 *
 * 이 사이트는 백엔드 서버가 없는 정적 사이트입니다.
 * 사용자가 본인의 Google API 키를 입력하면, 브라우저가 직접
 * Google Gemini REST API를 호출하는 구조입니다.
 *
 * 같은 폴더의 app.js 가 window.GeminiAPI 를 통해 이 모듈을 사용합니다.
 *
 * 보안 원칙:
 *  - API 키는 절대 console.log 로 찍지 않습니다.
 *  - generativelanguage.googleapis.com 외 어떤 외부 서버로도 데이터를 보내지 않습니다.
 *  - 분석/로깅 목적의 외부 호출 없음.
 * ----------------------------------------------------------------------------
 */

// IIFE(즉시실행함수)로 감싸서 내부 변수가 전역을 오염시키지 않게 합니다.
// 마지막 줄에서 window.GeminiAPI 객체로 필요한 함수만 외부에 노출합니다.
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 상수 영역
  // ---------------------------------------------------------------------------

  // 사용자가 명시적으로 지정한 모델. 변경 시 이 한 줄만 바꾸면 됩니다.
  const MODEL_NAME = 'gemini-3-flash-preview';

  // Gemini REST 엔드포인트의 베이스 URL.
  // 실제 호출 시 ?key=API_KEY 쿼리 파라미터를 붙여서 사용합니다.
  // (Google 공식 문서가 권장하는 v1beta 경로입니다.)
  const API_BASE_URL =
    'https://generativelanguage.googleapis.com/v1beta/models';

  // 시스템 프롬프트.
  // Gemini의 systemInstruction 필드에 그대로 들어가며,
  // AI 답변의 톤·구조·법률 안전 규칙을 정의합니다.
  // (수정 시 운영진 컨펌 후 반영 권장)
  const SYSTEM_PROMPT = [
    '당신은 대한민국 "노동법률사무소 이해"의 24시간 AI 노무 상담사입니다.',
    '',
    '[역할과 톤]',
    '- 상담자는 부당한 일을 겪고 마음이 지친 근로자 또는 사업주일 수 있습니다.',
    '- 항상 따뜻하고 공감적이며, 동시에 전문적인 어조를 유지하세요.',
    '- 모든 답변은 반드시 한국어로 작성합니다.',
    '',
    '[답변 구조 - 반드시 이 순서를 지키세요]',
    '① 상황 공감: 상담자의 감정과 처지를 먼저 한두 문장으로 인정합니다.',
    '② 관련 노동법 조항/판례: 근로기준법 등 관련 법령이나 대법원 판례를 간략히 인용해 설명합니다.',
    '③ 즉시 취할 수 있는 실무 행동 1~3가지: 진정 접수, 증거 수집, 내용증명 등 구체적인 다음 행동을 제시합니다.',
    '',
    '[정확성 원칙 - 매우 중요]',
    '- 정확하지 않은 법조항은 절대로 지어내지 마세요.',
    '- 조문 번호나 판례 번호가 불확실하면 "정확한 조항 확인이 필요합니다"라고 솔직히 답하세요.',
    '- 일반론을 제시하되, 구체적 사실관계에 따라 결론이 달라질 수 있다는 점을 명확히 하세요.',
    '',
    '[전문 영역]',
    '- 부당해고 / 임금체불 / 퇴직금 / 연차수당 / 산업재해 / 직장 내 괴롭힘',
    '- 4대보험, 근로계약서, 휴게시간, 연장·야간·휴일근로, 실업급여 등',
    '',
    '[답변 마무리 고지문 - 반드시 답변 끝에 한 줄 추가]',
    '본 안내는 참고용이며, 사안에 따라 달라질 수 있습니다. 정확한 자문은 노무사 직접 상담을 권합니다.',
  ].join('\n');

  // 키 형식 검증을 위한 접두사. Google API 키는 보통 "AIza"로 시작합니다.
  const GOOGLE_API_KEY_PREFIX = 'AIza';
  // 키의 최소 길이(너무 짧으면 잘못된 입력으로 간주).
  const MIN_API_KEY_LENGTH = 30;

  // ---------------------------------------------------------------------------
  // 내부 헬퍼 함수
  // ---------------------------------------------------------------------------

  /**
   * 사용자에게 표시할 친근한 한국어 에러 메시지로 변환합니다.
   *
   * 왜 분리했는가:
   *  - HTTP 상태코드별로 메시지 분기를 한곳에 모아 일관성 있게 관리하기 위함입니다.
   *  - 영어 원본 에러를 그대로 노출하면 사용자가 당황할 수 있어 한국어로 감쌉니다.
   *
   * @param {number} status - fetch 응답의 HTTP 상태 코드
   * @returns {string} 사용자에게 보여줄 한국어 에러 메시지
   */
  function statusToFriendlyMessage(status) {
    if (status === 401 || status === 403) {
      return 'API 키가 유효하지 않습니다. 키를 다시 확인해주세요.';
    }
    if (status === 429) {
      return '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    }
    if (status >= 500) {
      return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    // 그 외 4xx (400, 404 등)
    return '요청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.';
  }

  /**
   * conversationHistory + userMessage 를 Gemini API가 요구하는
   * contents 배열 형태로 변환합니다.
   *
   * Gemini 스키마:
   *   contents: [
   *     { role: "user"|"model", parts: [{ text: "..." }] },
   *     ...
   *   ]
   *
   * 호출 측에서 넘긴 history 형식 ({role, text})을 parts 배열로 감싸주는 역할입니다.
   *
   * @param {Array<{role: 'user'|'model', text: string}>} history - 이전 대화 배열
   * @param {string} userMessage - 이번 turn에서 보낼 사용자 메시지
   * @returns {Array<object>} Gemini contents 배열
   */
  function buildContents(history, userMessage) {
    // history 가 배열이 아니면 빈 배열로 안전하게 시작합니다.
    const safeHistory = Array.isArray(history) ? history : [];

    // 기존 대화를 Gemini 스키마로 변환합니다.
    const mappedHistory = safeHistory
      // 비어있거나 형식이 어긋나는 항목은 걸러냅니다(방어적 코딩).
      .filter(
        (turn) =>
          turn &&
          (turn.role === 'user' || turn.role === 'model') &&
          typeof turn.text === 'string' &&
          turn.text.length > 0,
      )
      .map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      }));

    // 마지막에 이번 사용자 메시지를 user role로 덧붙입니다.
    mappedHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    return mappedHistory;
  }

  /**
   * Gemini 응답 JSON에서 모델이 생성한 텍스트만 안전하게 추출합니다.
   *
   * Gemini 응답은 candidates[0].content.parts[].text 구조이지만,
   * 차단(safety block)되거나 후보가 비어있는 경우가 있어 방어적으로 파싱합니다.
   *
   * @param {object} json - fetch 응답을 .json() 으로 파싱한 객체
   * @returns {string|null} 추출된 텍스트 또는 추출 실패 시 null
   */
  function extractTextFromResponse(json) {
    // 응답 자체가 비정상이면 바로 null.
    if (!json || typeof json !== 'object') return null;

    // promptFeedback.blockReason 이 있으면 안전 정책으로 차단된 경우입니다.
    if (json.promptFeedback && json.promptFeedback.blockReason) {
      return null;
    }

    const candidates = json.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const first = candidates[0];

    // finishReason 이 SAFETY/RECITATION 등이면 답변이 차단된 것으로 봅니다.
    if (
      first.finishReason &&
      first.finishReason !== 'STOP' &&
      first.finishReason !== 'MAX_TOKENS'
    ) {
      return null;
    }

    const parts = first.content && first.content.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;

    // 여러 part가 올 수 있으므로 모두 합쳐 반환합니다.
    const combined = parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();

    return combined.length > 0 ? combined : null;
  }

  // ---------------------------------------------------------------------------
  // 공개 API 함수
  // ---------------------------------------------------------------------------

  /**
   * 사용자 메시지를 Gemini로 보내고 모델 답변 텍스트를 받습니다.
   *
   * 흐름:
   *  1. 입력값 검증 (키 누락 / 메시지 누락)
   *  2. systemInstruction + contents 배열로 요청 본문 구성
   *  3. fetch 로 Gemini REST 호출
   *  4. HTTP 상태별 에러 변환 또는 텍스트 추출
   *
   * @param {string} apiKey - 사용자가 입력한 Google API 키
   * @param {Array<{role: 'user'|'model', text: string}>} conversationHistory - 이전 대화
   * @param {string} userMessage - 이번에 보낼 사용자 메시지
   * @returns {Promise<string>} 모델이 생성한 답변 텍스트
   * @throws {Error} 키 오류, 한도 초과, 네트워크 오류, 차단 등의 경우
   */
  async function sendMessage(apiKey, conversationHistory, userMessage) {
    // ---- 1. 입력 검증 ----
    // 키나 메시지가 비어있으면 네트워크 호출 전에 즉시 차단합니다.
    // (불필요한 API 호출과 비용 낭비를 막기 위함)
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('API 키가 비어있습니다. 키를 입력해주세요.');
    }
    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      throw new Error('보낼 메시지를 입력해주세요.');
    }

    // ---- 2. 요청 본문 구성 ----
    const contents = buildContents(conversationHistory, userMessage);

    const requestBody = {
      // systemInstruction: 모든 turn에 일관되게 적용되는 역할/규칙 지정.
      // contents 배열에 user role로 넣는 것보다 systemInstruction 필드가
      // Gemini가 권장하는 정석 방식입니다.
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: contents,
      // 생성 옵션. 너무 길면 모바일에서 답답하므로 적당히 제한합니다.
      generationConfig: {
        temperature: 0.7, // 너무 창의적이면 위험(법률 분야), 너무 0이면 딱딱함
        maxOutputTokens: 2048, // 한국어 기준 약 1500~2000자 수준
        topP: 0.95,
      },
    };

    // ---- 3. fetch 호출 ----
    // URL에 API 키를 붙이는 방식이 Google 공식 권장 방식입니다.
    // (Authorization 헤더는 OAuth 토큰용이라 일반 API 키와 다름)
    const url = `${API_BASE_URL}/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr) {
      // fetch 자체가 throw 하는 경우는 보통 네트워크 단절/CORS 등입니다.
      // 보안: 키가 포함된 url은 절대 로그로 찍지 않습니다.
      console.error('[GeminiAPI] 네트워크 호출 실패:', networkErr);
      throw new Error(
        '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      );
    }

    // ---- 4. 응답 처리 ----
    if (!response.ok) {
      // 오류 응답 본문을 시도해서 읽되, 실패해도 무시합니다.
      // (Google이 응답 본문에 message를 담아주는 경우가 많지만 필수는 아님)
      let serverDetail = '';
      try {
        const errJson = await response.json();
        serverDetail =
          (errJson && errJson.error && errJson.error.message) || '';
      } catch (_) {
        // 본문 파싱 실패는 무시 (status로만 판단)
      }

      // 보안: API 키는 절대 로그에 남기지 않고, 상태/세부 메시지만 기록합니다.
      console.error(
        `[GeminiAPI] HTTP ${response.status} 오류` +
          (serverDetail ? ` - ${serverDetail}` : ''),
      );

      throw new Error(statusToFriendlyMessage(response.status));
    }

    // 정상 응답 파싱.
    let json;
    try {
      json = await response.json();
    } catch (parseErr) {
      console.error('[GeminiAPI] 응답 JSON 파싱 실패:', parseErr);
      throw new Error(
        '응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    const text = extractTextFromResponse(json);
    if (!text) {
      // 후보가 없거나 안전정책으로 차단된 경우 등.
      throw new Error('답변을 생성할 수 없습니다. 다른 방식으로 질문해주세요.');
    }

    return text;
  }

  /**
   * API 키의 유효성을 가볍게 검사합니다.
   *
   * 정책 결정:
   *  - 실제 네트워크 호출(ping) 방식은 API 사용량/요금이 발생하고
   *    Google의 키 메타 검증 엔드포인트가 따로 없어 일관성이 떨어집니다.
   *  - 따라서 형식(접두사 + 길이) 체크만 수행합니다.
   *  - 실제 호출에서 401/403이 나면 sendMessage가 자연스럽게 잡아냅니다.
   *
   * @param {string} apiKey - 검증할 API 키
   * @returns {Promise<boolean>} 형식이 유효해 보이면 true
   */
  async function validateApiKey(apiKey) {
    // 비동기 시그니처를 유지해 향후 실제 ping 호출로 교체하기 쉽게 합니다.
    if (typeof apiKey !== 'string') return false;

    const trimmed = apiKey.trim();

    // 1) 길이 검증
    if (trimmed.length < MIN_API_KEY_LENGTH) return false;

    // 2) 접두사 검증 (Google API 키 표준)
    if (!trimmed.startsWith(GOOGLE_API_KEY_PREFIX)) return false;

    // 3) 공백/줄바꿈 같은 비정상 문자가 섞여있으면 실패 처리
    if (/\s/.test(trimmed)) return false;

    return true;
  }

  // ---------------------------------------------------------------------------
  // 전역 노출
  // ---------------------------------------------------------------------------
  // app.js 에서 window.GeminiAPI.sendMessage(...) 형태로 사용합니다.
  window.GeminiAPI = {
    sendMessage: sendMessage,
    validateApiKey: validateApiKey,
  };
})();
