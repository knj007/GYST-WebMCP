import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { CopyableText } from "@/components/copyable-text";
import { FaqAccordion, FaqItem } from "@/components/faq-accordion";
import { SiteHeader } from "@/components/site-header";
import { submissionLinks } from "@/lib/submission-links";

export const metadata: Metadata = {
  title: "FAQ — GYST",
  description:
    "What GYST is, how its WebMCP tools work, where the challenge submission lives, and how to conduct the ritual with an agent.",
};

const sections = [
  { blurb: "What GYST is, what it asks of you, and who can see it.", id: "basics", title: "The basics" },
  { blurb: "What the site hands an agent, and what it deliberately withholds.", id: "webmcp", title: "WebMCP" },
  { blurb: "What this was built for and where to find the entry.", id: "submission", title: "The challenge submission" },
  { blurb: "Claude, ChatGPT, Gemini, and what to do when no tools appear.", id: "agents", title: "Using GYST with an agent" },
];

const readFirstPrompt = `Use the GYST WebMCP tools.

Read only — do not change anything yet. Inspect my current weekly context and draft, then tell me:
1. the two clearest patterns in my week,
2. the one fact you still need from me before you can prepare a decision,
3. what you think the decision should address.`;

const prepareDraftPrompt = `Use what I just told you and the weekly context to prepare my draft.

Record the observations, set the decision in my own words, set the arrow, and set my priorities with their dates.

Do not commit anything. Then list exactly which draft fields you changed.`;

