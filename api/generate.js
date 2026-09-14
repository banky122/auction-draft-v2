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

Return exactly ${n} distinct recognizable nominees.
Mix elite choices, mid-tier choices, cult favorites, sleepers, and fun risky picks.
Do NOT order strongest-to-weakest. Randomize the nomination order.
No duplicates.
For characters or athletes, specify a clear form, season, era, or version when appropriate.
Each nominee needs:
- name
- short 1-2 sentence description
- hidden numeric value from 1 to 100 for auction strength
- tier: elite, strong, solid, sleeper, or risky

Output ONLY valid JSON:
{"items":[{"name":"...","description":"...","value":94,"tier":"elite"}]}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "OpenAI request failed" });
    const text = data.output_text || (data.output || []).flatMap(x => x.content || []).map(x => x.text || "").join("");
    const cleaned = String(text).trim().replace(/^```json\s*/i, "").replace(/```$/,"").trim();
    const parsed = JSON.parse(cleaned);
    const seen = new Set();
    const items = (parsed.items || []).filter(x => {
      if (!x || !x.name) return false;
      const k = String(x.name).toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).map(x => ({
      name:String(x.name),
      description:String(x.description || ""),
      value:Math.max(1,Math.min(100,Number(x.value)||50)),
      tier:String(x.tier || "solid")
    })).slice(0,n);
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}