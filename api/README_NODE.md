Node/Express Leaderboard Proxy

Files:
- leaderboard-express.js — Express app that calls UGS and returns simplified JSON
- package.json — dependencies and start script

How to run (recommended for platforms that support Node)
1. Copy the `api` folder to your server (or deploy this repo root).
2. Install deps:

   npm install

3. Set environment variables on the server (never commit these):

   UGS_SERVERTOKEN=your_server_token
   UGS_ORG_ID=your_org_id
   UGS_PROJECT_ID=your_project_id
   UGS_LEADERBOARD_ID=your_leaderboard_id

4. Start the server:

   npm start

5. Point the widget to the proxy: set `apiUrl` to `https://your-host/api/leaderboard` in `leaderboard.html`.

Local test (Windows PowerShell):

  $env:UGS_SERVERTOKEN="your_token"
  $env:UGS_ORG_ID="ORG"
  $env:UGS_PROJECT_ID="PROJECT"
  $env:UGS_LEADERBOARD_ID="LBID"
  npm install
  npm start

Notes
- The proxy falls back to `webleaderboard/example-data.json` if UGS config is missing or the UGS API call fails.
- Keep `UGS_SERVERTOKEN` secret. Use platform secrets when deploying (Render/Heroku/etc.).