function Term({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

function External({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="font-medium text-accent underline underline-offset-4" href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Questions</p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
          How GYST works, and how to work it with an agent.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted">
          GYST is a ledger for the work only you can decide. An agent can read your week and prepare the record. Only
          you can commit it. Everything below is what that boundary means in practice.
        </p>

        <nav aria-label="Sections" className="mt-10 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
              href={`#${section.id}`}
              key={section.id}
            >
              {section.title}
            </a>
          ))}
        </nav>

        <section aria-labelledby="basics-heading" className="mt-16 scroll-mt-8" id="basics">
          <h2 className="text-2xl font-semibold tracking-tight" id="basics-heading">
            The basics
          </h2>
          <p className="mt-2 mb-6 text-muted">{sections[0]?.blurb}</p>
          <FaqAccordion>
            <FaqItem question="What is GYST?">
              <p>
                GYST — get your stuff together — is a daily and weekly ritual ledger. Each day you record what moved,
                what got in the way, and the one thing you are committing to next. Each week you read the pattern those
                days made, and decide something about it.
              </p>
              <p>
                It is deliberately not a task manager. Nothing here tracks your work for you. It keeps an honest record
                of what you said you would do and what actually happened, so that the weekly review has something real
                to read.
              </p>
            </FaqItem>
            <FaqItem question="What happens in the daily ritual?">
              <p>
                You score the commitment you made last time, say what moved today, name a blocker if there was one, and
                choose the single commitment you are carrying forward. Optional context is there for the days that need
                it. It is built to take a few minutes.
              </p>
            </FaqItem>
            <FaqItem question="What happens in the weekly review?">
              <p>
                GYST reads only the days you have already committed in the current ISO week and surfaces bounded
                findings — a commitment repeatedly not done, a blocker that keeps recurring, a win you buried, a key
                date approaching. You add observations, set the arrow to up, steady, or down, record the decision in
                your own words, and set up to five dated priorities.
              </p>
              <p>
                Early in the week the view is thin on purpose. On Monday nothing has closed yet, so there is nothing to
                read. The findings fill in as the week does.
              </p>
            </FaqItem>
            <FaqItem question="What does “only you can commit” actually mean?">
              <p>
                A ritual has two states. A <Term>draft</Term> can be edited, re-saved, and rewritten as often as you
                like — by you, or with an agent’s help. A <Term>committed</Term> record is closed and immutable, and it
                is what every later week is read from.
              </p>
              <p>
                Committing is a separate human control on the page, and the boundary is enforced three deep: no commit
                tool exists in the agent surface, a unit test fails the build if one is ever added, and the database
                itself enforces ownership, required fields, atomic close, and post-commit immutability.
              </p>
            </FaqItem>
            <FaqItem question="Do I need an account to look around?">
              <p>
                No. <Term>Open the demo</Term> on the home page signs you in anonymously behind a Cloudflare Turnstile
                check and seeds a private fictional ledger: a full committed prior week, the patterns in it, and today
                left open to conduct.
              </p>
              <p>
                Every visitor gets a separate ledger, so what you commit never changes what the next visitor sees. There
                is no shared demo login. The data is fictional and is generated relative to the current week, so it is
                never stale and is never anyone’s real history.
              </p>
            </FaqItem>
            <FaqItem question="Who can see my ledger?">
              <p>
                Only you. Every table carries row-level security scoped to its owner, with operation-specific policies
                rather than one blanket rule. The agent tools read through the same owner-scoped session your browser is
                already using — there is no shared view, no admin view, and no path from one account to another’s rows.
              </p>
            </FaqItem>
            <FaqItem question="Can I export or delete everything?">
              <p>
                Yes, from <Term>Settings → Account</Term> on a permanent account. You can export the committed ledger as
                portable <Code>gyst-portable-v1</Code> JSON or as readable Markdown, take a full backup that also
                includes drafts, or permanently delete the account, which removes the rows you own and revokes your
                sessions.
              </p>
              <p>
                Export is deliberately not a WebMCP tool. An agent can read the ritual it is helping with; it cannot
                pull your archive.
              </p>
            </FaqItem>
            <FaqItem question="Will GYST email me?">
              <p>
                Only if you ask it to. From <Term>Settings → Schedule</Term> you can turn on daily and weekly reminders
                in your own timezone, and pause or resume them whenever you want. Delivery runs in a small stateless
                worker that can claim and reconcile notification events and nothing else — it has no ability to write to
                your ledger.
              </p>
            </FaqItem>
            <FaqItem question="Do I need an AI agent to use GYST at all?">
              <p>
                No, and that is a design rule rather than a fallback. The ordinary form is the product and stays fully
                usable on its own. WebMCP is progressive enhancement layered on top: if there is no agent in your
                browser, every page still works exactly as it reads.
              </p>
            </FaqItem>
            <FaqItem question="Is GYST open source?">
              <p>
                Yes — AGPL-3.0-only. It is Next.js on Vercel, with Supabase as the only durable ledger and a Cloudflare
                Worker for reminders. <External href={submissionLinks.repository}>Read the source</External>.
              </p>
            </FaqItem>
          </FaqAccordion>
        </section>

        <section aria-labelledby="webmcp-heading" className="mt-16 scroll-mt-8" id="webmcp">
          <h2 className="text-2xl font-semibold tracking-tight" id="webmcp-heading">
            WebMCP
          </h2>
          <p className="mt-2 mb-6 text-muted">{sections[1]?.blurb}</p>
          <FaqAccordion>
            <FaqItem question="What is WebMCP?">
              <p>
                WebMCP lets a website hand a set of typed tools straight to the AI agent running in the browser, instead
                of leaving that agent to infer the page from pixels and clicks. The page registers tools on{" "}
                <Code>document.modelContext</Code>; the agent discovers them, reads each name, description, and input
                schema, and calls them directly.
              </p>
              <p>
                It is a draft standard from the W3C Web Machine Learning Community Group. The accessor moved from{" "}
                <Code>navigator.modelContext</Code> to <Code>document.modelContext</Code> in the 2026-05-27 draft; GYST
                uses the current one.
              </p>
            </FaqItem>
            <FaqItem question="What tools does GYST publish?">
              <p>Twenty-two, and every one of them is read-only or draft-only.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <Term>Three site-wide</Term>, registered before the page hydrates so an agent arriving early can still
                  orient itself: read where it is, open the daily ritual, open the weekly ritual. None of them reveal
                  account or ledger data.
                </li>
                <li>
                  <Term>Seven on the daily ritual</Term> — two read, five draft.
                </li>
                <li>
                  <Term>Seven on the weekly review</Term> — two read, five draft.
                </li>
                <li>
                  <Term>Five on first-run onboarding</Term> — one read, four draft.
                </li>
              </ul>
              <p>
                The ritual tools are scoped to their route and exist only while you are on it. On each ritual page the{" "}
                <Term>WebMCP agent assistance</Term> panel lists exactly what registered in that tab, and labels every
                tool read only or draft only.
              </p>
            </FaqItem>
            <FaqItem question="Why is there no commit tool?">
              <p>
                Because a permission prompt is a confirmation, not a guarantee. Agent clients ask their user to approve
                consequential actions, which helps — but it is enforcement in the wrong place, and it is the place most
                exposed to a prompt-injection attack.
              </p>
              <p>
                GYST removes the capability instead. There is no commit, delete, export, history, or SQL tool in the
                registered surface at all, and a test fails the build if one ever appears. A misbehaving or hijacked
                agent cannot commit your week, because there is nothing for it to call.
              </p>
            </FaqItem>
            <FaqItem question="How much of my ledger can an agent read?">
              <p>
                Only the bounded context for the page it is on: today’s daily context, or the current ISO week. There is
                no arbitrary query, no history walk, and no export. The read tools run under your own session, so a
                signed-out tab returns nothing.
              </p>
            </FaqItem>
            <FaqItem question="How do I know what the agent changed?">
              <p>
                Every field a draft tool touches is marked <Term>Agent updated — review</Term> on the page, and a
                running panel lists each call, which fields it changed, and that it was not committed. Rewrite a field in
                your own words and its marker clears, because that field is yours again.
              </p>
            </FaqItem>
            <FaqItem question="Can the agent put words in my record that I never said?">
              <p>
                It can write a draft — that is the point — so treat the draft as a proposal. The tool descriptions
                instruct it to record only what you stated, and every input is bounded by type, enum, length, and item
                count, with oversized input rejected outright.
              </p>
              <p>
                The real protection is the boundary itself: nothing enters the ledger until you read the draft and
                commit it. The review markers exist so you can see at a glance which words are not yet yours.
              </p>
            </FaqItem>
            <FaqItem question="What if my browser has no WebMCP support?">
              <p>
                The assistance panel says plainly that agent assistance is unavailable in this browser, and the ordinary
                draft form stays fully available. GYST ships no polyfill of its own — it uses the browser’s native
                support where it exists, and degrades cleanly where it does not.
              </p>
            </FaqItem>
          </FaqAccordion>
        </section>

        <section aria-labelledby="submission-heading" className="mt-16 scroll-mt-8" id="submission">
          <h2 className="text-2xl font-semibold tracking-tight" id="submission-heading">
            The challenge submission
          </h2>
          <p className="mt-2 mb-6 text-muted">{sections[2]?.blurb}</p>
          <FaqAccordion>
            <FaqItem question="What was GYST built for?">
              <p>
                The <Term>OpenAI WebMCP Challenge</Term>, hosted on Devpost with Google Chrome, Cloudflare, Shopify,
                Vercel, Render, and Netlify as partners. Submissions closed on 2026-09-03 and judging runs through
                2026-09-21, scored on usefulness, originality, execution, thoughtful use of WebMCP, and the quality of
                the human-agent experience.
              </p>
            </FaqItem>
            <FaqItem question="Where do I find the submission, the code, and the demo video?">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <Term>Source code</Term> —{" "}
                  <External href={submissionLinks.repository}>github.com/knj007/GYST-WebMCP</External>, public and
                  AGPL-3.0-only.
                </li>
                <li>
                  <Term>Live site</Term> — you are on it. Judges need no credentials; use{" "}
                  <Link className="font-medium text-accent underline underline-offset-4" href="/">
                    Open the demo
                  </Link>
                  .
                </li>
                <li>
                  <Term>Devpost entry</Term> —{" "}
                  {submissionLinks.devpostEntry ? (
                    <External href={submissionLinks.devpostEntry}>view the entry</External>
                  ) : (
                    "linked here once the entry is public."
                  )}
                </li>
                <li>
                  <Term>Demo video</Term> —{" "}
                  {submissionLinks.demoVideo ? (
                    <External href={submissionLinks.demoVideo}>watch the walkthrough</External>
                  ) : (
                    "linked here once it is published."
                  )}
                </li>
              </ul>
            </FaqItem>
            <FaqItem question="I am a judge. What is the fastest path in?">
              <p>
                Open the home page in a WebMCP-enabled browser and click <Term>Open the demo</Term>. That signs you in
                anonymously and seeds a fictional ledger belonging only to your session. You land on the daily ritual;
                the weekly review is one click away, and is where the tool surface is most interesting.
              </p>
              <p>
                On that page, expand the assistance panel to see the seven tools, ask the agent to read before it
                writes, then watch the review markers appear as it prepares the draft — and note that it has to ask you
                to commit.
              </p>
            </FaqItem>
            <FaqItem question="Is any of the demo data real?">
              <p>
                None of it. The seeded week belongs to a fictional persona and is generated relative to the current week
                at the moment you open it. No personal history appears in the demo or the video.
              </p>
            </FaqItem>
          </FaqAccordion>
        </section>

        <section aria-labelledby="agents-heading" className="mt-16 scroll-mt-8" id="agents">
          <h2 className="text-2xl font-semibold tracking-tight" id="agents-heading">
            Using GYST with an agent
          </h2>
          <p className="mt-2 mb-6 text-muted">{sections[3]?.blurb}</p>
          <FaqAccordion>
            <FaqItem question="Which browsers and agents can see the tools today?">
              <p>
                WebMCP support is young and moves quickly. This is where it stood when it was last checked, on
                2026-08-31.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <Term>ChatGPT and Codex desktop</Term> — first-class. Site tools require a supporting model tier, and
                  workspaces on Enterprise or Edu plans cannot reach them.
                </li>
                <li>
                  <Term>Chrome and Edge</Term> — native support arrived in Chrome behind Canary and then an origin
                  trial, and ships natively in recent Edge.
                </li>
                <li>
                  <Term>Claude</Term> — no native WebMCP support; the feature request was closed as not planned. A
                  WebMCP bridge extension is the way in — see the next answer.
                </li>
                <li>
                  <Term>Gemini</Term> — no announced WebMCP support.
                </li>
                <li>
                  <Term>Firefox and Safari</Term> — engaged with the standards work, not committed.
                </li>
              </ul>
              <p>
                Whichever you use, the honest test is the page itself: open the daily or weekly ritual and read the
                assistance panel. It reports how many tools actually registered in that tab.
              </p>
            </FaqItem>
            <FaqItem question="How do I use GYST with Claude in Chrome?">
              <p>
                Claude in Chrome drives the page the ordinary way — it reads what is rendered and clicks and types like
                a person would. That works here, because the rituals are ordinary forms. Open the daily or weekly page,
                ask Claude to read the week and fill in the draft, then read it yourself and commit.
              </p>
              <p>
                What you do not get that way is the WebMCP layer: no schema-bounded draft writes, no{" "}
                <Term>Agent updated — review</Term> markers, and no change log, because those are produced by the tools
                rather than by typing into fields.
              </p>
              <p>
                <Term>One caveat worth understanding.</Term> An agent driving your browser is acting as you, so the “no
                commit tool” guarantee does not restrain it — it can press the commit button the same way it presses any
                other. Tell it explicitly to stop at <Term>Save draft</Term> and leave the commit to you. That
                difference is the whole argument for WebMCP: a tool surface can withhold a capability, and a pair of
                hands on your browser cannot.
              </p>
              <p>
                To get the real tool surface with Claude, install a WebMCP bridge extension that exposes{" "}
                <Code>document.modelContext</Code> to the page, then reload the ritual and check the panel count.
              </p>
            </FaqItem>
            <FaqItem question="How do I use GYST with ChatGPT or Codex?">
              <p>This is the path the tools were built for.</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Open GYST in the ChatGPT or Codex in-app browser.</li>
                <li>
                  Sign in, or click <Term>Open the demo</Term>.
                </li>
                <li>Go to the daily or weekly ritual and confirm the panel lists its seven tools.</li>
                <li>Ask the agent to read before it writes, then to prepare the draft.</li>
                <li>Review every marked field, rewrite what is not yours, and commit it yourself.</li>
              </ol>
            </FaqItem>
            <FaqItem question="How do I use GYST with Gemini?">
              <p>
                There is no announced WebMCP support in Gemini, so the tool surface will not appear. The ordinary form
                works fine, and a Gemini agent that drives Chrome for you can conduct the ritual by reading and typing —
                under the same caveat as Claude in Chrome. It can press commit, so tell it to stop at the draft.
              </p>
            </FaqItem>
            <FaqItem question="What should I actually say to the agent?">
              <p>
                The pattern that works is two turns: make it read first, answer the question it cannot answer for
                itself, then let it write. Start with this on the weekly review.
              </p>
              <CopyableText id="faq-prompt-read" label="1. Read before writing" rows={9} text={readFirstPrompt} />
              <p>
                It will come back with the patterns in your week and — the useful part — the one fact it does not have.
                Answer that in your own words, then hand it the second prompt.
              </p>
              <CopyableText id="faq-prompt-prepare" label="2. Prepare the draft, never commit" rows={7} text={prepareDraftPrompt} />
              <p>
                Then read the draft on the page, rewrite anything that does not sound like you, and commit it yourself.
              </p>
            </FaqItem>
            <FaqItem question="No tools are showing up. What should I check?">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Are you on a ritual page? The seven-tool surfaces are scoped to the daily and weekly routes and
                  disappear elsewhere by design.
                </li>
                <li>Are you signed in, or in the demo? The read tools need an owner session.</li>
                <li>Does your browser or agent client support WebMCP at all? See the compatibility answer above.</li>
                <li>On ChatGPT, are you on a model tier and workspace type where site tools are enabled?</li>
                <li>Reload the tab. Registration runs on page load and gives up after a short wait if no agent answers.</li>
                <li>
                  Read the panel text — it distinguishes “unavailable in this browser” from a partial registration, and
                  names the reason.
                </li>
              </ul>
              <p>None of this blocks the ritual. If the tools never appear, fill in the form and commit as normal.</p>
            </FaqItem>
          </FaqAccordion>
        </section>

        <aside className="mt-16 rounded-[1.5rem] border border-line bg-surface p-8">
          <h2 className="text-lg font-semibold tracking-tight">Still unanswered?</h2>
          <p className="mt-2 leading-7 text-muted">
            The repository holds the runbook, the database and deployment notes, and the evidence behind every claim on
            this page.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-full bg-accent px-6 py-3 font-medium text-white" href="/daily">
              Start the daily ritual
            </Link>
            <a
              className="rounded-full border border-line px-6 py-3 font-medium"
              href={submissionLinks.repository}
              rel="noreferrer"
              target="_blank"
            >
              Read the source
            </a>
          </div>
        </aside>
      </main>
    </div>
  );
}
