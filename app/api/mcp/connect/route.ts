import { NextRequest } from "next/server";

import { AppError, toApiError } from "@/lib/errors";
import { connectServer } from "@/lib/mcp/manager.server";
import type { McpServer } from "@/lib/types/mcp";

export const runtime = "nodejs";

interface ConnectRequestBody {
  server: McpServer;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConnectRequestBody;

    if (!body.server?.id || !body.server?.transport) {
      throw new AppError(
        "INVALID_REQUEST",
        400,
        "서버 정보가 올바르지 않습니다.",
      );
    }

    const status = await connectServer(body.server);
    return Response.json(status);
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
          : "MCP 서버 연결에 실패했습니다.",
      ),
    );
  }
}
