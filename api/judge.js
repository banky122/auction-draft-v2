export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });
  const { category, rules="", p1name="Player 1", p2name="Player 2", p1=[], p2=[] } = req.body || {};

  const prompt = `Judge an auction draft matchup.

Category: ${category}
Rules: ${rules || "None"}

${p1name}:
${p1.map(x=>`- ${x.name} (${x.cost})`).join("\n")}

${p2name}:
${p2.map(x=>`- ${x.name} (${x.cost})`).join("\n")}

Give a concise but meaningful result with:
1. Win probability for each side summing to 100%.
2. Winner.
3. 3-5 sentence explanation.
4. Best pick.
5. Best value pick.
6. Biggest overpay, if any.
7. One-sentence final verdict.

Do not hedge excessively. Treat it like a fun competitive draft evaluation.`;

  try{
    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({model:"gpt-5",input:prompt})
    });
    const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:data?.error?.message||"OpenAI request failed"});
    const text=data.output_text||(data.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||"").join("");
    return res.status(200).json({result:String(text).trim()});
  }catch(err){
    return res.status(500).json({error:err.message||"Judging failed"});
  }
}