# PoolMasters 🎱

Pool night management: admin-run teams of two, a group stage + knockout on 4 tables, live ball tracking and synced match clocks. See [SPEC.md](SPEC.md) for the full spec.

## Run it

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
| `DATA_DIR` | `./data` | Where `db.json` is stored |

`npm run dev` restarts the server automatically whenever you change a file.

### Pool night: one command (server + Cloudflare link)

```bash
npm run live -- -p "your-secret"
```

This starts the server and a free Cloudflare Quick Tunnel, then prints every link: this PC, same Wi-Fi, and a public `https://….trycloudflare.com` link that works from anywhere. Ctrl+C stops both.

Options:
- `--port 3001` runs on a different port.
- `--no-tunnel` uses only the Wi-Fi link.
- `-h` shows the help.

The `--` after `live` is required, so the options reach the app instead of npm. You need cloudflared installed: `winget install --id Cloudflare.cloudflared`.

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
public/            single-page app (index.html, app.js, styles.css)
```
