# PoolMasters: Spec Sheet

**Version:** 2.0 · **Last updated:** 2026-10-26 · **Status:** v2 implemented (first pass, open to adjustment)

PoolMasters runs one pool (8-ball) night at a time. The admin manages everything from one control room: the teams, the tournament and every table. Everyone else opens the site and sees what is happening right now: tables in play, standings, the schedule and the rules. There is no sign-up and no player accounts.

> **What changed from v1:** player sign-up, PINs and verification are gone. Players are no longer individuals who join; the admin creates **teams of two**. The single-elimination bracket is replaced by a fixed **group stage + knockout** format on **4 tables**. The landing page now goes straight to the tournament in play. There are new **Schedule** and **Rules** pages.

---

## 1. Roles

| Role | How they get in | What they can do |
|---|---|---|
| **Viewer** | Opens the site | See everything: live tables, standings, knockout, schedule, rules, stats (read-only) |
| **Admin** | Admin password (`ADMIN_PASSWORD` env var) | Add, remove and rename teams and players; disable a player; set up, start and reset the tournament; run all tables |

There is one admin password. It can be signed in on several devices at once, for example one phone per table.

---

## 2. Teams

- A team always has **exactly two players**.
- **Add team** creates "Team N" with "Player 1" and "Player 2". The admin renames them inline: click a name, type, and press Enter (or click away) to save. Esc cancels.
- Any player can be **disabled** (switch next to their name) and enabled again. A disabled player is struck through in the admin list and hidden from public pages. The team keeps playing with the other player. If both are disabled, public pages show "No active players".
- Names are 1–24 characters. Team and player names can be edited **at any time**, including during play.
- **Order = seed.** The first half of the list is Group 1 and the rest is Group 2. The admin can move teams up and down or **Shuffle** the order at random.
- Adding, removing, reordering and shuffling are only possible **during setup**. Once the tournament starts, the team list is locked (renaming and disabling still work).
- Limits: at least 4 teams to start, at most 32.

---

## 3. Tournament format

Designed for **10 teams on 4 tables in 8 rounds of 15 minutes** (about two hours). Other team counts also work, see §3.4.

### 3.1 Group stage (rounds 1–5)
- Two groups of five: Group 1 = teams 1–5, Group 2 = teams 6–10.
- Single round robin: each team plays 4 matches and rests (bye) in 1 round.
- **Tables 1 and 2 = Group 1. Tables 3 and 4 = Group 2.**
- Rotation: in round *r* the resting team is the (6 − *r*)th of its group, so Team 5 and Team 10 rest in round 1, Team 4 and Team 9 in round 2, and so on.

| Round | Table 1 | Table 2 | Table 3 | Table 4 | Resting |
|---|---|---|---|---|---|
| 1 | T1 v T4 | T2 v T3 | T6 v T9 | T7 v T8 | T5, T10 |
| 2 | T1 v T2 | T3 v T5 | T6 v T7 | T8 v T10 | T4, T9 |
| 3 | T1 v T5 | T2 v T4 | T6 v T10 | T7 v T9 | T3, T8 |
| 4 | T1 v T3 | T4 v T5 | T6 v T8 | T9 v T10 | T2, T7 |
| 5 | T2 v T5 | T3 v T4 | T7 v T10 | T8 v T9 | T1, T6 |

### 3.2 Knockout (rounds 6–8)
| Round | Table 1 | Table 2 | Table 3 | Table 4 |
|---|---|---|---|---|
| 6 · Quarterfinals | 1st G1 v 4th G2 | 2nd G2 v 3rd G1 | 1st G2 v 4th G1 | 2nd G1 v 3rd G2 |
| 7 · Semifinals | W QF1 v W QF2 | W QF3 v W QF4 | *open play* | *open play* |
| 8 · Finals | **Championship**: W SF1 v W SF2 | 3rd place: L SF1 v L SF2 (optional) | *open play* | *open play* |

Group winners can only meet in the final. Quarterfinal slots fill in automatically when the **last group match** is decided. Later slots fill in as results arrive.

