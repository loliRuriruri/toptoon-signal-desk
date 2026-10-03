const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function formatDateCompact(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function authenticate(request, env) {
  const authHeader = request.headers.get("authorization") || "";
  const expectedSecret = String(env.KIS_BROKER_SECRET || "").trim();
  if (!expectedSecret) return false;
  if (!authHeader.startsWith("Bearer ")) return false;
  return authHeader.slice(7).trim() === expectedSecret;
}

const KIS_BASE = "https://openapi.koreainvestment.com:9443";
const KV_TOKEN_KEY = "kis_access_token";
const EXPIRY_BUFFER_MS = 30 * 60 * 1000; // 30분 만료 임박 버퍼

/**
 * KV 및 KIS /oauth2/tokenP 기반 토큰 관리
 * 유효 토큰이 남아 있으면 tokenP를 호출하지 않고 KV 토큰을 재사용합니다.
 */
async function getOrRenewKisToken(env, forceTokenReissue = false) {
  const now = Date.now();

  if (!forceTokenReissue && env.KIS_TOKEN_KV) {
    try {
      const cached = await env.KIS_TOKEN_KV.get(KV_TOKEN_KEY, { type: "json" });
      if (cached && cached.access_token && typeof cached.expires_at === "number") {
        const remainingMs = cached.expires_at - now;
        if (remainingMs > EXPIRY_BUFFER_MS) {
          return {
            accessToken: cached.access_token,
            tokenStatus: {
              action: "reused",
              issued_at: cached.issued_at || new Date(cached.expires_at - 86400000).toISOString(),
              expires_at: cached.expires_at,
              remaining_seconds: Math.floor(remainingMs / 1000)
            }
          };
        }
      }
    } catch (err) {
      console.warn("KV get error:", err.message);
    }
  }

  const appKey = String(env.KIS_APP_KEY || "").trim();
  const appSecret = String(env.KIS_APP_SECRET || "").trim();
  if (!appKey || !appSecret) {
    throw new Error("Worker secrets KIS_APP_KEY and KIS_APP_SECRET must be configured");
  }

  const response = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const code = payload.error_code || payload.msg_cd || payload.code || "";
    const msg = payload.error_description || payload.msg1 || payload.message || "Unknown error";
    throw new Error(`KIS /oauth2/tokenP failed (${response.status}): ${code} ${msg}`);
  }

  const expiresIn = Number(payload.expires_in || 86400);
  const issuedAt = new Date(now).toISOString();
  const expiresAt = now + expiresIn * 1000;

  if (env.KIS_TOKEN_KV) {
    try {
      await env.KIS_TOKEN_KV.put(
        KV_TOKEN_KEY,
        JSON.stringify({
          access_token: payload.access_token,
          issued_at: issuedAt,
          expires_at: expiresAt
        }),
        { expirationTtl: 86400 * 2 }
      );
    } catch (err) {
      console.warn("KV put error:", err.message);
    }
  }

  return {
    accessToken: payload.access_token,
    tokenStatus: {
      action: "issued_new",
      issued_at: issuedAt,
      expires_at: expiresAt,
      remaining_seconds: expiresIn
    }
  };
}

async function fetchKisPrice(ticker, accessToken, env) {
  const params = new URLSearchParams({
    fid_cond_mrkt_div_code: "J",
    fid_input_iscd: ticker
  });
  const res = await fetch(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`, {
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${accessToken}`,
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
      tr_id: "FHKST01010100"
    }
  });
  const data = await res.json().catch(() => ({}));
  if (data.rt_cd !== "0") {
    throw new Error(`KIS inquire-price ${ticker} failed: ${data.msg_cd || "unknown"} ${data.msg1 || ""}`);
  }
  return data;
}

