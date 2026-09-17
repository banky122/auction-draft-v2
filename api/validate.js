export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const category = String(req.body?.category || "").trim();

    if (!category) {
      return res.status(400).json({
        valid: false,
        reason: "Enter a draft category first."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing."
      });
    }

    const prompt = `
You are validating a category for an auction draft game.

CATEGORY:
"${category}"

Determine whether this is a legitimate category that can support a
25-person auction draft.

A category is VALID when:

1. It is coherent and recognizable as a real or established topic.
2. It has at least 25 legitimate and distinct possible nominees.
3. The nominees can be identified consistently.
4. The nominees can be real people, fictional characters, works,
   businesses, teams, songs, cases, places, foods, or other
   established things.

IMPORTANT:

A category does NOT need to be mainstream.

Valid niche examples include:
- Canadian Supreme Court cases
- One Piece characters
- Toronto restaurants
- Anime villains
- Canadian law firms
- J. Cole songs
- NBA point guards
- Pokémon
- Marvel villains

Reject:

- Gibberish or random strings
- Nonsense such as "sdfsafds afdsf"
- Categories with no established meaning
- Categories that would require inventing most of the nominees
- Gross-out joke categories such as "poop flavours"
- Categories that clearly cannot provide 25 legitimate nominees

Do not invent an interpretation to make nonsense valid.

Return ONLY JSON in this exact format:

{"valid":true,"reason":""}

or

{"valid":false,"reason":"brief friendly explanation"}
`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    let response;

    try {
      response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },

          body: JSON.stringify({
            model: "gpt-5.6-luna",
            input: prompt,
            reasoning: {
              effort: "none"
            },
            text: {
              verbosity: "low"
            },
            max_output_tokens: 120
          }),

          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();

    if (!response.ok) {
      let errorMessage = raw;

      try {
        const errorData = JSON.parse(raw);
        errorMessage =
          errorData?.error?.message || raw;
      } catch {}

      return res.status(response.status).json({
        error: errorMessage || "Category validation failed."
      });
    }

    const apiData = JSON.parse(raw);

    const outputText =
      apiData.output_text ||
      apiData.output
        ?.flatMap(item => item.content || [])
        ?.map(part => part.text || "")
        ?.join("") ||
      "";

    let result;

    try {
      result = JSON.parse(outputText);
    } catch {
      const match =
        outputText.match(/\{[\s\S]*\}/);

      if (!match) {
        return res.status(502).json({
          error: "Validator did not return valid JSON."
        });
      }

      result = JSON.parse(match[0]);
    }

    return res.status(200).json({
      valid: result.valid === true,
      reason: String(result.reason || "")
    });

  } catch (error) {

    if (error?.name === "AbortError") {
      return res.status(504).json({
        error:
          "Category validation took too long. Please try again."
      });
    }

    return res.status(500).json({
      error:
        error?.message ||
        "Could not validate category."
    });
  }
}
