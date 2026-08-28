import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const portFlag = process.argv.indexOf("--port");
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.argv[2] || 8788);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
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
    const validPath = /^\/character\/\d+\/video-thumbnail\/[a-z0-9-]+\.mp4$/i.test(url.pathname);
    return url.protocol === "https:" && allowedMediaHosts.has(url.hostname) && validPath && !url.search ? url : null;
  } catch {
    return null;
  }
}

async function proxyMedia(request, response, requestUrl) {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  const mediaUrl = validatedMediaUrl(requestUrl.searchParams.get("src"));
  if (!mediaUrl) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Invalid media source");
    return;
  }
  const headers = {};
  if (request.headers.range) headers.Range = request.headers.range;
  const upstream = await fetch(mediaUrl, { method: request.method, headers });
  if (!upstream.ok) {
    response.writeHead(upstream.status, { "Content-Type": "text/plain; charset=utf-8" }).end("Motion preview unavailable");
    return;
  }
  const responseHeaders = {
    "Content-Type": upstream.headers.get("content-type") || "video/mp4",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline"
  };
  for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  response.writeHead(upstream.status, responseHeaders);
  if (request.method === "HEAD" || !upstream.body) response.end();
  else Readable.fromWeb(upstream.body).pipe(response);
}

async function loadLocalEnvironment() {
  try {
    const body = await readFile(join(projectRoot, ".env.local"), "utf8");
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      if (/^[A-Z][A-Z0-9_]*$/.test(key) && process.env[key] == null) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("Could not read .env.local");
  }
}

await loadLocalEnvironment();

const integrationDefinitions = [
  { id: "opendart", label: "OpenDART", keys: ["OPENDART_API_KEY"], optional: ["OPENDART_CORP_CODE"], adapter: true },
  { id: "kis", label: "한국투자증권", keys: ["KIS_APP_KEY", "KIS_APP_SECRET"], optional: ["KIS_STOCK_CODE", "KIS_REFRESH_MIN_HOURS"], adapter: true },
  { id: "ecos", label: "한국은행 ECOS", keys: ["ECOS_API_KEY"] },
  { id: "krx", label: "KRX", keys: ["KRX_API_KEY"] },
  { id: "fred", label: "FRED", keys: ["FRED_API_KEY"], adapter: true },
  { id: "tavily", label: "Tavily", keys: ["TAVILY_API_KEY"] },
  { id: "openrouter", label: "OpenRouter", keys: ["OPENROUTER_API_KEY"], optional: ["OPENROUTER_MODEL"], adapter: true },
  { id: "deepseek", label: "DeepSeek", keys: ["DEEPSEEK_API_KEY"] },
  { id: "opencode", label: "OpenCode", keys: ["OPENCODE_API_KEY"] },
  { id: "naver_cloud", label: "네이버 클라우드", keys: ["NAVER_CLOUD_CLIENT_ID", "NAVER_CLOUD_CLIENT_SECRET"] },
  { id: "naver_hub", label: "네이버 API HUB", keys: ["NAVER_HUB_CLIENT_ID", "NAVER_HUB_CLIENT_SECRET"] },
  { id: "naver_maps", label: "네이버맵", keys: ["NAVER_MAPS_CLIENT_ID", "NAVER_MAPS_CLIENT_SECRET"] },
  { id: "toss", label: "토스증권", keys: ["TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET"] },
  { id: "kiwoom", label: "키움증권", keys: ["KIWOOM_APP_KEY", "KIWOOM_SECRET_KEY"] }
];

const allowedSettingKeys = new Set(integrationDefinitions.flatMap((item) => [...item.keys, ...(item.optional || [])]));
let analysisInFlight = false;
let deployProcess = null;
let deployStatus = {
  state: "idle",
  started_at: null,
  finished_at: null,
  message: "수동 배포 대기",
  production_url: "https://toptoon-signal-desk.pages.dev/"
};

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function integrationsStatus() {
  return {
    generated_at: new Date().toISOString(),
    security: "server-only",
    providers: integrationDefinitions.map((provider) => ({
      id: provider.id,
      label: provider.label,
      adapter: Boolean(provider.adapter),
      configured: provider.keys.every((key) => Boolean(process.env[key])),
      required_count: provider.keys.length,
      fields: [...provider.keys, ...(provider.optional || [])].map((key) => ({ key, configured: Boolean(process.env[key]) }))
    }))
  };
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["127.0.0.1", "localhost"].includes(parsed.hostname) && parsed.port === String(port);
  } catch {
    return false;
  }
}

function currentDeployStatus() {
  return { ...deployStatus, running: deployStatus.state === "running" };
}

function updateDeployMessage(chunk) {
  const lines = String(chunk || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^\[\d{2}:\d{2}:\d{2}\]/.test(line)) deployStatus.message = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");
    else if (line.startsWith("Official signal refresh complete")) deployStatus.message = "공식 API 갱신 완료";
    else if (line.startsWith("Validation passed")) deployStatus.message = "데이터·앱 검증 통과";
    else if (line.startsWith("Public read-only build created")) deployStatus.message = "공개용 안전 빌드 완료";
    else if (line.includes("Deployment complete")) deployStatus.message = "Cloudflare 배포 반영 중";
  }
}

