# DialedMX — AI Setup Generator for MX Bikes

## Project Structure
```
dialedmx-v2/
├── index.html          ← Main app (frontend)
├── api/
│   └── generate.js     ← Serverless function (keeps API key secure)
├── vercel.json         ← Vercel config
└── README.md
```

## Deployment to Vercel (10 minutes)

1. **Install Vercel CLI** (optional, can also drag-drop)
   ```
   npm i -g vercel
   ```

2. **Deploy**
   - Option A: Go to vercel.com → New Project → drag the dialedmx-v2 folder
   - Option B: Run `vercel` in the project folder

3. **Add your API key (CRITICAL)**
   - Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY` = your key
   - Redeploy after adding

4. **Connect your domain**
   - Vercel Dashboard → Your Project → Settings → Domains
   - Add: dialedmx.com
   - Update your DNS with the values Vercel provides

## How the API Key Security Works
- The browser NEVER sees your API key
- `index.html` calls `/api/generate` (your own server)
- `api/generate.js` reads `process.env.ANTHROPIC_API_KEY` (set in Vercel, never in code)
- Your Vercel function calls Anthropic and returns the result

## Next Steps
- [ ] Collect default .stp files for all 29 bikes and parse into per-bike defaults
- [ ] Add Stripe for premium paywall
- [ ] Add Supabase auth for user accounts (v2)
- [ ] Update bike ID strings once confirmed in-game
