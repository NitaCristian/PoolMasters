# PoolMasters: Spec Sheet

**Version:** 1.0 · **Last updated:** 2026-10-14 · **Status:** v1 implemented

PoolMasters is a web app for running pool (8-ball) tournaments. One admin creates tournaments and runs the tables. Players join from their phones using a unique name, then follow a live single-elimination bracket. They can watch balls being pocketed and match clocks counting down as it happens.

---

## 1. Roles

| Role | How they get in | What they can do |
|---|---|---|
| **Visitor** | Opens the site | View tournaments, brackets, match tables (read-only) |
| **Player** | Unique name + PIN (4–6 digits) | Everything a visitor can do, plus join and leave tournaments |
| **Admin** | Admin password (`ADMIN_PASSWORD` env var) | Create, edit and delete tournaments; verify and disable players; draw the bracket; run matches (balls, groups, clock, winner); change sign-in settings |

There is exactly **one admin account**. It can be signed in on several devices at once, for example one phone per table.

---

## 2. Player identity

- **Unique name.** 2–24 characters: letters, numbers, spaces and `. _ - '`. Uniqueness is case- and whitespace-insensitive, so `Fast Eddie` and `fast  eddie` count as the same name.
- **PIN.** 4–6 digits, stored as a salted scrypt hash and never sent back to clients.
- **Brute-force protection.** 5 wrong PINs locks that name for 5 minutes. Admin login uses the same rule, per IP address.
- **Sessions.** A random bearer token stored in the browser. Sessions expire after 30 days.

### 2.1 Two-step sign-in
1. **Name.** The player types a name. The server checks whether it is taken (`GET /api/players/check`).
2. **PIN.**
   - If the name is **free**, the player chooses a PIN and the player is created.
   - If the name is **taken**, it shows "Welcome back, *Name*" and asks for that player's PIN.
   - "Not you? Change name" goes back to step 1.

### 2.2 Where players sign in
- **On a tournament page (the main way).** While registration is open, a "Join this tournament" panel holds the two-step flow. Finishing it signs the player in, or creates them, **and joins that tournament** in one step (`POST /api/tournaments/:id/enter`).
- **Once a tournament is in progress.** The panel lets only **existing** players sign in. New names are refused because registration is closed.
- **On the home page.** If any tournament is open for registration, the home page lists those tournaments with **Join** buttons instead of a form. The plain sign-in/sign-up form appears only when **no tournament is open**.
- **"Require a PIN" toggle (admin setting, on by default).** This is still an open product question (see §11).
  - **On:** a PIN is required to register and to sign in.
  - **Off:** players register and sign in with only their name. This is faster, but anyone can sign in as anyone.
  - A player who registered while PINs were off and signs in after PINs are turned on sets their PIN at that sign-in.

---

## 3. Tournament lifecycle

```
registration ──(admin: Draw bracket)──▶ in_progress ──(final decided)──▶ completed
      ▲                                      │
      └──────────(admin: Redraw)─────────────┘   (wipes all results)
```

### 3.1 Registration
- The admin creates a tournament with a **name**, a **default match clock** (0–180 min, 0 = no clock) and a **"live balls" visibility** toggle.
- A player taps **Join** and gets an entry with status **`pending`** (unverified).
- The admin **verifies** each player (`pending → verified`) or **disables** them.
- A player can **leave**. They can rejoin while registration is still open, and come back as `pending`.

### 3.2 Entry statuses and the player board

| Status | Meaning | How it is shown | Board order |
|---|---|---|---|
| `verified` | Approved by the admin, will be in the bracket | Normal card, green dot | 1st (by join time) |
| `pending` | Joined, not yet approved | Greyed out, dashed border, "Awaiting verification" | 2nd (by join time) |
| `disabled` | Removed by the admin | Faded, name struck through, red dot | Last (by time of change) |
| `left` | The player withdrew | Faded, name struck through, grey dot | Last (by time of change) |

Once the bracket is drawn, verified players also show their **fate**: *Still in*, *Eliminated* or *Champion* (with a crown).

### 3.3 Drawing the bracket
- Needs **at least 2 verified players**. Pending players are left out.
- Format: **single elimination**. The bracket size is the next power of two.
- Seeding is **random** (crypto-random shuffle), placed with standard seed order (1v8, 4v5, 2v7, 3v6…). Because of this, **byes are spread evenly** and a bye never meets another bye.
- Byes are resolved automatically: the player advances.

### 3.4 Withdrawals during play
If a player is **disabled** or **leaves** while the tournament is in progress:
- Their current match (opponent known) is a **forfeit**, and the opponent advances.
- If their next opponent isn't known yet, the forfeit applies as soon as the opponent arrives.
- Results cascade automatically through later rounds.
- Players who were pending when the bracket was drawn cannot be added later. To add them, redraw the bracket.

---

## 4. Matches

### 4.1 Match states
| State | Meaning |
|---|---|
| `waiting` | One or both slots are still TBD |
| `ready` | Both players known, not started ("Up next") |
| `live` | Started by the admin (or any ball, group or clock-start action) |
| `done` | Has a winner |

