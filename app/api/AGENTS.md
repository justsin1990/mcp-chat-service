# app/api — Route Handler AGENTS.md

## Module Context

Next.js App Router의 Route Handler 전용 영역.
Gemini API 호출, SSE 스트리밍, MCP 서버 프록시 등 **모든 서버 사이드 I/O**가 여기에 위치한다.
클라이언트는 이 디렉터리의 엔드포인트를 `fetch`로만 호출한다.

**의존 관계:**
- `lib/config.ts` — 환경 변수 읽기 (이 파일에서 `process.env` 직접 참조 금지)
- `lib/errors.ts` — 통일된 에러 응답 생성
- `lib/types/` — 요청/응답 타입 공유

---

## Endpoint 구조

```
app/api/
  chat/
    stream/
      route.ts       # POST — Gemini SSE 스트리밍
  mcp/
    servers/
      route.ts       # GET(목록), POST(등록)
    [id]/
      route.ts       # DELETE(삭제)
    call/
      route.ts       # POST — MCP Tool 호출 프록시
```

---

## Tech Stack & Constraints

- **Runtime:** Node.js (Edge Runtime 사용 금지 — MCP 클라이언트 호환성)
- **LLM SDK:** `@google/generative-ai` 또는 Vercel AI SDK (`ai` 패키지)
- **스트리밍:** `ReadableStream` + `TransformStream` or `StreamingTextResponse`
- **HTTP 클라이언트:** 내장 `fetch` 사용. axios 추가 금지(MVP).

---

## Implementation Patterns

### SSE 스트리밍 Route Handler 보일러플레이트

```typescript
// app/api/chat/stream/route.ts
import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { toApiError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const { geminiApiKey, llmModel } = getConfig();

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // LLM 스트리밍 시작 (비동기, 백그라운드)
    streamGemini(messages, geminiApiKey, llmModel, writer).catch(() =>
      writer.close()
    );

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return toApiError(err);
  }
}
```

### 통일된 에러 응답

모든 에러는 `lib/errors.ts`의 `toApiError`를 통해 반환한다.

```typescript
// 직접 작성 금지 — 항상 toApiError 사용
return Response.json({ code: "UNAUTHORIZED", message: "..." }, { status: 401 });
```

### 에러 코드 매핑

| HTTP Status | code |
|---|---|
| 401 / 403 | `UNAUTHORIZED` |
| 429 | `RATE_LIMITED` |
| 5xx (LLM) | `LLM_ERROR` |
| 400 | `INVALID_REQUEST` |
| 500 | `INTERNAL_ERROR` |

---

## Testing Strategy

```bash
# 단위 테스트 (Route Handler 로직 분리 후)
pnpm test -- app/api

# 통합 테스트 (개발 서버 실행 후 수동 또는 curl)
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "hello"}]}'
```

---

## Local Golden Rules

### Do's

- `export const runtime = "nodejs"` 를 각 route 파일 상단에 명시한다.
- 요청 body는 `zod` 또는 수동 검증으로 반드시 검증한다.
- 스트리밍 도중 에러 발생 시 SSE `event: error` 청크를 전송하고 스트림을 닫는다.
- MCP Tool 호출은 타임아웃(30s)을 설정한다.
- `AbortSignal`을 LLM 호출에 전달하여 클라이언트 연결 끊김 시 즉시 중단한다.

### Don'ts

- Route Handler 내부에서 `process.env`를 직접 읽지 않는다. `lib/config.ts` 경유 필수.
- 응답 body에 스택 트레이스, API 키, 내부 경로를 포함하지 않는다.
- `GET` 메서드로 스트리밍 응답을 제공하지 않는다 (캐싱 문제).
- MCP 서버 정보(URL, 자격증명)를 응답 body에 그대로 반환하지 않는다.
