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
  // 사용 모델 — gemini-2.5-flash (2026년 4월 기준 안정 출시 모델)
  // 'gemini-3-flash-preview' 같은 미공개/존재불명 모델로 두면 404 응답이 발생
  const MODEL_NAME = 'gemini-2.5-flash';

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
    if (status === 404) {
      return '모델을 찾을 수 없습니다. 관리자에게 알려주세요.';
    }
    return '요청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.';
  }

  function buildContents(history, userMessage) {
    const safeHistory = Array.isArray(history) ? history : [];
    const mappedHistory = safeHistory
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
    mappedHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });
    return mappedHistory;
  }

  function extractTextFromResponse(json) {
    if (!json || typeof json !== 'object') return null;
    if (json.promptFeedback && json.promptFeedback.blockReason) {
      return null;
    }
    const candidates = json.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }
    const first = candidates[0];
    if (
      first.finishReason &&
      first.finishReason !== 'STOP' &&
      first.finishReason !== 'MAX_TOKENS'
    ) {
      return null;
    }
    const parts = first.content && first.content.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const combined = parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    return combined.length > 0 ? combined : null;
  }

  // ---------------------------------------------------------------------------
  // 공개 API 함수
  // ---------------------------------------------------------------------------

  async function sendMessage(apiKey, conversationHistory, userMessage) {
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('API 키가 비어있습니다. 키를 입력해주세요.');
    }
    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      throw new Error('보낼 메시지를 입력해주세요.');
    }

    const contents = buildContents(conversationHistory, userMessage);

    const requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    };

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
      console.error('[GeminiAPI] 네트워크 호출 실패:', networkErr);
      throw new Error(
        '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      );
    }

    if (!response.ok) {
      let serverDetail = '';
      try {
        const errJson = await response.json();
        serverDetail =
          (errJson && errJson.error && errJson.error.message) || '';
      } catch (_) {
      }
      console.error(
        `[GeminiAPI] HTTP ${response.status} 오류` +
          (serverDetail ? ` - ${serverDetail}` : ''),
      );
      throw new Error(statusToFriendlyMessage(response.status));
    }

    let json;
    try {
      json = await response.json();
    } catch (parseErr) {
      console.error('[GeminiAPI] 응답 JSON 파싱 실패:', parseErr);
      throw new Error('응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }

    const text = extractTextFromResponse(json);
    if (!text) {
      throw new Error('답변을 생성할 수 없습니다. 다른 방식으로 질문해주세요.');
    }

    return text;
  }

  async function validateApiKey(apiKey) {
    if (typeof apiKey !== 'string') return false;
    const trimmed = apiKey.trim();
    if (trimmed.length < MIN_API_KEY_LENGTH) return false;
    if (!trimmed.startsWith(GOOGLE_API_KEY_PREFIX)) return false;
    if (/\s/.test(trimmed)) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 전역 노출
  // ---------------------------------------------------------------------------
  window.GeminiAPI = {
    sendMessage: sendMessage,
    validateApiKey: validateApiKey,
  };
})();
