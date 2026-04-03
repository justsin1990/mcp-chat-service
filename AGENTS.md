# MCP Chat Service — Root AGENTS.md

## Project Context

MCP Host & Client 채팅 서비스. Next.js App Router 기반으로 FE/BE를 통합하고,
Gemini API를 서버 사이드에서 호출하여 SSE 스트리밍으로 클라이언트에 전달한다.
MCP(Model Context Protocol) 서버를 연결·관리하고 Tool 호출 결과를 채팅 타임라인에 표시하는 것이 핵심 목표다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Lucide, pnpm

**MVP Scope:** Gemini 연동 채팅 + SSE 스트리밍 + MCP 서버 등록/호출 + localStorage 세션 저장

---

## Operational Commands

```bash
pnpm install          # 의존성 설치
pnpm dev              # 개발 서버 (Next.js)
pnpm build            # 프로덕션 빌드
pnpm start            # 프로덕션 서버
pnpm lint             # ESLint 검사
pnpm format           # Prettier 포맷 (설정 시)
pnpm typecheck        # tsc --noEmit 타입 체크
pnpm test             # 테스트 실행 (설정 시)
```

환경 변수 파일: `.env.local` (커밋 금지)

```
GEMINI_API_KEY=
LLM_MODEL=gemini-2.0-flash
```

---

## Golden Rules

### Immutable (절대 불변)

- API 키는 서버 사이드(`process.env`)에서만 읽는다. 클라이언트 번들에 포함 금지.
- Gemini API, MCP 서버 호출은 Route Handler(서버)에서만 수행한다. 클라이언트 직접 호출 금지.
- `.env.local`, 시크릿, API 응답 원문 로그를 커밋하지 않는다.
- 모든 파일은 500 LOC 미만. 초과 시 즉시 분리.
- `app/api/` 외부에서 `process.env`를 직접 읽지 않는다. 서버 전용 config 모듈을 경유한다.

### Do's

- 공식 Gemini SDK(`@google/generative-ai`) 또는 공식 AI SDK를 사용한다.
- Route Handler에서 에러는 반드시 통일된 `{ code, message }` 형식으로 반환한다.
- 스트리밍 응답은 `AbortController`로 취소 가능하게 구현한다.
- 컴포넌트는 shadcn/ui 우선 사용, 직접 스타일은 Tailwind만 사용한다.
- 접근성: `aria-*` 속성, 키보드 포커스, 로딩/에러 상태를 명시한다.
- 타입은 `interface` 우선, 유니온 타입은 `type` 사용.
- 경로 별칭은 `@/` prefix 사용 (tsconfig paths 설정).

### Don'ts

- `any` 타입 사용 금지. 불가피한 경우 `unknown` + 타입 가드로 처리.
- `console.log`를 프로덕션 코드에 남기지 않는다. 디버그는 `console.error` + 마스킹.
- inline style(`style={{}}`) 사용 금지. Tailwind 클래스로 대체.
- `useEffect`로 데이터 페칭 금지. Server Component 또는 Route Handler 사용.
- localStorage에 API 키, 토큰 등 민감 정보를 저장하지 않는다.
- 전역 상태 관리 라이브러리(Zustand, Redux 등)를 MVP 단계에서 무분별하게 추가하지 않는다.

---

## Standards & References

### 코딩 컨벤션

- 파일명: `kebab-case` (컴포넌트 파일은 `PascalCase.tsx` 허용)
- 컴포넌트: named export 우선 (`export function Foo`)
- 훅: `use` prefix 필수 (`useChat`, `useMcpServers`)
- 서버 전용 파일: `*.server.ts` suffix 또는 `app/api/` 하위에만 위치
- 타입/인터페이스 파일: `lib/types/` 하위 집중 관리

### Git 전략

- 브랜치: `main` (프로덕션), `feat/*`, `fix/*`, `chore/*`
- 커밋 메시지: 한국어, 명령형 현재 시제
  - 예: `feat: 채팅 스트리밍 SSE 엔드포인트 추가`
  - 예: `fix: Gemini 429 에러 핸들링 수정`
  - 예: `chore: shadcn/ui button 컴포넌트 추가`

### Maintenance Policy

규칙과 코드 구현 사이에 괴리가 발견되면 즉시 이 파일 또는 해당 하위 AGENTS.md 수정을 제안한다.
새 라이브러리/패턴 도입 시 관련 하위 AGENTS.md에 반영한다.

---

## Context Map (Action-Based Routing)

작업 영역에 따라 아래 하위 AGENTS.md를 먼저 읽고 작업한다.

- **[API Route 작성 / LLM 호출 / SSE 스트리밍](./app/api/AGENTS.md)** — Route Handler 생성, Gemini 연동, 스트리밍 구현, MCP 서버 프록시 작업 시.
- **[UI 컴포넌트 / 레이아웃 / 스타일링](./components/AGENTS.md)** — shadcn/ui 컴포넌트 추가·수정, Tailwind 스타일링, 채팅 버블·카드 UI 작업 시.
- **[커스텀 훅 / 클라이언트 상태](./hooks/AGENTS.md)** — `useChat`, `useMcpServers`, `useStream` 등 클라이언트 상태 및 훅 작성 시.
- **[유틸리티 / 타입 / MCP 클라이언트](./lib/AGENTS.md)** — 공유 타입 정의, 에러 매핑, MCP 클라이언트 래퍼, 서버 config 모듈 작업 시.