### 3.3 Standings and tiebreaks
- A win = **1 point**.
- **Two-way tie:** head-to-head result (marked **H2H** in the table).
- **Three or more tied:** ball differential across all group matches (marked **±**), then balls cleared, then seed.
- **Ball differential**, per match: balls of your own suit pocketed, plus 1 for the 8 if you won with it down, minus the same for your opponent. A match with an open table (no suits set) counts 0–0.
- The cut line under 4th place is drawn as a dashed gold line.

### 3.4 Other team counts
The same rules are applied generically: groups are ⌈n/2⌉ and ⌊n/2⌋, round robin by the circle method (odd groups have one bye per round). If both groups have ≥ 4 teams, the top 4 go to quarterfinals. Otherwise the top 2 go straight to semifinals (1st G1 v 2nd G2, 1st G2 v 2nd G1). The number of tables is whatever the busiest round needs.

### 3.5 Lifecycle
```
setup ──(Start tournament)──▶ live ──(last match decided)──▶ done
  ▲                             │                              │
  └──────(Reset: wipe results)──┘     (New tournament: archive)┘
```
- **Setup:** teams are editable. Everyone can already see a **preview** of the schedule built from the current team list.
- **Start** locks the teams and fixes the schedule.
- **Reset** (while live) wipes every result and goes back to setup. Teams are kept.
- **New tournament** (when done) saves the night to the **Hall of fame** (name, date, podium, totals) and goes back to setup with the same teams.
- Settings: tournament name, match clock (default **15 min**, 0 = none), 3rd-place match on/off (can only be changed during setup).

---

## 4. Matches

### 4.1 States
| State | Meaning |
|---|---|
| `waiting` | Knockout slot not known yet (shows "1st G1", "Winner QF2", …) |
| `ready` | Both teams known, not started ("Up next"), or **paused** (started before) |
| `live` | Running |
| `done` | Has a winner. Result `win` or `timeout` |

### 4.2 Ball tracking
- Balls 1–7 are Solids, 9–15 are Stripes, 8 is the 8-ball. All balls are drawn as real balls.
- Suits: the admin sets "Team A: Solids", "Team A: Stripes" or **Open**. Team B automatically gets the other suit.
- Tap a ball to mark it pocketed, and tap again to undo. Each team shows **balls left** of its suit.
- **Sinking the 8** opens a prompt straight away: *who takes it?* (Team A / Team B / "Oops, put it back" / "Not yet").
- The app never decides a winner by itself. The admin always confirms.

### 4.3 Clock
- Every match starts with the tournament clock (default 15 min). The admin can **set** a different time per match, **+1 min**, **reset** it, or pause it.
- The clock is server-authoritative (`endsAt`), so every device shows the same countdown. It turns amber in the last minute and blinks red at 00:00.
- **Time's up:** every admin device beeps and shows a popup that says who is ahead on balls ("Team X has fewer balls left (2 vs 5)") or, when level, reminds them of the **sudden-death 8-ball shot**. The popup offers: pick the winner (recorded as *on time*), **+2 more minutes**, or **Decide later**. It closes on all devices once the match is decided anywhere.

### 4.4 Undo
- **Undo** puts a decided match back to live, with balls kept.
- A group match can be undone until the knockout has started. A knockout match can be undone until the match it feeds has started.

---

## 5. Screens

