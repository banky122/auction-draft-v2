export default async function handler(req, res) {
 if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
 try{
  const category=String(req.body?.category||"").trim();
  if(!category) return res.status(400).json({valid:false,reason:"Enter a draft category first."});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY is missing in Vercel."});
  const prompt=`Decide whether this is suitable as a category for a casual auction draft game: "${category}".\nA valid category must be coherent and recognizable, have at least 25 legitimate distinct real or established fictional nominees, and be specific enough to identify nominees consistently.\nAccept legitimate niche categories such as Canadian Supreme Court cases, One Piece characters, Toronto restaurants, anime villains, Canadian law firms, or J. Cole songs.\nReject gibberish/random strings, nonexistent or invented categories, gross-out joke categories such as poop flavours, and categories that would require inventing most nominees.\nDo not reject something merely because it is niche.\nReturn ONLY JSON: {"valid":true,"reason":""} or {"valid":false,"reason":"brief friendly explanation"}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000); let response;
  try{response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:"gpt-5.6-luna",input:prompt,reasoning:{effort:"none"},text:{verbosity:"low"},max_output_tokens:120}),signal:controller.signal});}finally{clearTimeout(timer)}
  const raw=await response.text();
  if(!response.ok){let detail=raw;try{detail=JSON.parse(raw)?.error?.message||raw}catch{}return res.status(response.status).json({error:detail||"Category validation failed."})}
  const apiData=JSON.parse(raw); const outputText=apiData.output_text||apiData.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"";
  let result;try{result=JSON.parse(outputText)}catch{const m=outputText.match(/\{[\s\S]*\}/);if(!m)return res.status(502).json({error:"Validator did not return valid JSON."});result=JSON.parse(m[0])}
  return res.status(200).json({valid:result.valid===true,reason:String(result.reason||"")});
 }catch(err){if(err?.name==="AbortError")return res.status(504).json({error:"Category validation took too long. Please try again."});return res.status(500).json({error:err?.message||"Could not validate category."})}
}