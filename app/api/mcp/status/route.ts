import { NextRequest } from "next/server";

import { toApiError } from "@/lib/errors";
import { getAllStatuses } from "@/lib/mcp/manager.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const idsParam = searchParams.get("ids");
    const ids = idsParam
      ? idsParam.split(",").filter(Boolean)
      : undefined;

    const statuses = getAllStatuses(ids);
    return Response.json(statuses);
  } catch (error) {
    return toApiError(error);
  }
}