async function fetchKisDailyHistory(ticker, daysBack, accessToken, env) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(30, daysBack));

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
    FID_INPUT_DATE_1: formatDateCompact(start),
    FID_INPUT_DATE_2: formatDateCompact(end),
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "0"
  });

  const res = await fetch(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`, {
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${accessToken}`,
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
      tr_id: "FHKST03010100"
    }
  });
  const data = await res.json().catch(() => ({}));
  if (data.rt_cd !== "0") {
    throw new Error(`KIS daily chart ${ticker} failed: ${data.msg_cd || "unknown"} ${data.msg1 || ""}`);
  }
  return data.output2 || [];
}

export default {
  async scheduled(controller, env, ctx) {
    // wrangler.jsonc에서 triggers.crons는 []로 비활성화되어 있습니다.
    console.log(JSON.stringify({
      event: "scheduled-cron-ignored",
      cron: controller.cron,
      at: new Date().toISOString()
    }));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type"
        }
      });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "toptoon-signal-cron",
        kis_broker: true,
        crons_active: false
      });
    }

    if (url.pathname.startsWith("/api/kis/")) {
      if (!authenticate(request, env)) {
        return json({ error: "Unauthorized: Invalid or missing Bearer token" }, 401);
      }

      if (url.pathname === "/api/kis/token-status" && request.method === "GET") {
        const cached = await env.KIS_TOKEN_KV?.get(KV_TOKEN_KEY, { type: "json" });
        const now = Date.now();
        const hasToken = Boolean(cached && cached.access_token);
        const valid = Boolean(hasToken && cached.expires_at - now > EXPIRY_BUFFER_MS);
        return json({
          ok: true,
          has_token: hasToken,
          valid,
          issued_at: cached?.issued_at || null,
          expires_at: cached?.expires_at || null,
          remaining_seconds: hasToken ? Math.max(0, Math.floor((cached.expires_at - now) / 1000)) : 0
        });
      }

      if (url.pathname === "/api/kis/test/expire-token" && request.method === "POST") {
        const cached = await env.KIS_TOKEN_KV?.get(KV_TOKEN_KEY, { type: "json" });
        if (cached && cached.access_token) {
          const expiredAt = Date.now() - 60000; // 1 minute in the past
          await env.KIS_TOKEN_KV.put(
            KV_TOKEN_KEY,
            JSON.stringify({ ...cached, expires_at: expiredAt }),
            { expirationTtl: 86400 }
          );
          return json({
            ok: true,
            action: "simulated_expired",
            note: "KV token expires_at timestamp set to 1 minute ago"
          });
        }
        return json({ ok: false, note: "No token exists in KV to expire" }, 404);
      }

      if (url.pathname === "/api/kis/quotes" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const ticker = String(body.ticker || "134580").trim();
        const historyDays = Number(body.history_days || 60);
        const peers = Array.isArray(body.peers) ? body.peers.map(String) : [];
        const forceTokenReissue = Boolean(body.force_token_reissue);

        try {
          const { accessToken, tokenStatus } = await getOrRenewKisToken(env, forceTokenReissue);

          // 1. Primary quote
          const primaryRes = await fetchKisPrice(ticker, accessToken, env);

          // 2. Daily price history
          let priceHistory = [];
          try {
            priceHistory = await fetchKisDailyHistory(ticker, historyDays, accessToken, env);
          } catch (err) {
            console.warn(`Price history fetch warning for ${ticker}:`, err.message);
          }

          // 3. Peer quotes
          const peerResults = {};
          for (const peerTicker of peers) {
            try {
              await new Promise((r) => setTimeout(r, 150));
              const peerRes = await fetchKisPrice(peerTicker, accessToken, env);
              peerResults[peerTicker] = {
                status: "ok",
                output: peerRes.output || {}
              };
            } catch (peerErr) {
              peerResults[peerTicker] = {
                status: "error",
                message: peerErr.message
              };
            }
          }

          // Return sanitized response (never leaking access_token or credentials)
          return json({
            ok: true,
            token_status: tokenStatus,
            primary: {
              ticker,
              output: primaryRes.output || {}
            },
            price_history: priceHistory,
            peers: peerResults
          });
        } catch (err) {
          return json({
            ok: false,
            error: err.message
          }, 500);
        }
      }
    }

    return json({ error: "not found" }, 404);
  }
};