function startManualDeploy() {
  if (deployProcess && deployStatus.state === "running") return currentDeployStatus();
  const updateScript = join(projectRoot, "scripts", "update-and-deploy.ps1");
  deployStatus = {
    state: "running",
    started_at: new Date().toISOString(),
    finished_at: null,
    message: "수집·검증을 시작합니다",
    production_url: "https://toptoon-signal-desk.pages.dev/"
  };
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", updateScript], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  deployProcess = child;
  child.stdout.on("data", updateDeployMessage);
  child.stderr.on("data", updateDeployMessage);
  child.on("error", (error) => {
    deployStatus = { ...deployStatus, state: "failed", finished_at: new Date().toISOString(), message: String(error.message || error) };
    deployProcess = null;
  });
  child.on("close", (code) => {
    const skipped = deployStatus.message.includes("Another update") || deployStatus.message.includes("skipping");
    deployStatus = {
      ...deployStatus,
      state: code === 0 ? (skipped ? "skipped" : "success") : "failed",
      finished_at: new Date().toISOString(),
      message: code === 0 ? (skipped ? "자동 갱신이 이미 실행 중이라 이번 요청을 건너뛰었습니다" : "최신 데이터 공개 배포 완료") : `배포 실패 (exit code ${code})`
    };
    deployProcess = null;
  });
  return currentDeployStatus();
}

