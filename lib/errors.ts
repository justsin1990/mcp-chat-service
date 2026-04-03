export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "LLM_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toApiError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        code: error.code,
        message: error.message,
      } satisfies ApiErrorBody,
      { status: error.status },
    );
  }

  return Response.json(
    {
      code: "INTERNAL_ERROR",
      message: "요청 처리 중 오류가 발생했습니다.",
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}
