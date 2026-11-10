# PoolMasters 🎱

Pool night management: admin-run teams of two, a group stage + knockout on 4 tables, live ball tracking and synced match clocks. See [SPEC.md](SPEC.md) for the full spec.

## Pool night: double-click

Double-click **`Start PoolMasters.bat`** in this folder. A window opens and shows:
- **Anywhere:** the public link to share (ngrok, the same every time).
- **Admin:** where you sign in.

To stop, press **Ctrl+C** in that window, then any key. Everything is saved.

The first time, it asks you to choose an admin password and saves it in `.env` (git ignores it), so after that it starts straight away. To change the password, delete `.env` and start again. You'll then have to paste the Gemini key again, because it is locked with the password.

Tip: right-click the file → **Show more options** → **Send to** → **Desktop (create shortcut)** to start it from your desktop.

You need [Node.js](https://nodejs.org) (LTS) and the one-time ngrok setup below.

## Run it (by hand)

Requires Node.js 20+. There are no dependencies to install.

```bash
# default admin password is "poolmasters" — change it:
ADMIN_PASSWORD=your-secret npm start        # macOS / Linux / Git Bash
$env:ADMIN_PASSWORD="your-secret"; npm start  # PowerShell
```

Open http://localhost:3000. Other phones on the same Wi-Fi can use `http://<this-computer's-IP>:3000`.

| Env var | Default | |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `ADMIN_PASSWORD` | `poolmasters` | Admin sign-in |
| `DATA_DIR` | `./data` | Where `db.json` and `secrets.json` are stored |

`npm run dev` restarts the server automatically whenever you change a file.

### One command (server + ngrok link)

```bash
npm run live                     # uses the password saved in .env (asks the first time)
npm run live -- -p "your-secret" # or give one for this run only
```

This is what the double-click runs. It starts the server and an ngrok tunnel, then prints every link: this PC, same Wi-Fi, and a public `https://….ngrok-free.dev` link that works from anywhere. The ngrok link is **the same every time**, so you can print a QR code for it once. Ctrl+C stops both.

Options:
- `--port 3001` runs on a different port.
- `--no-tunnel` uses only the Wi-Fi link.
- `-h` shows the help.

The `--` after `live` is required, so the options reach the app instead of npm.

**One-time ngrok setup:**
1. Install it: `winget install --id ngrok.ngrok`, then open a new terminal.
2. Sign up for free at [dashboard.ngrok.com](https://dashboard.ngrok.com/signup) and copy your authtoken from **Your Authtoken**.
3. Run `ngrok config add-authtoken <your-token>`.

Your fixed link is shown under **Domains** in the ngrok dashboard. The free plan picks the name for you.

**Free plan limits**, per month: 20,000 requests and 1 GB of traffic. With live updates one phone uses only a handful of requests per visit, and updates are compressed, so a normal pool night fits comfortably. Visitors see an ngrok notice page the first time and tap **Visit Site** once; it is remembered for 7 days.

## Ask Gemini about the rules

1. Start the server with your own `ADMIN_PASSWORD`. A key can't be saved with the default password.
2. Create a key at [Google AI Studio](https://aistudio.google.com/apikey).
3. **Admin** → **Tournament** tab → **Gemini** card → paste the key → **Save**.
4. Ask away in the **Ask Gemini** tab. Your rules are sent along automatically.

The key is stored encrypted with the admin password, so if you change that password, paste the key again. Back up `data/` carefully and never commit it.

## Typical night

1. **Admin** → `#/admin` → sign in → **Teams** tab → **Add team** for each pair and type the names. (Order decides the groups; use **Shuffle** for a random draw.)
2. **Tournament** tab → check the clock (15 min by default) → **Start tournament**.
3. **Tables** tab → **Start all tables** starts every table of the round at the same moment. Set suits, tap balls as they drop, tap the winner. If the clock runs out, a popup shows who has fewer balls left.
4. Everyone else just opens the site: the landing page shows the tables in play, standings and stats; **Schedule** shows the whole night as a grid; **Rules** has the house rules.
5. When the final is decided the champions get the crown 👑. **New tournament** saves the night to the Hall of fame.

## Layout

```
server.js          HTTP server, REST routes, SSE live updates, static files
src/tournament.js  schedule (round robin + knockout), standings, match and round actions, clock
src/auth.js        admin password check, tokens, lockouts
src/store.js       JSON persistence
src/ai.js          Gemini: encrypted API key, rules prompt, API calls
public/            single-page app (index.html, app.js, i18n.js with English + Dutch text, styles.css)
```