async function readJsonBody(request, maxBytes = 65536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readLocalEnvironmentValues() {
  const values = {};
  try {
    const body = await readFile(join(projectRoot, ".env.local"), "utf8");
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      if (!allowedSettingKeys.has(key)) continue;
      values[key] = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return values;
}

async function saveSettings(payload) {
  const current = await readLocalEnvironmentValues();
  const incoming = payload?.values && typeof payload.values === "object" ? payload.values : {};
  const clear = Array.isArray(payload?.clear) ? payload.clear : [];
  for (const key of clear) {
    if (allowedSettingKeys.has(key)) {
      delete current[key];
      delete process.env[key];
    }
  }
  for (const [key, rawValue] of Object.entries(incoming)) {
    if (!allowedSettingKeys.has(key) || typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (!value) continue;
    if (value.length > 4096 || /[\r\n]/.test(value)) throw new Error(`invalid value: ${key}`);
    current[key] = value;
    process.env[key] = value;
  }
  const lines = [
    "# TOPTOON Signal Desk local secrets. Never commit or share this file.",
    ...[...allowedSettingKeys].filter((key) => current[key]).map((key) => `${key}=${current[key]}`),
    ""
  ];
  await writeFile(join(projectRoot, ".env.local"), lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  return integrationsStatus();
}

async function runOpenRouterAnalysis() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key is not configured");
  if (analysisInFlight) throw new Error("analysis already in progress");
  analysisInFlight = true;
  try {
    const stats = JSON.parse(await readFile(join(projectRoot, "data", "stats.json"), "utf8"));
    const validation = JSON.parse(await readFile(join(projectRoot, "data", "validation.json"), "utf8"));
    const officialSignals = JSON.parse(await readFile(join(projectRoot, "data", "official-signals.json"), "utf8"));
    const snapshot = {
      captured_at: stats.captured_at,
      revenue_nowcast: stats.revenue_nowcast,
      character_contribution_definition: {
        formula: "cumulative public character chatCount multiplied by the IR-calibrated KRW 2,354 proxy coefficient",
        is_reported_revenue: false,
        limitations: ["chatCount is not a paid-turn count", "cross-character user duplication is unknown", "free usage and repeated chats are unknown", "per-character payment data is unavailable"]
      },
      geographic_mix: stats.site_comparison?.overall,
      daily_traction: stats.site_traction?.daily,
      filing_snapshot: validation.investor?.filing_snapshot,
      market_snapshot: validation.investor?.market_snapshot,
      validation_checks: validation.checks,
      evidence_gaps: validation.required_caveats,
      validation_summary: validation.summary,
      sources: validation.investor?.sources,
      official_signals: {
        opendart: {
          status: officialSignals.providers?.opendart?.status,
          observed_at: officialSignals.providers?.opendart?.observed_at,
          disclosures: officialSignals.providers?.opendart?.disclosures
        },
        kis: {
          status: officialSignals.providers?.kis?.status,
          observed_at: officialSignals.providers?.kis?.observed_at,
          quote: officialSignals.providers?.kis?.quote,
          market_alert: officialSignals.providers?.kis?.market_alert
        }
      }
    };
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": `http://127.0.0.1:${port}`,
        "X-OpenRouter-Title": "TOPTOON Signal Desk"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
        temperature: 0.2,
        max_tokens: 2000,
        reasoning: { effort: "none", exclude: true },
        messages: [
          {
            role: "system",
            content: "당신은 상장주식 리서치 검증자다. 제공된 JSON만 사용해 한국어로 답한다. 관측 사실, 모델 추정, 미확인 항목을 분리하고 숫자를 새로 만들지 않는다. 회사 가설과 주식 판단을 분리하며 매수·매도 권유를 하지 않는다. 캐릭터 기여도는 실제 매출이 아님을 반드시 명시한다. 출력은 핵심 변화, 확인된 신호, 반대 신호, 다음 증거의 네 짧은 섹션으로 작성한다."
          },
          { role: "user", content: JSON.stringify(snapshot) }
        ]
      })
    });
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`OpenRouter API error ${payload.error.code || "unknown"}: ${payload.error.message || "unknown"}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no analysis");
    return {
      generated_at: new Date().toISOString(),
      model: payload.model || process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
      analysis: content,
      usage: payload.usage ? {
        prompt_tokens: payload.usage.prompt_tokens,
        completion_tokens: payload.usage.completion_tokens,
        total_tokens: payload.usage.total_tokens
      } : null
    };
  } finally {
    analysisInFlight = false;
  }
}

function safePath(urlValue) {
  const pathname = decodeURIComponent(new URL(urlValue, "http://127.0.0.1").pathname);
  const relative = normalize(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  const target = resolve(join(projectRoot, relative));
  return target === projectRoot || target.startsWith(`${projectRoot}${sep}`) ? target : null;
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/api/health") {
      json(response, 200, { ok: true, app: "toptoon-tracker-unified" });
      return;
    }
    if (requestUrl.pathname === "/media-proxy") {
      await proxyMedia(request, response, requestUrl);
      return;
    }
    if (requestUrl.pathname === "/api/integrations/status") {
      json(response, 200, integrationsStatus());
      return;
    }
    if (requestUrl.pathname === "/api/deploy/status" && request.method === "GET") {
      json(response, 200, currentDeployStatus());
      return;
    }
    if (requestUrl.pathname === "/api/deploy/run" && request.method === "POST") {
      if (!isSameOrigin(request)) return json(response, 403, { error: "forbidden origin" });
      const wasRunning = deployStatus.state === "running";
      json(response, wasRunning ? 409 : 202, wasRunning ? { ...currentDeployStatus(), error: "deployment already in progress" } : startManualDeploy());
      return;
    }
    if (requestUrl.pathname === "/api/settings" && request.method === "POST") {
      if (!isSameOrigin(request)) return json(response, 403, { error: "forbidden origin" });
      try {
        json(response, 200, await saveSettings(await readJsonBody(request)));
      } catch (error) {
        json(response, 400, { error: String(error.message || error) });
      }
      return;
    }
    if (requestUrl.pathname === "/api/analysis/openrouter" && request.method === "POST") {
      if (!isSameOrigin(request)) return json(response, 403, { error: "forbidden origin" });
      try {
        json(response, 200, await runOpenRouterAnalysis());
      } catch (error) {
        const status = String(error.message || error).includes("not configured") ? 409 : 502;
        json(response, status, { error: String(error.message || error) });
      }
      return;
    }
    const target = safePath(request.url || "/");
    if (!target) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const relativeTarget = target.slice(projectRoot.length + 1).replaceAll("\\", "/");
    const publicTarget =
      relativeTarget === "index.html" ||
      relativeTarget === "app.js" ||
      relativeTarget === "styles.css" ||
      relativeTarget.startsWith("data/") ||
      relativeTarget.startsWith("assets/");
    if (!publicTarget || relativeTarget.split("/").some((part) => part.startsWith("."))) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "Content-Type": mime[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache"
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

function listenWithFallback(serverInstance, candidatePort, candidateIndex = 0) {
  const candidateList = Array.from(new Set([candidatePort, 8888, 8880, 3000, 5173, 8080, candidatePort + 1, candidatePort + 2]));
  const targetPort = candidateList[candidateIndex];

  const onError = (err) => {
    serverInstance.removeListener("listening", onListening);
    if (["EADDRINUSE", "EACCES"].includes(err.code) && candidateIndex + 1 < candidateList.length) {
      console.warn(`[포트 안내] 포트 ${targetPort} 점유 또는 권한 제한(${err.code})으로 대체 포트(${candidateList[candidateIndex + 1]})로 자동 전환합니다.`);
      listenWithFallback(serverInstance, candidatePort, candidateIndex + 1);
    } else {
      console.error(`서버 기동 실패: ${err.message}`);
      process.exit(1);
    }
  };

  const onListening = () => {
    serverInstance.removeListener("error", onError);
    console.log(`TOPTOON Tracker Unified: http://127.0.0.1:${targetPort}/`);
  };

  serverInstance.once("error", onError);
  serverInstance.once("listening", onListening);
  serverInstance.listen(targetPort, "127.0.0.1");
}

listenWithFallback(server, port);
