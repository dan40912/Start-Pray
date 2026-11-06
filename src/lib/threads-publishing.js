import { getThreadsPublishSettings } from "./siteSettings.js";

function graphUrl(path, version) {
  return `https://graph.threads.net/${version}/${path}`;
}

async function readGraphResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Threads API returned HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 1000));
  }
  return data;
}

export function buildThreadsPostText(
  cardId,
  title = "",
  baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://startpray.online"
) {
  const cardUrl = new URL(`/prayfor/${Number(cardId)}`, baseUrl).toString();
  const safeTitle = String(title).replace(/[\r\n]+/g, " ").trim();
  return `請幫他/她代禱:\n\n${safeTitle}\n${cardUrl}\n\n奉主耶穌基督的名求，阿們。\n\n如果您有需要代禱的，請到網站上或聯絡我們喔!`;
}

export async function publishThreadsText(text, { fetchImpl = fetch, settings } = {}) {
  const config = settings || await getThreadsPublishSettings();
  const { userId, accessToken } = config;
  const graphVersion = config.graphApiVersion || "v1.0";
  if (!userId?.trim() || !accessToken?.trim()) {
    const error = new Error("Threads 設定尚未完成，請確認帳號 ID 與 Access Token。");
    error.status = 503;
    throw error;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const timeout = AbortSignal.timeout(20000);
  const containerBody = new URLSearchParams({ media_type: "TEXT", text });
  const container = await readGraphResponse(await fetchImpl(graphUrl(`${encodeURIComponent(userId)}/threads`, graphVersion), {
    method: "POST",
    headers,
    body: containerBody,
    signal: timeout,
    cache: "no-store",
  }));

  if (!container?.id) throw new Error("Threads API 沒有回傳貼文容器 ID。" );

  const publishBody = new URLSearchParams({ creation_id: container.id });
  const published = await readGraphResponse(await fetchImpl(graphUrl(`${encodeURIComponent(userId)}/threads_publish`, graphVersion), {
    method: "POST",
    headers,
    body: publishBody,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  }));
  if (!published?.id) throw new Error("Threads API 沒有回傳已發布貼文 ID。" );

  let permalink = null;
  try {
    const lookup = await readGraphResponse(await fetchImpl(
      `${graphUrl(encodeURIComponent(published.id), graphVersion)}?fields=permalink`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000), cache: "no-store" }
    ));
    permalink = typeof lookup?.permalink === "string" ? lookup.permalink : null;
  } catch {
    // A permalink lookup failure must not turn an already published post into
    // a failed job that an admin might publish a second time.
  }

  return { postId: String(published.id), permalink };
}
