import { NextRequest } from "next/server";

import { AppError, toApiError } from "@/lib/errors";
import { readResource } from "@/lib/mcp/manager.server";

export const runtime = "nodejs";

interface ReadResourceBody {
  serverId: string;
  uri: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReadResourceBody;

    if (!body.serverId || !body.uri) {
      throw new AppError(
        "INVALID_REQUEST",
        400,
        "serverId와 uri는 필수입니다.",
      );
    }

    const result = await readResource(body.serverId, body.uri);
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
          : "Resource 읽기에 실패했습니다.",
      ),
    );
  }
}
