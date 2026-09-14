export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,
      rules = "",
      team1Name = "Player 1",
      team2Name = "Player 2",
      team1 = [],
      team2 = []
    } = req.body || {};

    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: "Missing draft category." });
    }

    if (!Array.isArray(team1) || !Array.isArray(team2) || !team1.length || !team2.length) {
      return res.status(400).json({ error: "Both completed teams are required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel." });
    }

    const compactTeam = (team) => team.map(x => ({
      name: String(x?.name || "").trim(),
      cost: Number(x?.cost || 0)
    }));

    const prompt = [
      "You are judging the final matchup of an auction draft.",
      `Category: ${String(category).trim()}`,
      rules ? `Eligibility/context rules: ${String(rules).trim()}` : "",
      "",
      `${team1Name}: ${compactTeam(team1).map(x => x.name).join(", ")}`,
      `${team2Name}: ${compactTeam(team2).map(x => x.name).join(", ")}`,
      "",
      "Judge the teams as complete teams, not as a simple sum of individual rankings.",
      "Use category-specific reasoning.",
      "",
      "If this is basketball, explicitly consider: overall talent, positional fit, size, shooting, spacing, playmaking, rebounding, point-of-attack defense, switchability, rim protection, transition play, off-ball value, ball-dominance overlap, role balance, chemistry/scalability, and head-to-head matchup problems.",
      "If this is a combat/fantasy category, consider powers, speed, durability, matchup interactions, team synergy, counters, battlefield roles, and win conditions.",
      "If this is entertainment/media, consider quality, consistency, peak, longevity, cultural impact, depth, versatility, and how well the selections complement the team.",
      "For any other category, identify the most important category-specific criteria yourself.",
      "",
      "Do not overvalue auction price. Price should only be used for Best Value / Biggest Overpay.",
      "Return ONLY valid JSON in this exact shape:",
      `{
        "team1Probability": 55,
        "team2Probability": 45,
        "winner": "${team1Name}",
        "explanation": "3-5 concise sentences focused on matchup and chemistry.",
        "team1Strength": "one short phrase",
        "team1Weakness": "one short phrase",
        "team2Strength": "one short phrase",
        "team2Weakness": "one short phrase",
        "keyMatchup": "one short phrase",
        "bestPick": "name",
        "bestValue": "name",
        "biggestOverpay": "name or None",
        "verdict": "one concise sentence"
      }`,
      "Probabilities must sum to 100. No markdown."
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
          reasoning: { effort: "low" },
          text: { verbosity: "low" },
          max_output_tokens: 1000
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
        return res.status(502).json({ error: "AI judge did not return valid JSON." });
      }
      parsed = JSON.parse(match[0]);
    }

    let p1 = Number(parsed.team1Probability);
    let p2 = Number(parsed.team2Probability);

    if (!Number.isFinite(p1) || !Number.isFinite(p2)) {
      return res.status(502).json({ error: "AI judge returned invalid probabilities." });
    }

    const total = p1 + p2 || 100;
    p1 = Math.round((p1 / total) * 100);
    p2 = 100 - p1;

    return res.status(200).json({
      ...parsed,
      team1Probability: p1,
      team2Probability: p2
    });

  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({
        error: "AI matchup judging took too long. Please try again."
      });
    }
    return res.status(500).json({
      error: err?.message || "Could not judge this matchup."
    });
  }
}
