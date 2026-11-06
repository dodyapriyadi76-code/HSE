// ETEL Safety Patrol: one Worker serves the app (public/) and the AI endpoint (/api/analyze)
const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SYSTEM = "You are an HSE (Health, Safety, Environment) assistant for a manufacturing company. Reply in English with ONLY one valid JSON object, no other text, no markdown.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/analyze") return env.ASSETS.fetch(request);

    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
    if (!env.AI) return json({ error: "Workers AI binding (AI) is not configured." }, 500);

    let body; try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const { prompt, image } = body || {};
    if (typeof prompt !== "string" || !prompt || prompt.length > 12000) return json({ error: "Invalid prompt." }, 400);
    if (image && (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4000000)) return json({ error: "Invalid or oversized image." }, 400);

    try {
      const messages = image
        ? [{ role: "system", content: SYSTEM }, { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }]
        : [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }];
      const out = await env.AI.run(image ? (env.VISION_MODEL || VISION_MODEL) : (env.TEXT_MODEL || TEXT_MODEL), { messages, max_tokens: 1800, temperature: 0.2 });
      let text = out?.response ?? out?.choices?.[0]?.message?.content ?? out;
      if (typeof text !== "string") text = JSON.stringify(text);
      return json({ text });
    } catch (e) { return json({ error: "Workers AI failed: " + (e?.message || "unknown") }, 502); }
  }
};
