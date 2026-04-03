import { toApiError } from "@/lib/errors";
import { getConnectedToolsWithServer } from "@/lib/mcp/manager.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tools = getConnectedToolsWithServer();
    return Response.json(tools);
  } catch (error) {
    return toApiError(error);
  }
}
