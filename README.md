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
