import { NextRequest } from "next/server";

import { AppError, toApiError } from "@/lib/errors";
import { disconnectServer } from "@/lib/mcp/manager.server";

export const runtime = "nodejs";

interface DisconnectRequestBody {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DisconnectRequestBody;

    if (!body.id || typeof body.id !== "string") {
      throw new AppError(
        "INVALID_REQUEST",
        400,
        "서버 ID가 필요합니다.",
      );
    }

    await disconnectServer(body.id);
    return Response.json({ id: body.id, status: "idle" });
  } catch (error) {
    if (error instanceof AppError) {
      return toApiError(error);
    }
    return toApiError(
      new AppError(
        "MCP_ERROR",
        500,
        error instanceof Error
          ? error.message
          : "MCP 서버 연결 해제에 실패했습니다.",
      ),
    );
  }
}
