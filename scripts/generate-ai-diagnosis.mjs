import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputJsonPath = join(projectRoot, "data", "ai-diagnosis.json");
const outputJsPath = join(projectRoot, "data", "ai-diagnosis.js");
const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
const minHours = Math.max(0, Number(process.env.AI_DIAGNOSIS_MIN_HOURS || 2));
const force = process.argv.includes("--force");

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(projectRoot, relativePath), "utf8"));
}

async function readPrevious() {
  try {
    return await readJson("data/ai-diagnosis.json");
  } catch {
    return null;
  }
}

function compactCheck(check) {
  return {
    source_id: `validation:${check.id}`,
    label: check.label,
    status: check.status,
    severity: check.severity,
    observed: check.observed,
    expected: check.expected,
    note: check.note
  };
}

const previous = await readPrevious();
if (!process.env.OPENROUTER_API_KEY) {
  console.log("AI diagnosis skipped: OPENROUTER_API_KEY is not configured");
  process.exit(0);
}

if (!force && previous?.status === "ok" && previous.generated_at) {
  const ageHours = (Date.now() - Date.parse(previous.generated_at)) / 3_600_000;
  if (Number.isFinite(ageHours) && ageHours < minHours) {
    console.log(`AI diagnosis skipped: previous result is ${ageHours.toFixed(2)}h old (minimum ${minHours}h)`);
    process.exit(0);
  }
}

const [stats, validation, officialSignals, characters] = await Promise.all([
  readJson("data/stats.json"),
  readJson("data/validation.json"),
  readJson("data/official-signals.json"),
  readJson("data/characters.json")
]);

const kis = officialSignals.providers?.kis || {};
const opendart = officialSignals.providers?.opendart || {};
const keyPassChecks = new Set(["revenue-nowcast-formula", "all-market-revenue-scope", "krx-halt-date-tieout"]);
const diagnosisChecks = (validation.checks || []).filter((check) => check.status !== "pass" || keyPassChecks.has(check.id));
const snapshot = {
  policy: {
    scope: "제공된 공개 데이터만 사용",
    observed_vs_modeled: "공개 조회·채팅 카운터는 관측값, 원화 환산은 가정 시나리오",
    prohibited: ["새 숫자 창작", "미공시 KPI 추정", "매수·매도 권유", "외부 기억을 사실처럼 사용"]
  },
  timestamps: {
    catalogs: characters.generated_at,
    statistics: stats.captured_at,
    validation: validation.generated_at,
    official_signals: officialSignals.generated_at
  },
  catalog_counts: characters.counts,
  catalogs: validation.catalogs,
  validation_summary: validation.summary,
  validation_checks: diagnosisChecks.map(compactCheck),
  required_caveats: validation.required_caveats,
  official_sources: (validation.investor?.sources || []).map((source) => ({
    source_id: source.id,
    label: source.label,
    tier: source.tier,
    as_of: source.as_of,
    url: source.url
  })),
  filing_snapshot: validation.investor?.filing_snapshot,
  thesis_state: validation.investor?.thesis,
  revenue_scenario: {
    source_id: "model:revenue-nowcast",
    latest: stats.revenue_nowcast?.latest,
    constants: stats.revenue_nowcast?.constants,
    basis_note: stats.revenue_nowcast?.basis_note,
    all_market: stats.site_revenue
  },
  direct_activity: {
    market_mix: stats.site_comparison?.overall,
    recent_traction: (stats.site_traction?.daily || []).slice(-7)
  },
  market: {
    source_id: "provider:kis",
    status: kis.status,
    observed_at: kis.observed_at,
    quote: kis.quote,
    market_alert: kis.market_alert
  },
  disclosures: {
    source_id: "provider:opendart",
    status: opendart.status,
    observed_at: opendart.observed_at,
    rows: (opendart.disclosures || []).slice(0, 10).map((row) => ({
      source_id: `dart:${row.receipt_no}`,
      filed_at: row.filed_at,
      report: row.report,
      filer: row.filer,
      url: row.url
    }))
  }
};

const snapshotBody = JSON.stringify(snapshot);
const inputHash = createHash("sha256").update(snapshotBody).digest("hex");
const systemPrompt = `당신은 한국 상장주식 대체데이터 품질 검증자다. 반드시 제공된 JSON만 사용해 한국어로 답한다.
관측 사실, 공식 공시, 모델 가정, 미확인 항목을 분리한다. 숫자를 새로 만들거나 미공시 KPI를 추정하지 않는다.
각 핵심 주장 끝에 JSON에 있는 source_id를 [근거: source_id] 형식으로 붙인다. 근거가 없으면 [근거 없음]이라고 쓴다.
규칙 기반 검증 결과와 충돌하는 결론을 내리지 않는다. 매수·매도 권유를 하지 않는다.
출력은 다음 다섯 섹션의 짧은 Markdown으로 작성한다:
## 핵심 변화
## 데이터 이상 진단
## 사업·주가 해석
## 반대 신호
## 다음 확인사항`;

async function requestDiagnosis() {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://toptoon-signal-desk.pages.dev/",
          "X-OpenRouter-Title": "TOPTOON Signal Desk Scheduled Diagnosis"
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 2000,
          reasoning: { effort: "none", exclude: true },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: snapshotBody }
          ]
        })
      });
      if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(`OpenRouter API error ${payload.error.code || "unknown"}: ${payload.error.message || "unknown"}`);
      const choice = payload.choices?.[0] || {};
      const analysis = choice.message?.content;
      if (typeof analysis !== "string" || !analysis.trim()) {
        const usage = payload.usage || {};
        throw new Error(`OpenRouter returned no analysis (finish=${choice.finish_reason || "unknown"}, completion_tokens=${usage.completion_tokens ?? "unknown"})`);
      }
      return { payload, analysis };
    } catch (error) {
      lastError = error;
      const message = String(error.message || error);
      const retryable = /HTTP (?:429|5\d\d)|API error (?:429|5\d\d)|overload|timeout|aborted/i.test(message);
      if (!retryable || attempt === 3) break;
      const delayMs = attempt * 15_000;
      console.warn(`AI diagnosis attempt ${attempt} failed; retrying in ${delayMs / 1000}s (${message})`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  throw lastError || new Error("OpenRouter diagnosis failed");
}

try {
  const { payload, analysis } = await requestDiagnosis();

  const generatedAt = new Date().toISOString();
  const output = {
    schema_version: 1,
    status: "ok",
    generated_at: generatedAt,
    model: payload.model || model,
    input_hash: inputHash,
    source_snapshot: snapshot.timestamps,
    analysis: analysis.trim(),
    usage: payload.usage ? {
      prompt_tokens: payload.usage.prompt_tokens,
      completion_tokens: payload.usage.completion_tokens,
      total_tokens: payload.usage.total_tokens
    } : null,
    disclosure: "공개 자료만 전달한 LLM 보조 해석이며 원자료·규칙 검증을 대체하지 않습니다."
  };
  await writeFile(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(outputJsPath, `window.TOPTOON_AI_DIAGNOSIS=${JSON.stringify(output)};\n`, "utf8");
  console.log(`AI diagnosis complete: ${output.model} · ${generatedAt}`);
} catch (error) {
  console.error(`AI diagnosis failed; previous result preserved: ${String(error.message || error)}`);
  process.exitCode = 1;
}
