# AI Auction Draft - Clean Vercel Version

Repository structure:

public/
  index.html
  manifest.json
  sw.js
api/
  generate.js
vercel.json

Deployment:
1. Create a NEW GitHub repository.
2. Upload the CONTENTS of this folder, not the outer folder itself.
3. Import that repository into a NEW Vercel project.
4. Framework Preset: Other.
5. Leave Root Directory blank.
6. Leave Build Command, Output Directory, Install Command, and Development Command overrides OFF.
7. Add OPENAI_API_KEY in Vercel Environment Variables.
8. Deploy/redeploy.

Do not expose your OpenAI API key in GitHub or browser-side code.
