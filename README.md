# AI Auction Draft Simulator

New features:
- Play vs Friend
- Play vs CPU
- CPU styles: Balanced, Aggressive, Conservative
- Simulate one nomination
- Simulate rest of entire draft
- AI-generated hidden values for CPU bidding
- Simulate Winner after both rosters are full

Deploy on the same Vercel project:
1. Replace the files in your GitHub repository with these files.
2. Keep OPENAI_API_KEY in Vercel.
3. Push/commit changes.
4. Vercel should automatically redeploy.


Fixed version:
- Uses gpt-5.6-luna for generation and judging.
- Vercel maxDuration increased to 300 seconds.
- Browser error handling improved for non-JSON server errors.


Optimized generation version:
- Draft generation now asks AI only for nominee names.
- Hidden values and tiers are created locally for CPU bidding.
- The OpenAI request is capped at about 22 seconds so Vercel does not hang.
- Generation errors are returned as readable JSON messages.


Timeout-fix version:
- Large pools are generated in batches of at most 10 nominees per API request.
- A 35-person pool therefore uses several short requests rather than one long request.
- Hidden quality ratings are generated with each small batch for more realistic CPU bidding.
- Simulate Winner now runs instantly in the browser and does not call OpenAI.
- Service worker updated to network-first so new deployments are not trapped behind an old cached HTML file.


Hybrid AI Judge version:
- Pool generation stays batched in groups of 10 to avoid Vercel timeouts.
- Final matchup judging is back to AI, but only sends the two completed rosters.
- The judge explicitly evaluates chemistry, fit, positional balance, size, spacing, defense, and matchup-specific factors for basketball.
- Other categories use category-specific criteria.
- AI judging has its own ~22 second timeout and concise output limits.


Fixed pool size version:
- Pool size is fixed at 35 nominees for every draft.
- The pool-size input has been removed from the UI.
- Generation still runs in batches of up to 10 nominees to avoid timeouts.


Simplified setup version:
- Removed Extra Rules / Eligibility from the UI.
- Draft setup now uses category only, with a fixed 35-person pool.


Pool size update:
- Fixed nomination pool reduced from 35 to 25 for every draft.
