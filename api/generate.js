export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,
      rules = "",
      count,
      poolSize,
      exclude = []
    } = req.body || {};

    const size = Math.max(1, Math.min(Number(count || poolSize) || 10, 10));

    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: "Please enter a draft category." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel." });
    }

    const excluded = Array.isArray(exclude)
      ? exclude.map(x => String(x || "").trim()).filter(Boolean).slice(-60)
      : [];

    const prompt = [
      `Create ${size} distinct nominees for an auction draft.`,
      `Category: ${String(category).trim()}`,
      rules ? `Eligibility rules: ${String(rules).trim()}` : "",
      excluded.length ? `Do NOT use any of these already-generated nominees: ${excluded.join(" | ")}` : "",
      "For each nominee, give a hidden quality rating from 1 to 100 based on how strong/desirable the nominee is within this category.",
      "Use real category knowledge, not random ratings.",
      'Return ONLY valid JSON in this exact shape: {"items":[{"name":"Example","value":92}]}',
      "No markdown. No descriptions. No explanations."
    ].filter(Boolean).join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: prompt,
          reasoning: { effort: "none" },
          text: { verbosity: "low" },
          max_output_tokens: 900
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();

    if (!response.ok) {
      let detail = raw;
      try {
        const parsedErr = JSON.parse(raw);
        detail = parsedErr?.error?.message || raw;
      } catch {}
      return res.status(response.status).json({
        error: detail || `OpenAI error (${response.status})`
      });
    }

    let apiData;
    try {
      apiData = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "OpenAI returned an unreadable response." });
    }

    const outputText =
      apiData.output_text ||
      apiData.output?.flatMap(item => item.content || [])
        ?.map(part => part.text || "")
        ?.join("") ||
      "";

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (!match) {
        return res.status(502).json({ error: "AI response did not contain valid JSON." });
      }
      parsed = JSON.parse(match[0]);
    }

    let items = Array.isArray(parsed.items) ? parsed.items : [];
    const seen = new Set(excluded.map(x => x.toLowerCase()));

    items = items
      .map(x => ({
        name: String(x?.name || "").trim(),
        value: Math.max(1, Math.min(100, Number(x?.value) || 50))
      }))
      .filter(x => x.name && !seen.has(x.name.toLowerCase()))
      .filter((x, i, arr) =>
        arr.findIndex(y => y.name.toLowerCase() === x.name.toLowerCase()) === i
      )
      .slice(0, size)
      .map(x => ({
        ...x,
        description: "",
        tier:
          x.value >= 90 ? "elite" :
          x.value >= 78 ? "strong" :
          x.value >= 64 ? "solid" :
          x.value >= 48 ? "sleeper" : "risky"
      }));

    if (!items.length) {
      return res.status(502).json({ error: "AI returned no usable nominees. Please try again." });
    }

    return res.status(200).json({ items });
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({
        error: "This batch took too long. Please try again."
      });
    }
    return res.status(500).json({
      error: err?.message || "Could not generate draft nominees."
    });
  }
}