**Result types:** `win` (normal), `timeout` (decided when the clock ran out), `forfeit`, `bye`.

### 4.2 Ball tracking (8-ball)
- Balls 1–7 are **Solids**, 9–15 are **Stripes**, and 8 is the 8-ball. Every ball is drawn as a real ball: colour, number disc, white bands for stripes, gloss.
- **Groups:** the admin sets player A to Solids or Stripes. Player B automatically gets the other group. The table can also be left **open**.
- **Pocketing:** the admin taps a ball in a triangle rack to mark it pocketed, and taps again to undo. The order balls were pocketed is kept and shown in a "Pocketed" tray.
- Under each player: a group chip (with a ball icon), their 7 balls with pocketed ones dimmed, and an "x / 7 pocketed" count.
- The app does **not** decide winners from balls (fouls, early 8, etc.). The admin always declares the winner.

### 4.3 Live-ball visibility
Each tournament has a **"Show pocketed balls to players live"** toggle (default on).
- **On:** everyone sees pocketed balls in real time.
- **Off:** non-admins still see groups, but the server removes ball data from their feed. Admins always see everything.

### 4.4 Match clock
- Every match starts with the tournament's default duration. The admin can adjust it per match.
- Controls: **Set** (minutes), **Start / Pause / Resume**, **+1 min**, **Reset**.
- **Start match** also starts the clock, if one is set.
- The clock is server-authoritative (`endsAt` timestamp). Each device corrects for clock skew using the server time sent with every update, so all phones show the same countdown.
- The clock turns amber in the last minute and blinks red at 00:00.
- **Time's up:** when a running clock hits zero, every admin device shows a popup on whatever page it is on, with a short beep. The popup offers: **pick the winner** (recorded as `timeout`), **+2 more minutes**, or **Decide later**. The popup closes itself on all devices once the match is resolved anywhere.

### 4.5 Declaring a winner and undo
- The admin taps the winner (with a confirmation step). The winner advances to the next match. If it was the final, the tournament becomes `completed` and that player is the **champion**.
- **Undo result** is allowed until the next match has started or finished. Byes and forfeits cannot be undone.

---

## 5. Screens

| Route | Screen | Highlights |
|---|---|---|
| `#/` | Home | Hero; "Join a tournament" list when any tournament is open, otherwise the two-step sign-in card (signed-in players see a welcome card listing their entries); tournament cards with status, player count, clock, live tables, progress bar, champion |
| `#/t/:id` | Tournament | Header with status and actions (Join/Leave, or for the admin: Draw bracket / Redraw / Delete / Settings); **join panel** with the two-step sign-in for signed-out visitors; champion banner; **Now playing** tiles; **Bracket**; **Player board** |
| `#/t/:id/m/:matchId` | Table view | Pool-table scoreboard (wood rail, 6 pockets, felt): avatars, groups, ball rows, big clock, 8-ball; pocketed tray. Admins also get **Table control**: triangle rack, groups, clock controls, winner buttons, undo |
| `#/admin` | Control room | Admin login, or: create tournament, verification queue across all tournaments, "Require a PIN" switch, list of all tournaments |

### 5.1 Bracket visuals
- One column per round (Round of N → Quarterfinals → Semifinals → Final), with elbow connector lines that turn green once a match is decided.
- Match card rows: **green = won**, **red = lost**, with a W/L badge. The **final winner gets a gold crown**, and the final card gets a gold glow.
- Live matches get a glowing green border and show a running clock, group chips and mini ball rows.
- Status tags on cards: *Up next*, *Live mm:ss*, *Bye*, *Forfeit*, *On time*.
- Disabled players or players who left are tagged on their bracket card.

### 5.2 Visual theme
- Dark "pool hall" palette: near-black background with emerald (felt) and gold (trophy) accents. Glassy cards. A pool-table scoreboard with a wood rail.
- Typography: **Space Grotesk** for headings, **Inter** for body text.
- Responsive down to 360 px wide. On phones the scoreboard stacks vertically and the bracket scrolls sideways inside its own container.
- Honours `prefers-reduced-motion`.

---

## 6. Real-time model

- **Transport:** Server-Sent Events (`GET /api/events`). After any change, the server pushes the complete public state to every connected client.
- Clients re-render from that state. Typed input, focus, open panels and bracket scroll position are kept across re-renders.
- Changes are made with ordinary REST calls. Every successful change saves the data and broadcasts it.
- A connection dot in the top bar shows live (green) or reconnecting (red). Clients reconnect automatically.
- **Polling fallback.** Some proxies block SSE, for example Cloudflare Quick Tunnels. If no update arrives within 5 s, the client switches to `GET /api/state`:
  - It refreshes every **10 s**.
  - It also refreshes immediately after the user's own actions and when the tab regains focus.
  - Match clocks still tick smoothly, because they count down on each device.
  - The connection dot turns amber ("Updating every 10 s").

---

## 7. Data model (persisted to `data/db.json`)

