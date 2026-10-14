# PoolMasters 🎱

Pool tournament management: live single-elimination brackets, ball-by-ball tracking and match clocks. See [SPEC.md](SPEC.md) for the full spec.

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

1. **Admin** → `#/admin` → sign in → create a tournament (name, match clock).
2. **Players** open the tournament and enter their name. A new name lets them choose a PIN; a taken name asks for that player's PIN. Finishing signs them in and joins the tournament.
3. Admin verifies players (from the control room or the tournament's player board), then taps **Draw bracket**.
4. Admin opens a match → **Start match & clock** → sets groups → taps balls as they drop → declares the winner. If the clock runs out, a popup asks who wins.
5. The final winner gets the crown 👑.

## Layout

```
server.js          HTTP server, REST routes, SSE live updates, static files
src/bracket.js     bracket drawing, byes/forfeits, match actions, clock
src/auth.js        names, PIN hashing, tokens, lockouts
src/store.js       JSON persistence
public/            single-page app (index.html, app.js, styles.css)
```
