# GYST WebMCP — Demo Recording Script

A shooting script for the OpenAI WebMCP Challenge demo video.

**Hard constraints:** public on YouTube, **under 3:00**, **with audio**. This script runs ~2:40.

**The one story:** the agent reads the week and prepares the record; only the person commits it.

---

## Before you hit record

### 1. Check the week is rich enough (2 minutes)

The demo seeds only days that have already happened (`where day.day_on < v_today`), and the
weekly view is bounded to the current ISO week. So the earlier in the week you record, the
thinner the week looks.

| Record day | Committed days this week | Findings you'll get |
| --- | --- | --- |
| Monday | 0 | **Do not record.** Nothing to read. |
| Tuesday | 1 | Thin. Avoid. |
| Wednesday | 2 | `repeated_noncompletion` (needs 2) + `buried_win`. Workable. |
| Thursday | 3 | Adds `blocker_recurrence` (needs 3). **Best.** |

Open the demo and confirm **What the week shows** lists at least two findings before you record.
If it says "No structured patterns appeared in this bounded week," stop — record later in the week.

### 2. Setup

1. Open Codex Desktop's browser-attached chat, model `gpt-5.6-terra`.
2. Open <https://gyst-web-mcp.vercel.app> in that browser.
3. Click **Open the demo** — a fresh anonymous fictional ledger. Never a personal account.
4. You land on `/daily`. Navigate to **Weekly**.
5. Confirm the **WebMCP agent assistance** panel is present and lists seven tools.

If the panel is missing, you are not in a WebMCP-enabled browser. Stop and reopen in the
browser attached to Terra. Do not record around it.

### 3. Know the persona

The seeded ledger belongs to someone making an illustrated field guide. Their week is full of
chapter outlines, sample spreads, a studio review, an archive backlog, and a **fictional review
board** they keep waiting on. **Every word you improvise must fit that world.** A fact about
sprints or support tickets breaks the story on camera.

---

## The script

Left column is what's on screen. Right column is what you say, close to verbatim.

### 0:00–0:15 — Cold open, homepage

> **On screen:** the landing page. "A quiet ledger for the work only you can decide."

> **Say:** "This is GYST. It's a ledger for daily and weekly reviews. An agent can read your
> week and prepare the record — but it can't commit it. Only you can. Let me show you why that
> matters."

### 0:15–0:30 — One click into the demo

> **On screen:** click **Open the demo** → Turnstile → lands on `/daily` → click **Weekly**.

> **Say:** "No account, no email. One click opens a private demo with a fictional week already
> in it. I'll go to the weekly review."

### 0:30–0:45 — The tool surface

> **On screen:** the **WebMCP agent assistance** panel. Expand **View this ritual's tools**. Let
> the read-only / draft-only labels sit on screen for a beat.

> **Say:** "GYST publishes seven WebMCP tools on this page. Two are read-only. Five can write to
> my draft. There's no commit tool, no delete tool, no export tool. That isn't an oversight —
> it's the whole design."

### 0:45–1:20 — The agent reads before it writes

> **On screen:** paste **Prompt 1**. Let the tool calls run.

> **Say (over the tool calls):** "I'll ask it to read before it writes."

> **Say (over the answer):** "It calls the read tools and comes back with the patterns in my
> week — the same chapter promised and missed twice, and a buried win I'd forgotten. Then it
> does the thing I actually want. It tells me the one fact it doesn't have, and asks for it
> instead of inventing it."

### 1:20–1:35 — You supply the missing fact

> **On screen:** paste **the fact**.

> **Say:** "So I give it the fact. This is the part only I know."

### 1:35–2:05 — The agent writes the draft

> **On screen:** paste **Prompt 2**. As the tools fire, cut to the page: the **Agent updated —
> review** markers appearing on Observations, Decision, Arrow, Priorities, and the **Recent
> agent draft changes** panel filling in.

> **Say:** "Now it writes — through the draft tools. And watch the page. Every field it touched
> is marked 'Agent updated — review.' Here's the running log: what it changed, and that it was
> not committed. Nothing is hidden, and nothing is final."

### 2:05–2:25 — The human decides

> **On screen:** click into **Decision**, retype it yourself. The marker on that field clears.
> Then click **Commit week**.

> **Say:** "I'll rewrite the decision in my own words — and the review marker clears, because
> that field is mine now. Then I commit. The agent asked me to. It structurally cannot do this
> itself."

### 2:25–2:40 — Permanence, and the claim

> **On screen:** refresh. "This week's record is committed. It is preserved as an immutable
> ledger record."

> **Say:** "Refresh. It's an immutable ledger record. The agent read the week and prepared the
> record. I decided what became part of it."

---

## Paste blocks

### Prompt 1 — read only

```text
Use the GYST WebMCP tools.

Read only — do not change anything yet. Inspect my current weekly context and draft, then tell me:
1. the two clearest patterns in my week,
2. the one fact you still need from me before you can prepare a decision,
3. what you think the decision should address.
```

### The fictional fact

```text
The review board only sits on Fridays. That's why the chapter kept sliding — I never planned
around their cadence, I just re-promised the same chapter every morning and ran out of focused
hours by the afternoon.
```

### Prompt 2 — prepare, never commit

```text
Use that fact and the weekly context to prepare my draft.

Record one observation, set the decision in my own words, set the arrow to up, and set one
priority: "Draft the accessibility chapter before Friday's review board", due 2026-09-04.

Do not commit anything. Then list exactly which draft fields you changed.
```

**Why the arrow is "up":** the chapter has been slipping, so "up" needs earning. It's justified
because the cause was just identified. If you want to say one extra line on camera: *"Up — not
because the week went well, but because I finally know why it didn't."* Cut it if you're over time.

---

## Post-production

Model latency will wreck a 3:00 budget if you narrate live through it. Two safe options:

- **Preferred:** screen-record the whole run silently, trim the waiting, then lay the voiceover
  over the trimmed cut. You get an exact runtime and clean audio.
- **Live narration:** record in segments and cut on the tool-call spinner. Never sit in silence.

Editing the video is fine. What you cannot change after the deadline is the Devpost submission
entry itself — so the YouTube link must be final and public before 2026-09-03, 1:00 p.m. PDT.

---

## If something breaks mid-take

The early recovery tools exist for exactly this: `gyst.get_status`, `gyst.open_daily_ritual`,
`gyst.open_weekly_ritual`. If the agent loses the page, ask it to call `gyst.get_status` and
navigate back. Do not narrate the recovery — reset and start the take again.

If a tool call errors, the draft is unchanged and the ledger is untouched. Reload and retake.

---

## Keep out of frame

Reminders, exports, account deletion, `/settings`, signup, any real account, any provider
console, any secret, any personal context. The focused ritual flow is the strongest evidence of
both the product's value and its safety boundary. Everything else dilutes it.
