export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { category, rules = "", count = 35 } = req.body || {};
  if (!category) return res.status(400).json({ error: "Category is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  const n = Math.max(12, Math.min(80, Number(count) || 35));
  const prompt = `Create an auction-draft nomination pool.

Category: ${category}
Extra eligibility rules: ${rules || "None"}
Number of nominees: ${n}

Requirements:
- Return exactly ${n} distinct, recognizable nominees that fit the category.
- Mix elite, mid-tier, cult-favorite, nostalgic, and sleeper choices.
- Do NOT order strongest-to-weakest. Randomize the nomination order so premium choices can appear anywhere.
- No duplicates.
- Each item needs a short 1-2 sentence description useful during an auction.
- For characters/athletes where versions matter, specify a clear form, season, era, or version when appropriate.
- Output ONLY valid JSON in this shape:
{"items":[{"name":"...","description":"..."}]}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "OpenAI request failed" });

    const text =
      data.output_text ||
      (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("");

    const cleaned = String(text).trim().replace(/^```json\s*/i, "").replace(/```$/,"").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.items)) throw new Error("Invalid item format");

    const seen = new Set();
    const items = parsed.items.filter(x => {
      if (!x || !x.name) return false;
      const k = String(x.name).toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0,n);

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}