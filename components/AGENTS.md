# components — UI Component AGENTS.md

## Module Context

shadcn/ui + Tailwind CSS 기반 UI 컴포넌트 전용 디렉터리.
모든 컴포넌트는 **순수 클라이언트 UI** 역할만 수행하고, 데이터 페칭/API 호출은 하지 않는다.
비즈니스 로직은 `hooks/`로 분리하고, 컴포넌트는 props 기반 렌더링에 집중한다.

**의존 관계:**
- `hooks/` — 데이터·상태 소비
- `lib/types/` — props 타입 참조
- shadcn/ui 레지스트리 (`components/ui/` 하위 자동 생성)

---

## 디렉터리 구조

```
components/
  ui/                     # shadcn/ui 자동 생성 컴포넌트 (직접 수정 최소화)
  chat/
    ChatTimeline.tsx      # 메시지 목록 스크롤 컨테이너
    MessageBubble.tsx     # 유저/AI 말풍선
    McpResultCard.tsx     # MCP Tool 호출 결과 카드
    StreamingIndicator.tsx # 스트리밍 중 로딩 표시
  layout/
    Header.tsx            # 모델/서버 관리 진입점
    ChatInput.tsx         # 입력창 + 전송 버튼 + "/" 힌트
  mcp/
    McpServerList.tsx     # 등록된 MCP 서버 목록
    McpServerDialog.tsx   # 서버 추가/수정 다이얼로그
  shared/
    ErrorBanner.tsx       # 에러 + 재시도 버튼
    SecurityWarningBanner.tsx # localStorage 보안 경고
```

---

## Tech Stack & Constraints

- **UI 라이브러리:** shadcn/ui (Radix UI 기반). 직접 Radix 사용은 shadcn에 없을 때만.
- **스타일:** Tailwind CSS 4 클래스만 사용. `style={{}}` 금지.
- **아이콘:** Lucide (`lucide-react`). 다른 아이콘 라이브러리 추가 금지(MVP).
- **애니메이션:** Tailwind `transition-*`, `animate-*` 우선. Framer Motion은 신중히 도입.

### shadcn/ui 컴포넌트 추가 방법

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add scroll-area
pnpm dlx shadcn@latest add badge
```

---

## Implementation Patterns

### 컴포넌트 기본 구조

```typescript
// components/chat/MessageBubble.tsx
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 max-w-[80%] text-sm",
        role === "user"
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto bg-muted text-foreground"
      )}
      aria-label={`${role} 메시지`}
    >
      {content}
      {isStreaming && <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-1" />}
    </div>
  );
}
```

### cn 유틸 사용 규칙

조건부 클래스는 항상 `cn()` (lib/utils.ts)을 사용한다. 삼항 연산자 직접 병합 금지.

### 레이아웃 원칙

- Header (고정 상단): 모델 선택, MCP 서버 관리 버튼
- ChatTimeline (스크롤 가능 본문): `flex-1 overflow-y-auto`
- ChatInput (고정 하단): `sticky bottom-0`

---

## Accessibility Requirements

모든 컴포넌트에서 반드시 준수:

- 버튼에 `aria-label` 또는 명확한 텍스트 레이블
- 로딩 상태에 `aria-busy="true"` 또는 `role="status"`
- 에러 메시지에 `role="alert"`
- 다이얼로그에 `aria-modal="true"` (shadcn Dialog가 자동 처리)
- 포커스 트랩: 다이얼로그 열릴 때 내부 포커스 유지

---

## Local Golden Rules

### Do's

- 컴포넌트 파일명은 `PascalCase.tsx`.
- `"use client"` 지시어는 최상단에, 필요한 컴포넌트에만 추가.
- 에러 상태는 `ErrorBanner` 공용 컴포넌트로 처리.
- 스트리밍 체감을 최우선: 첫 청크 도착 즉시 렌더링 시작.
- 긴 텍스트는 `break-words` 또는 `whitespace-pre-wrap` 적용.

### Don'ts

- 컴포넌트 내부에서 `fetch`, `useEffect` 데이터 페칭 금지.
- `components/ui/` 하위 shadcn 자동 생성 파일을 직접 대규모 수정하지 않는다.
- 하나의 컴포넌트에 500 LOC 초과 금지. 초과 시 하위 컴포넌트로 분리.
- `z-index`를 임의 숫자로 하드코딩하지 않는다. Tailwind `z-*` 클래스 사용.
