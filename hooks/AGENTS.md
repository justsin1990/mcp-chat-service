# hooks — Custom Hooks AGENTS.md

## Module Context

클라이언트 사이드 상태 관리 및 비즈니스 로직 캡슐화 전용 디렉터리.
컴포넌트에서 직접 API 호출하거나 복잡한 상태를 관리하는 코드를 이 훅으로 분리한다.
모든 훅은 `"use client"` 환경(브라우저)에서 실행된다.

**의존 관계:**
- `lib/types/` — 훅 반환값 타입 참조
- `lib/storage.ts` — localStorage 읽기/쓰기 추상화
- `app/api/` — fetch 엔드포인트 호출 대상

---

## 훅 목록 (예정)

```
hooks/
  useChat.ts           # 채팅 메시지 상태 + SSE 스트리밍 전송/취소
  useMcpServers.ts     # MCP 서버 등록/삭제/목록 (localStorage 연동)
  useStream.ts         # SSE ReadableStream 소비 로직 (useChat 내부 사용)
  useLocalStorage.ts   # 타입 안전한 localStorage get/set 래퍼
```

---

## Tech Stack & Constraints

- **상태:** React `useState`, `useReducer`, `useRef` 우선. Zustand/Jotai 등 전역 스토어는 MVP에서 도입 금지.
- **사이드 이펙트:** `useEffect` 사용 시 cleanup 함수 필수 (AbortController, 이벤트 제거 등).
- **SSE 소비:** `EventSource` 대신 `fetch` + `ReadableStream`으로 처리 (POST 요청 필요).

---

## Implementation Patterns

### useChat 구조

```typescript
// hooks/useChat.ts
"use client";

import { useState, useRef, useCallback } from "react";
import type { Message } from "@/lib/types/chat";

interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    abortRef.current = new AbortController();
    setIsStreaming(true);
    setError(null);

    // 유저 메시지 즉시 추가
    setMessages((prev) => [...prev, { role: "user", content, id: crypto.randomUUID() }]);

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const { message } = await res.json();
        throw new Error(message ?? "스트리밍 요청 실패");
      }

      // AI 메시지 자리 확보
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

      // 스트림 소비
      await consumeStream(res.body!, assistantId, setMessages);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, error, sendMessage, cancelStream, clearMessages: () => setMessages([]) };
}
```

### useLocalStorage 패턴

```typescript
// hooks/useLocalStorage.ts
"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored) as T);
    } catch {
      // 무시 — 초기값 유지
    }
  }, [key]);

  const setAndStore = (newValue: T) => {
    setValue(newValue);
    try {
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch {
      // 무시 — 메모리 상태는 유지
    }
  };

  return [value, setAndStore] as const;
}
```

---

## Testing Strategy

```bash
# 훅 단위 테스트 (vitest + @testing-library/react-hooks 권장)
pnpm test -- hooks/
```

테스트 우선순위: `useChat` (스트리밍 중단 케이스), `useLocalStorage` (파싱 에러 케이스)

---

## Local Golden Rules

### Do's

- 훅 파일 상단에 `"use client"` 지시어 명시.
- `useEffect` 내부에서 fetch 시 반드시 `AbortController`로 cleanup.
- 에러 상태는 `string | null` 타입으로 통일 (`Error` 객체 직접 노출 금지).
- localStorage 접근은 `try-catch`로 감싼다 (SSR 빌드 오류 방지 포함).
- 훅은 단일 책임. 너무 커지면 내부 헬퍼 함수나 별도 훅으로 분리.

### Don'ts

- 훅에서 DOM 직접 조작 금지. ref를 컴포넌트에서 전달받아 사용.
- `window`, `localStorage` 를 Server Component에서 참조하지 않는다.
- 훅 내부에서 다른 훅을 조건부 호출 금지 (React 훅 규칙).
- 전역 싱글턴 상태를 모듈 레벨 변수로 관리하지 않는다.
