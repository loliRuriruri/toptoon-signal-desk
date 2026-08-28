const allowedMediaHosts = new Set([
  "showcase.chat.toptoon.com",
  "showcase.chat.toptoon.jp",
  "showcase.chat.global.toptoon.com",
  "showcase.chat.toptoon.net"
]);

function validatedMediaUrl(rawValue) {
  if (!rawValue || rawValue.length > 500) return null;
  try {
    const url = new URL(rawValue);
    const validPath = [
      /^\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i,
      /^\/banner\/main-top\/[a-z0-9-]+\.mp4$/i
    ].some((pattern) => pattern.test(url.pathname));
    return url.protocol === "https:" && allowedMediaHosts.has(url.hostname) && validPath && !url.search ? url : null;
  } catch {
    return null;
  }
}

async function proxyMedia(request, requestUrl) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const mediaUrl = validatedMediaUrl(requestUrl.searchParams.get("src"));
  if (!mediaUrl) return new Response("Invalid media source", { status: 400 });

  const upstreamHeaders = new Headers();
  const range = request.headers.get("Range");
  if (range) upstreamHeaders.set("Range", range);
  const upstream = await fetch(mediaUrl, { method: request.method, headers: upstreamHeaders });
  if (!upstream.ok) return new Response("Motion preview unavailable", { status: upstream.status });

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") || "video/mp4",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline"
  });
  for (const name of ["Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/media-proxy") {
      try {
        return await proxyMedia(request, url);
      } catch {
        return new Response("Motion preview temporarily unavailable", { status: 502 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
