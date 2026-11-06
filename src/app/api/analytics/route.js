import { analyticsIdentity, recordAnalyticsPage } from "@/lib/server-analytics";
import { readSessionUser } from "@/lib/server-session";
import { PAGE_TYPES, SOURCES } from "@/lib/analytics-shared.mjs";

async function readEvent(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode());
      bytes += value.byteLength;
      if (bytes > 256) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request) {
  const identity = analyticsIdentity(request);
  if (!identity) return new Response(null, { status: 204 });
  // Browser collection is only accepted from this site's own origin.
  if (request.headers.get("sec-fetch-site") !== "same-origin" ||
      !request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 403 });
  }
  const data = await readEvent(request);
  if (!PAGE_TYPES.includes(data?.page) || !SOURCES.includes(data?.source)) {
    return new Response(null, { status: 400 });
  }
  try {
    await recordAnalyticsPage(identity, data.page, data.source, Boolean(readSessionUser()));
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
