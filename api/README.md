Serving Unity Leaderboards to the website

Overview
- `leaderboard.php` will try to call Unity Gaming Services (UGS) Leaderboards REST API when the following environment variables are set on your web server:
  - `UGS_SERVERTOKEN` - server access token (keep secret)
  - `UGS_ORG_ID`      - Unity organization id
  - `UGS_PROJECT_ID`  - Unity project id
  - `UGS_LEADERBOARD_ID` - leaderboard id
- If these are not set (or the UGS call fails) the endpoint falls back to `webleaderboard/example-data.json` so the widget still shows data.

How to get the values
- Organization and Project IDs: available in the Unity Dashboard URL or project settings. In your console URL the GUIDs visible correspond to org/project/environments.
- Leaderboard ID: the id you created in Unity Leaderboards (seen in Dashboard or in your project's Leaderboards settings).
- Server token: create a server-side service credential in Unity (Service Account / Server token) or use the server access token mechanism documented by Unity. Keep this token secret and do NOT put it into client-side JavaScript.

Quick server setup examples
- Apache `.htaccess` (if your host allows env vars):

  SetEnv UGS_SERVERTOKEN "your_server_token_here"
  SetEnv UGS_ORG_ID "your_org_id"
  SetEnv UGS_PROJECT_ID "your_project_id"
  SetEnv UGS_LEADERBOARD_ID "your_leaderboard_id"

- Windows PowerShell (local test):

  $env:UGS_SERVERTOKEN="your_server_token_here"
  $env:UGS_ORG_ID="ORG_ID"
  $env:UGS_PROJECT_ID="PROJECT_ID"
  $env:UGS_LEADERBOARD_ID="LEADERBOARD_ID"
  php -S 0.0.0.0:8000 -t e:\friendlyshootersite

- Linux / systemd / Docker: set env vars in your container or systemd unit.

Testing the endpoint
- After configuring env vars and deploying files, test with curl (replace host):

  curl -sS https://friendlyshooter.com/api/leaderboard.php | jq

- For local testing (if you can't set env vars on the server) you can pass parameters in the query string (NOT secure; only for temporary testing):

  curl -sS "http://localhost:8000/api/leaderboard.php?token=MYTOKEN&org=ORG&project=PROJECT&leaderboard=LBID" | jq

Security notes
- Never expose `UGS_SERVERTOKEN` in client-side code or public repos.
- If your host doesn't support setting environment variables, consider using a small Node server (Express) where you can pass env vars at process start, or host the proxy on a platform that supports secrets (Render, fly.io, Heroku, etc.).

If you want
- I can add a Node/Express proxy script (`leaderboard-express.js`) and `package.json` so you can run the proxy on any server that supports Node.
- Or I can walk you through creating a Unity service account / server token step-by-step if you want me to. 

Next step
- Set the four environment variables on your host and reload the site. Then visit https://friendlyshooter.com/leaderboard.html — the widget should now fetch UGS data via `/api/leaderboard.php` and show live entries.