```js
settings:    { requirePin: boolean }
players:     { [id]: { id, name, nameKey, pinSalt?, pinHash?, createdAt } }
sessions:    { [token]: { role: 'admin' | 'player', playerId, createdAt } }
tournaments: { [id]: {
  id, name, status: 'registration' | 'in_progress' | 'completed',
  timerMinutes, liveBalls, rounds, championId, createdAt, startedAt, completedAt,
  entries: [{ playerId, status: 'pending' | 'verified' | 'disabled' | 'left', joinedAt, updatedAt }],
  matches: [{
    id: 'r{round}m{index}', round, index,
    a, b,                       // player ids (null = TBD)
    bye: 'a' | 'b' | null,
    winner: 'a' | 'b' | null,
    result: 'win' | 'timeout' | 'forfeit' | 'bye' | null,
    groupA: 'solids' | 'stripes' | null,
    potted: number[],           // in pocketing order
    timer: { durationMs, remainingMs, endsAt, running },
    live, startedAt, finishedAt
  }]
}}
```

The winner of match `r{R}m{i}` feeds slot `a` (if `i` is even) or `b` (if `i` is odd) of match `r{R+1}m{⌊i/2⌋}`.

Writes are debounced (150 ms) and atomic (write to a temp file, then rename). If `db.json` cannot be read, it is moved aside to `db.corrupt-<ts>.json` and never overwritten.

---

## 8. API

All bodies are JSON. Authentication uses `Authorization: Bearer <token>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/events?token=` | anyone | SSE stream of state |
| GET | `/api/me` | anyone | Current role and player |
| GET | `/api/players/check?name=` | anyone | Sign-in step 1 → `{name, exists, hasPin, requirePin}` |
| POST | `/api/tournaments/:id/enter` | anyone | Sign-in step 2 inside a tournament: `{name, pin}` → sign in or create, join if registration is open → `{token, me, created, entryStatus}` |
| POST | `/api/register` | anyone | `{name, pin}` → `{token, me}` |
| POST | `/api/login` | anyone | `{name, pin}` → `{token, me}` |
| POST | `/api/admin/login` | anyone | `{password}` → `{token, me}` |
| POST | `/api/logout` | any session | End the session |
| PATCH | `/api/settings` | admin | `{requirePin}` |
| POST | `/api/tournaments` | admin | `{name, timerMinutes, liveBalls}` → `{id}` |
| PATCH | `/api/tournaments/:id` | admin | Same fields as create (partial) |
| DELETE | `/api/tournaments/:id` | admin | Delete |
| POST | `/api/tournaments/:id/join` | player | Join (→ `pending`) |
| POST | `/api/tournaments/:id/leave` | player | Leave (→ `left`, forfeits if in play) |
| POST | `/api/tournaments/:id/entries/:playerId` | admin | `{status: 'verified' \| 'disabled'}` |
| POST | `/api/tournaments/:id/start` | admin | Draw the bracket |
| POST | `/api/tournaments/:id/reset` | admin | Wipe the bracket, reopen registration |
| POST | `/api/tournaments/:id/matches/:mid/action` | admin | See below |

**Match actions** (`type`):
- `start`
- `ball` with `{ball: 1–15}` (toggles the ball)
- `groups` with `{groupA: 'solids' | 'stripes' | null}`
- `timer` with `{op: 'set' | 'start' | 'pause' | 'add' | 'reset', minutes?}`
- `winner` with `{slot: 'a' | 'b', reason?: 'timeout'}`
- `undo`

---

## 9. Security notes

- PINs: scrypt with a per-player salt, compared in constant time.
- Admin password: compared in constant time. The default is `poolmasters`, and the server prints a warning until `ADMIN_PASSWORD` is set.
- All user text is HTML-escaped before rendering.
- Request bodies are capped at 16 KB. Static file serving is protected against path traversal.
- **Known trade-offs:**
  - A 4-digit PIN is "somewhat secure", not strong.
  - Locking by name means someone can deliberately lock another player out for 5 minutes.
  - The SSE token is sent in the query string.
  - There is no HTTPS by itself. Put the app behind a TLS proxy if it is exposed beyond the local network.

---

## 10. Non-goals for v1

- Double elimination, round robin, race-to-N frames, or 9-ball rules
- Automatic rule enforcement (fouls, early 8-ball losses)
- Multiple admins with separate accounts, or per-table referees
- Player self-service (renaming, PIN reset). For now the admin edits `data/db.json`.
- Multi-instance deployment (state is held in one process)

---

## 11. Open questions

1. **Is the PIN necessary?** The toggle exists so you can try both at a real event. Possible middle ground: no PIN, but sessions stay signed in on the device and the admin's verification step does the gatekeeping.
2. **Show balls live to players?** Implemented per tournament (default on). Decide whether the default should be off.
3. **"Nakeds" vs "Stripes".** The UI says *Stripes*. If your group calls them something else, it is a one-word change in `GROUPS` in `public/app.js`.
4. **Seeding.** Currently random. Should the admin be able to seed manually or by ranking?
5. **Race to N.** Should one bracket match be best-of-3 or best-of-5 frames, with a frame score?
6. **Player PIN reset.** Should there be an admin button for it?
