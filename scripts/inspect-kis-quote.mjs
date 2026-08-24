import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}

const base = "https://openapi.koreainvestment.com:9443";
const appKey = process.env.KIS_APP_KEY;
const appSecret = process.env.KIS_APP_SECRET;
const ticker = process.argv[2] || process.env.KIS_STOCK_CODE || "134580";

if (!appKey || !appSecret) throw new Error("KIS credentials are not configured");

const tokenResponse = await fetch(`${base}/oauth2/tokenP`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, appsecret: appSecret })
});
const token = await tokenResponse.json();
if (!token.access_token) throw new Error(`KIS token error: ${token.msg1 || token.error_code || "unknown"}`);

const params = new URLSearchParams({ fid_cond_mrkt_div_code: "J", fid_input_iscd: ticker });
const quoteResponse = await fetch(`${base}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`, {
  headers: {
    authorization: `Bearer ${token.access_token}`,
    appkey: appKey,
    appsecret: appSecret,
    tr_id: "FHKST01010100"
  }
});
const quote = await quoteResponse.json();
const output = quote.output || {};
const safeFields = [
  "stck_prpr", "prdy_vrss", "prdy_vrss_sign", "prdy_ctrt", "stck_sdpr",
  "stck_oprc", "stck_hgpr", "stck_lwpr", "acml_vol", "prdy_vol",
  "hts_avls", "lstn_stcn", "temp_stop_yn", "iscd_stat_cls_code", "bstp_kor_isnm"
];

console.log(JSON.stringify({
  ticker,
  rt_cd: quote.rt_cd,
  msg_cd: quote.msg_cd,
  msg1: quote.msg1,
  output: Object.fromEntries(safeFields.map((key) => [key, output[key] ?? null]))
}, null, 2));
