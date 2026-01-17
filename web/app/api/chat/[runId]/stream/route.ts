import { getRun } from "workflow/api";
import { createUIMessageStreamResponse } from "ai";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam
    ? parseInt(startIndexParam, 10)
    : undefined;

  try {
    const run = getRun(runId);
    const stream = run.getReadable({ startIndex });

    // Use createUIMessageStreamResponse to properly format the WDK stream
    return createUIMessageStreamResponse({
      stream,
      headers: {
        "x-workflow-run-id": runId,
      },
    });
  } catch (error) {
    console.error("[WDK] Failed to resume stream:", error);
    return new Response("Run not found", { status: 404 });
  }
}
