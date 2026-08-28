const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function githubDispatchUrl(env) {
  const repository = String(env.GITHUB_REPOSITORY || "").trim();
  const workflow = String(env.GITHUB_WORKFLOW || "scheduled-refresh.yml").trim();
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error("Invalid GITHUB_REPOSITORY");
  if (!/^[A-Za-z0-9._/-]+$/.test(workflow)) throw new Error("Invalid GITHUB_WORKFLOW");
  return `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`;
}

async function dispatchRefresh(env, trigger) {
  const token = String(env.GITHUB_TOKEN || "").trim();
  if (!token) throw new Error("GITHUB_TOKEN is not configured");

  const response = await fetch(githubDispatchUrl(env), {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "toptoon-signal-cron",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify({ ref: String(env.GITHUB_REF || "main").trim() })
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400).replace(/\s+/g, " ");
    throw new Error(`GitHub dispatch failed (${response.status}): ${detail || "empty response"}`);
  }

  console.log(JSON.stringify({
    event: "github-workflow-dispatch",
    trigger,
    repository: env.GITHUB_REPOSITORY,
    workflow: env.GITHUB_WORKFLOW || "scheduled-refresh.yml",
    ref: env.GITHUB_REF || "main",
    at: new Date().toISOString()
  }));
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchRefresh(env, `cron:${controller.cron}`).catch((error) => {
      console.error(JSON.stringify({
        event: "github-workflow-dispatch-error",
        trigger: `cron:${controller.cron}`,
        message: String(error.message || error),
        at: new Date().toISOString()
      }));
      throw error;
    }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "toptoon-signal-cron",
        schedule: "*/15 * * * *",
        repository: env.GITHUB_REPOSITORY,
        workflow: env.GITHUB_WORKFLOW || "scheduled-refresh.yml",
        ref: env.GITHUB_REF || "main"
      });
    }
    return json({ error: "not found" }, 404);
  }
};
