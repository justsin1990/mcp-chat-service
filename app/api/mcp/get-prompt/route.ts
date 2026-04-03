import { NextRequest } from "next/server";

import { AppError, toApiError } from "@/lib/errors";
import { getPrompt } from "@/lib/mcp/manager.server";

export const runtime = "nodejs";

interface GetPromptBody {
  serverId: string;
  name: string;
  arguments?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GetPromptBody;

    if (!body.serverId || !body.name) {
      throw new AppError(
        "INVALID_REQUEST",
        400,
        "serverId와 name은 필수입니다.",
      );
    }

    const result = await getPrompt(body.serverId, body.name, body.arguments);
    return Response.json(result);
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
          : "Prompt 조회에 실패했습니다.",
      ),
    );
  }
}
