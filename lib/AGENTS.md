# lib — Utilities / Types / MCP Client AGENTS.md

## Module Context

프로젝트 전반에서 공유하는 유틸리티, 타입 정의, 서버 설정, MCP 클라이언트 래퍼의 전용 디렉터리.
서버/클라이언트 양쪽에서 참조되므로 **파일별 실행 환경을 명확히 구분**한다.

**의존 관계:**
- 다른 모듈(`app/api/`, `hooks/`, `components/`)이 이 디렉터리를 참조한다.
- 이 디렉터리는 다른 앱 레이어(`app/`, `components/`, `hooks/`)를 역방향 참조하지 않는다.

---

## 디렉터리 구조

```
lib/
  types/
    chat.ts          # Message, Role, ChatSession 등 채팅 관련 타입
    mcp.ts           # McpServer, McpTool, McpCallResult 타입
    api.ts           # API 요청/응답 공통 타입 (ApiError 등)
  config.ts          # 환경 변수 읽기 (서버 전용)
  errors.ts          # 에러 코드 정의 + toApiError 함수
  utils.ts           # cn(), sleep(), maskSecret() 등 범용 유틸
  storage.ts         # localStorage 키 상수 + 직렬화 헬퍼
  mcp/
    client.ts        # MCP 서버 연결/호출 클라이언트 래퍼
    types.ts         # MCP 프로토콜 관련 내부 타입
```

---

## Tech Stack & Constraints

- **순수 TypeScript 유틸:** 외부 의존성 최소화. Node.js 내장 모듈 또는 이미 설치된 패키지만 사용.
- **`config.ts`:** 서버 전용 파일. `"use client"` 파일에서 import 금지.
- **`utils.ts`:** 클라이언트/서버 공용. `window`, `localStorage`, `process.env` 참조 금지.
- **MCP Client:** `@modelcontextprotocol/sdk` 패키지 사용 (설치 필요 시 `pnpm add @modelcontextprotocol/sdk`).

---

## Implementation Patterns

### config.ts — 서버 전용 환경변수

```typescript
// lib/config.ts
// 이 파일은 서버 사이드(Route Handler)에서만 import한다.

interface AppConfig {
  geminiApiKey: string;
  llmModel: string;
}

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const llmModel = process.env.LLM_MODEL ?? "gemini-2.0-flash";

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return { geminiApiKey, llmModel };
}
```

### errors.ts — 통일된 에러 처리

```typescript
// lib/errors.ts

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "LLM_ERROR"
  | "MCP_ERROR"
  | "INVALID_REQUEST"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export function toApiError(err: unknown): Response {
  if (err instanceof Error) {
    const status = resolveStatus(err);
    const code = resolveCode(err);
    return Response.json({ code, message: err.message } satisfies ApiError, { status });
  }
  return Response.json(
    { code: "INTERNAL_ERROR", message: "알 수 없는 오류가 발생했습니다." } satisfies ApiError,
    { status: 500 }
  );
}

function resolveStatus(err: Error): number {
  if (err.message.includes("401") || err.message.includes("403")) return 401;
  if (err.message.includes("429")) return 429;
  return 500;
}

function resolveCode(err: Error): ApiErrorCode {
  if (err.message.includes("429")) return "RATE_LIMITED";
  if (err.message.includes("401") || err.message.includes("403")) return "UNAUTHORIZED";
  return "INTERNAL_ERROR";
}
```

### types/chat.ts 기본 타입

```typescript
// lib/types/chat.ts

export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  mcpResult?: McpCallResult;
  createdAt?: number;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: number;
}
```

### storage.ts — localStorage 키 관리

```typescript
// lib/storage.ts

export const STORAGE_KEYS = {
  MCP_SERVERS: "mcp:servers",
  LAST_SESSION: "chat:last-session",
} as const;
```

---

## Testing Strategy

```bash
# 유틸 함수 단위 테스트
pnpm test -- lib/

# 타입 검증 (런타임 테스트 대신 tsc로 확인)
pnpm typecheck
```

`errors.ts`, `config.ts`의 예외 경로를 집중 테스트한다.

---

## Local Golden Rules

### Do's

- `config.ts`에 환경 변수 접근을 집중시킨다. 누락 시 명확한 에러 메시지로 즉시 실패(fail-fast).
- 타입 파일은 `interface`와 `type`을 역할에 따라 일관성 있게 사용한다.
- `utils.ts`의 `maskSecret(key: string)`: 앞 4자리 + `****` 형식으로 마스킹.
- MCP 클라이언트는 연결 실패 시 `MCP_ERROR` 코드로 래핑하여 상위에 전달.

### Don'ts

- `lib/config.ts`를 클라이언트 컴포넌트나 훅에서 import하지 않는다.
- `lib/types/`에 비즈니스 로직(함수)을 추가하지 않는다. 타입 정의만 포함.
- `utils.ts`에 특정 도메인 로직(채팅, MCP 등)을 혼재하지 않는다.
- MCP 서버의 자격증명(토큰, 비밀번호)을 메모리 밖(localStorage, 로그)에 노출하지 않는다.