| Route | Screen | What's on it |
|---|---|---|
| `#/` | **Live** (landing) | *Setup:* "Racking up soon" hero with an animated rack, team cards with group badges, Hall of fame. *Live / done:* champion banner (when done), tournament name, **round track** (8 segments filling as matches finish, knockout in gold), **stat tiles** (matches played, balls pocketed, 8-balls sunk, average match time), **On the tables** (one mini pool table per table for the current round: teams, live clock, balls left, suit balls, resting teams), **Group standings**, **Road to the final** (QF → SF → Final + 3rd place), **Leaders** (most wins, balls cleared, fastest win, biggest margin), **Hall of fame** |
| `#/schedule` | **Schedule grid** | 8 rows (rounds) × 4 columns (tables) + a **Resting** column. Row labels show the stage and the planned start time (start + (r−1) × clock). Group 1 cells are green, Group 2 blue, knockout gold. Unused tables in rounds 7–8 are hatched **Open play**. The current round is highlighted with a "Now" tag, live cells glow with a running clock, winners get a check and losers are struck through. During setup it is a labelled preview. Admins can click a cell to jump to that round in the control room. |
| `#/rules` | **Rules** | On-the-table rules (open table, calling shots, legal shot, fouls/ball-in-hand, losing on the 8). The format as a 4-step flow (group stage → QF → SF → Final). Clock, standings, ball differential and schedule rules. |
| `#/admin` | **Control room** | Sign-in, then three tabs: **Tables**, **Teams**, **Tournament** (the last tab is remembered per device) |

### 5.1 Control room: Tables tab
- **Round bar** (sticky): round chips 1–8 (green = done, gold = knockout done, pulsing = live), the selected round's name, its longest-running clock and "x of y tables live". It follows the current round automatically. Picking another round sticks until "Back to round N".
- **Start all tables** starts every playable table in the round with **one shared start time**, so all clocks run in sync. The same button resumes paused tables. Also **Pause all** and **+1 min all**.
- **One card per table** (2 × 2 on desktop, stacked on phones). Each card shows the teams with avatars, active players, suit chip and a big **balls-left** number; suit buttons; a felt **rack** with solids, the 8 and stripes, each set labelled with its owner; Start/Pause/Resume, +1, a settings menu (set clock, reset clock, restart match); and two **winner** buttons. Decided cards show the winner and **Undo**. Unresolved knockout cards show their sources.
- Resting teams for the round are listed under the cards.

### 5.2 Control room: Teams tab
Teams listed under Group 1 / Group 2 headings (by position), each row: seed, avatar, team name (inline edit), two players (inline edit + on/off switch), move up/down, remove. **Add team**, **Shuffle**, and an "Add another team" row at the bottom.

### 5.3 Control room: Tournament tab
Name, match clock and 3rd-place settings; a plain-language format summary for the current team count; **Start tournament** / **Reset tournament** / **New tournament**.

### 5.4 Animations
- Page sections rise in with a stagger when you open a page (not on live updates).
- A pocketed ball spins and shrinks into the pocket, and an un-pocketed ball pops back.
- Standings rows **slide** to their new position when the order changes (FLIP).
- Stat counters roll up to their new values.
- When a match is decided, its card flashes gold and bursts **confetti**. The champion gets a multi-burst celebration, a rotating glow and a bobbing crown.
- The live round segment shimmers, live tables glow, live badges pulse, and the clock pulses in the last minute.
- All motion is off under `prefers-reduced-motion`.

### 5.5 Visual theme
Dark pool-hall palette (near-black, emerald felt, gold trophy accents), wood-rimmed felt tables, Space Grotesk headings and Inter body text. Responsive down to 360 px: the schedule grid and knockout scroll sideways inside their own containers, with the round labels sticky.

---

## 6. Real-time model

- **Server-Sent Events** (`GET /api/events`) push the full state to every client after each change. Everyone gets the same state.
- Clients re-render from state and keep focus, typed text, scroll and open panels. Only the parts that changed animate.
- **Polling fallback** when SSE is blocked (e.g. Cloudflare Quick Tunnels): `GET /api/state?v=` every 2 s while visible, and immediately after your own actions. The connection dot shows green (live), amber (polling) or red (reconnecting).

---

## 7. Data model (`data/db.json`, version 2)

```js
version: 2
sessions: { [token]: { createdAt } }                      // admin sessions only
teams:    [{ id, name, members: [{ name, active }, { name, active }], createdAt }]   // order = seed
event: {
  name, status: 'setup' | 'live' | 'done',
  clockMinutes, thirdPlace,
  groups: [[teamId…], [teamId…]], groupRounds, rounds, tables, advance,
  matches: [{
    id: 'r{round}t{table}', round, table,
    stage: 'group' | 'qf' | 'sf' | 'final' | 'third', group: 0 | 1 | null,
    a, b,                                   // team ids (null until known)
    srcA, srcB,                             // {rank:{group,place}} | {winner:id} | {loser:id}
    winner: 'a' | 'b' | null, result: 'win' | 'timeout' | null,
    groupA: 'solids' | 'stripes' | null,    // team B gets the other suit
    potted: number[],                       // in pocketing order
    timer: { durationMs, remainingMs, endsAt, running },
    live, startedAt, finishedAt
  }],
  championId, startedAt, completedAt
}
history: [{ name, startedAt, completedAt, teams, matches, balls, podium: [{ name, members }|null ×3] }]
```

Standings are computed, not stored. During setup the public state carries a **preview** schedule (`event.preview: true`) built from the current teams.

Writes are debounced (150 ms) and atomic. An unreadable file is moved to `db.corrupt-<ts>.json`. A **v1 file** (players/brackets) is moved to `db.v1-<ts>.json` and the app starts fresh.

---

## 8. API

JSON bodies. Admin calls need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/events` | SSE state stream |
| GET | `/api/state?v=` | State (or `{unchanged:true}`) |
| GET | `/api/me` | `{role: 'admin' \| null}` |
| POST | `/api/admin/login` | `{password}` → `{token, me}` (5 wrong tries per IP → 5 min lock) |
| POST | `/api/logout` | End session |
| POST | `/api/teams` | Add team `{name?, members?: [a, b]}` (setup only) |
| PATCH | `/api/teams/:id` | `{name}` |
| PATCH | `/api/teams/:id/members/:index` | `{name?, active?}` |
| DELETE | `/api/teams/:id` | Remove (setup only) |
| POST | `/api/teams/:id/move` | `{by: -1 \| 1}` (setup only) |
| POST | `/api/teams/shuffle` | Random order (setup only) |
| PATCH | `/api/event` | `{name?, clockMinutes?, thirdPlace?}` |
| POST | `/api/event/start` | Build the schedule and go live |
| POST | `/api/event/reset` | Back to setup (archives a finished night) |
| POST | `/api/matches/:id/action` | `start`, `pause`, `restart`, `ball {ball}`, `groups {groupA}`, `timer {op: set\|add\|reset, minutes}`, `winner {slot, reason?}`, `undo` |
| POST | `/api/rounds/:round/action` | `start` (shared start time), `pause`, `add {minutes}` for every playable table in the round |

---

## 9. Security notes

- Only the admin can change anything. Everything is publicly readable.
- Admin password compared in constant time. The default is `poolmasters`, and the server warns until `ADMIN_PASSWORD` is set.
- All user text is HTML-escaped. Bodies capped at 16 KB. Static serving is protected against path traversal.
- There is no HTTPS by itself. Put the app behind a TLS proxy (or the Cloudflare tunnel) when it is exposed beyond the local network.

---

## 10. Non-goals (for now)

- Automatic rule enforcement (fouls, early 8)
- Several tournaments at once, or several admin accounts
- Race-to-N frames per match
- Teams of other sizes than two

---

## 11. Open questions

1. **Disabled players.** A disabled player is only a label for now: the team still plays. Should a team with both players disabled forfeit its matches automatically?
2. **Withdrawing a team mid-tournament.** Not supported: teams are locked once started. Should there be a "withdraw" that forfeits its remaining matches?
3. **Seeding into groups.** Currently by list order (with Shuffle). Is manual drag-and-drop between groups wanted?
4. **3rd-place match.** It is on by default and must be decided before the start. Should it be possible to skip it on the night?
5. **Open-table ball differential.** A match finished with an open table counts 0–0. OK, or should the admin always set suits?
6. **"Stripes" wording.** If your group says something else, change `GROUPS` in `public/app.js`.
