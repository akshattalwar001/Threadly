"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Check,
  X as XIcon,
  Inbox,
  Send,
  Info,
  Sparkles,
  Loader2,
} from "lucide-react";
import { CREW } from "@/lib/fixtures";
import { useAuth } from "@/context/AuthContext";
import { getDashboardDrafts } from "@/lib/api";
import type { Draft } from "@/lib/api";

/**
 * Mailbox (/app/inbound) — cold-email qualification + retro-import shell.
 *
 * Pattern mirrors Messenger: header + connection state + rule matrix +
 * live classification card, sourced from the real drafts queue filtered
 * to the inbound (Mailbox) crew.
 */

const icpRules = [
  {
    id: "r1",
    label: "Operator at a Series A/B tech company",
    delta: 6,
    active: true,
  },
  {
    id: "r2",
    label: "Journalist or analyst from a known outlet",
    delta: 4,
    active: true,
  },
  {
    id: "r3",
    label: "Founder-to-founder reach-out with mutual connection",
    delta: 5,
    active: true,
  },
  { id: "r4", label: "Recruiter for a role not my function", delta: -4, active: true },
  { id: "r5", label: "Generic sales demo · no personalisation", delta: -6, active: true },
  {
    id: "r6",
    label: "Mentions a specific thing I wrote or built",
    delta: 5,
    active: true,
  },
];

type InboundExample = {
  id: string;
  from: string;
  company: string;
  subject: string;
  snippet: string;
  verdict: "qualified" | "decline" | "auto_dismiss";
  reasoning: string;
  draft: string | null;
  sentAt: string;
};

function formatRelative(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const now = Date.now();
  const hours = Math.max(0, Math.floor((now - then) / (1000 * 60 * 60)));
  if (hours < 1) return "moments ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// Canned inbound examples for the "Simulate" demo — used whenever the
// account has no real classified inbound yet (i.e. always, right now,
// since the live Gmail retro-import/webhook pipeline isn't wired up).
// Kept separate from `stats`, which only ever reflects real drafts.
const CANNED_EXAMPLES: InboundExample[] = [
  {
    id: "canned-1",
    from: "Priya Nair",
    company: "Series B fintech (stealth)",
    subject: "Quick intro, building payments infra, loved your post",
    snippet:
      "Hey! I'm an operator at a Series B fintech building payments infra. Read your thread on relationship graphs and would love 15 min to compare notes on GTM.",
    verdict: "qualified",
    reasoning:
      "Operator at a Series A/B tech company (+6), mentions a specific thing I wrote (+5). Net +11, clears the qualify threshold.",
    draft:
      "Hey Priya, appreciate you reading the thread! Happy to do 15 min, Thursday or Friday afternoon both work. Sending a cal link.",
    sentAt: "2h ago",
  },
  {
    id: "canned-2",
    from: "Marcus Webb",
    company: "TalentBridge Recruiting",
    subject: "Exciting Backend Engineer role, 250k+equity",
    snippet:
      "I'm reaching out about a Staff Backend Engineer opening at a stealth startup. Your background looked like a great fit!",
    verdict: "decline",
    reasoning:
      "Recruiter for a role not my function (-4). No offsetting signal. Net negative, polite decline, no meeting.",
    draft:
      "Thanks for reaching out, Marcus. Not the right fit for me right now, but I'll keep it in mind if that changes.",
    sentAt: "5h ago",
  },
  {
    id: "canned-3",
    from: "Sales Bot",
    company: "GrowthStack CRM",
    subject: "See how GrowthStack 10x's your pipeline",
    snippet:
      "Hi there, I wanted to reach out to see if you'd be interested in a demo of our AI-powered CRM platform...",
    verdict: "auto_dismiss",
    reasoning:
      "Generic sales demo, no personalization (-6). No positive signals present. Auto-dismissed, no draft.",
    draft: null,
    sentAt: "1d ago",
  },
  {
    id: "canned-4",
    from: "Dana Osei",
    company: "TechCrunch",
    subject: "Quick quote for a piece on relationship AI?",
    snippet:
      "I'm a reporter at TechCrunch working on a piece about relationship-intelligence tools. Would love a quick quote if you have 10 minutes.",
    verdict: "qualified",
    reasoning:
      "Journalist from a known outlet (+4), mentions a specific thing I built (+5). Net +9, qualifies.",
    draft:
      "Hi Dana, happy to help, this sounds like a fun piece. I've got 10 min Tuesday or Wednesday, whichever's easier for you.",
    sentAt: "1d ago",
  },
  {
    id: "canned-5",
    from: "Jonah Ruiz",
    company: "Loop Health (Seed)",
    subject: "Founder to founder, mutual friend suggested I reach out",
    snippet:
      "Hey, Sarah Kim mentioned we should connect, we're both building in health-tech infra. Would love to trade notes sometime.",
    verdict: "qualified",
    reasoning:
      "Founder-to-founder reach-out with mutual connection (+5). Net +5, clears the qualify threshold.",
    draft:
      "Hi Jonah, always good to meet through Sarah! Free next week for a quick call, whatever timezone works for you.",
    sentAt: "2d ago",
  },
];

function draftToExample(d: Draft): InboundExample {
  return {
    id: d.id,
    from: d.contact,
    company: d.company,
    subject: d.inbound_text ? d.inbound_text.slice(0, 72) : `Inbound from ${d.contact}`,
    snippet: d.inbound_text ?? "",
    verdict: d.draft ? "qualified" : "auto_dismiss",
    reasoning: d.reasoning,
    draft: d.draft || null,
    sentAt: formatRelative(d.inbound_timestamp),
  };
}

export default function InboundPage() {
  const crew = CREW.inbound;
  const { user, loading } = useAuth();
  // Real inbound drafts only — drives the "Live" Gmail stats up top.
  const [liveExamples, setLiveExamples] = useState<InboundExample[]>([]);
  // Real drafts (if any) + canned fallback — drives the Simulate demo,
  // so it always has something to cycle through even on a fresh account.
  const [examples, setExamples] = useState<InboundExample[]>(CANNED_EXAMPLES);
  const [selectedId, setSelectedId] = useState<string>(
    CANNED_EXAMPLES[0]?.id ?? "",
  );
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getDashboardDrafts()
      .then((data) => {
        if (!active) {
          return;
        }

        const inboundExamples = data
          .filter((d) => d.crew === "inbound")
          .map(draftToExample);

        setLiveExamples(inboundExamples);

        const combined = [...inboundExamples, ...CANNED_EXAMPLES];
        setExamples(combined);
        setSelectedId(combined[0]?.id ?? "");
      })
      .catch(() => {
        if (active) {
          setLiveExamples([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  const selected = examples.find((e) => e.id === selectedId) ?? examples[0] ?? null;

  async function runSimulate() {
    if (examples.length < 2) return;
    setSimulating(true);
    // Purely decorative — cycles to a different example (real or canned).
    await new Promise((r) => setTimeout(r, 1200));
    const others = examples.filter((e) => e.id !== selectedId);
    setSelectedId(others[Math.floor(Math.random() * others.length)].id);
    setSimulating(false);
  }

  const stats = {
    qualified: liveExamples.filter((e) => e.verdict === "qualified").length,
    declined: liveExamples.filter((e) => e.verdict === "decline").length,
    dismissed: liveExamples.filter((e) => e.verdict === "auto_dismiss").length,
  };

  return (
    <div className="pt-4 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Dashboard
      </Link>

      {/* Header */}
      <header className="anim-fade-up">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: crew.color }}
        >
          Crew · 03 · Gatekeeper · Mailbox
        </div>
        <h1
          className="font-editorial text-4xl md:text-5xl tracking-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.025em" }}
        >
          Gatekeeper qualifies cold emails.
        </h1>
        <p className="mt-4 text-[var(--muted-strong)] max-w-2xl leading-relaxed text-base md:text-lg">
          {crew.role} Runs every cold inbound against your ICP rules. Drafts a
          warm &apos;yes&apos; for the good ones, a polite &apos;no&apos; for the mis-matches,
          auto-dismisses the obvious spam. Never auto-books a meeting, your
          time stays yours.
        </p>
      </header>

      {/* Gmail connection + stats */}
      <section
        className="grid grid-cols-1 md:grid-cols-3 gap-3 anim-fade-up"
        style={{ animationDelay: "0.06s" }}
      >
        <div
          className="rounded-2xl border p-5 flex items-center gap-3"
          style={{
            borderColor: `color-mix(in srgb, ${crew.color} 30%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${crew.color} 6%, white)`,
          }}
        >
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `color-mix(in srgb, ${crew.color} 18%, white)`,
              color: crew.color,
            }}
          >
            <Mail className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div
              className="font-editorial text-base tracking-tight"
              style={{ fontWeight: 700 }}
            >
              Gmail
            </div>
            <div className="font-mono text-[11px] text-[var(--muted)] truncate">
              fred@collecter.club · connected
            </div>
          </div>
          <div
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white shrink-0"
            style={{ backgroundColor: "var(--sage)" }}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
            Live
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 grid grid-cols-3 gap-2">
          <Stat label="Qualified" value={stats.qualified} color={crew.color} />
          <Stat
            label="Declined"
            value={stats.declined}
            color="var(--muted-strong)"
          />
          <Stat
            label="Dismissed"
            value={stats.dismissed}
            color="var(--muted)"
          />
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: `color-mix(in srgb, var(--gold) 30%, transparent)`,
            backgroundColor: `color-mix(in srgb, var(--gold) 6%, white)`,
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
            style={{ color: "var(--gold)" }}
          >
            Retro-import
          </div>
          <div className="font-mono text-xs text-[var(--muted-strong)] leading-relaxed">
            90 days of Gmail history · 1,247 threads scanned · 34 contacts
            re-classified · 12 Warmth adjustments
          </div>
        </div>
      </section>

      {/* ICP rules */}
      <section
        className="rounded-2xl border bg-[var(--surface)] overflow-hidden anim-fade-up"
        style={{
          animationDelay: "0.1s",
          borderColor: `color-mix(in srgb, ${crew.color} 25%, transparent)`,
        }}
      >
        <header
          className="px-5 md:px-6 py-4 border-b"
          style={{
            borderColor: `color-mix(in srgb, ${crew.color} 18%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${crew.color} 5%, white)`,
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5"
            style={{ color: crew.color }}
          >
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            Your ICP rules · {icpRules.length} active
          </div>
          <div
            className="font-editorial text-lg tracking-tight"
            style={{ fontWeight: 700 }}
          >
            What counts as a good inbound.
          </div>
        </header>
        <ul className="divide-y divide-[var(--hairline)]">
          {icpRules.map((r) => {
            const pos = r.delta > 0;
            return (
              <li
                key={r.id}
                className="px-5 md:px-6 py-3 flex items-center gap-3"
              >
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: pos
                      ? `color-mix(in srgb, var(--warmth-hot) 14%, white)`
                      : `color-mix(in srgb, var(--warmth-cold) 14%, white)`,
                    color: pos
                      ? "var(--warmth-hot)"
                      : "var(--warmth-cold)",
                  }}
                >
                  {pos ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <XIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  )}
                </div>
                <span className="flex-1 text-sm text-[var(--foreground)] leading-snug">
                  {r.label}
                </span>
                <span
                  className="font-mono text-xs tabular-nums px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: pos
                      ? `color-mix(in srgb, var(--warmth-hot) 12%, white)`
                      : `color-mix(in srgb, var(--warmth-cold) 12%, white)`,
                    color: pos
                      ? "var(--warmth-hot)"
                      : "var(--warmth-cold)",
                  }}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Last classification card with Simulate */}
      <section
        className="rounded-2xl border bg-[var(--surface)] p-5 md:p-6 anim-fade-up"
        style={{
          animationDelay: "0.14s",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-6 pb-6 border-b border-[var(--hairline)]">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
            style={{ color: crew.color }}
          >
            Demo · Simulate an inbound
          </div>
          <h3
            className="font-editorial text-xl md:text-2xl tracking-tight leading-tight mb-2"
            style={{ fontWeight: 700 }}
          >
            Fire a cold inbound → watch Mailbox classify + draft.
          </h3>
          <p className="text-sm text-[var(--muted-strong)] leading-relaxed mb-4 max-w-xl">
            Pick any canned inbound below, or hit <strong>Simulate</strong> to
            cycle to a random example. Mailbox runs it against your ICP rules,
            renders a verdict + drafted reply.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={runSimulate}
              disabled={simulating}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: crew.color }}
            >
              {simulating ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              )}
              Simulate a random inbound
            </button>
            {examples.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  e.id === selectedId
                    ? "text-white"
                    : "text-[var(--muted-strong)] hover:text-[var(--foreground)]"
                }`}
                style={
                  e.id === selectedId
                    ? { backgroundColor: crew.color, borderColor: crew.color }
                    : { borderColor: "var(--border)" }
                }
              >
                {e.from.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Email card */}
        {selected ? (
          <InboundCard example={selected} accentColor={crew.color} />
        ) : (
          <p className="text-sm text-[var(--muted-strong)]">
            No inbound drafts in the queue right now.
          </p>
        )}
      </section>

      {/* Roadmap note */}
      <aside
        className="rounded-2xl border p-4 md:p-5 anim-fade-up"
        style={{
          animationDelay: "0.18s",
          borderColor: "color-mix(in srgb, var(--warmth-hot) 35%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--warmth-hot) 7%, white)",
        }}
      >
        <div className="flex items-start gap-3">
          <Info
            className="h-4 w-4 mt-0.5 shrink-0"
            strokeWidth={1.75}
            style={{ color: "var(--warmth-hot)" }}
          />
          <div className="min-w-0">
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "var(--warmth-hot)" }}
            >
              How this works
            </div>
            <p className="text-sm text-[var(--foreground)] leading-relaxed">
              Mailbox here is wired to your live drafts queue. The full path
              uses Composio&apos;s Gmail API to (1) retro-import the last 90
              days of threads and classify against these ICP rules, (2) watch
              the inbox in real time via webhook and fire a draft into
              Morning Connect when a good-fit lands. Both are built on the
              same Composio pipeline Scanner and Scribe already use.
            </p>
            <div className="mt-3 font-editorial text-sm text-[var(--muted-strong)] italic">
              - Freddy
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        className="font-editorial text-2xl md:text-3xl tabular-nums"
        style={{ fontWeight: 800, color }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function InboundCard({
  example,
  accentColor,
}: {
  example: InboundExample;
  accentColor: string;
}) {
  const verdictConfig = {
    qualified: {
      label: "Qualified · draft staged",
      color: "var(--sage)",
      icon: Check,
    },
    decline: {
      label: "Polite decline drafted",
      color: "var(--muted-strong)",
      icon: XIcon,
    },
    auto_dismiss: {
      label: "Auto-dismissed, no draft",
      color: "var(--muted)",
      icon: Inbox,
    },
  }[example.verdict];
  const VerdictIcon = verdictConfig.icon;

  return (
    <div className="space-y-4">
      {/* Email header */}
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: `color-mix(in srgb, ${verdictConfig.color} 28%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${verdictConfig.color} 4%, white)`,
        }}
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white"
            style={{ backgroundColor: verdictConfig.color }}
          >
            <VerdictIcon className="h-3 w-3" strokeWidth={2.5} />
            {verdictConfig.label}
          </span>
          <span className="font-mono text-[10px] text-[var(--muted)] ml-auto">
            {example.sentAt}
          </span>
        </div>
        <div className="font-editorial text-base md:text-lg leading-snug tracking-tight mt-2">
          {example.subject}
        </div>
        <div className="font-mono text-[11px] text-[var(--muted-strong)] mt-1">
          From · {example.from} · {example.company}
        </div>
        <blockquote
          className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)] border-l-2 pl-3"
          style={{
            borderColor: `color-mix(in srgb, ${verdictConfig.color} 40%, transparent)`,
          }}
        >
          &ldquo;{example.snippet}&rdquo;
        </blockquote>
      </div>

      {/* Reasoning */}
      <div>
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-1.5"
          style={{ color: accentColor }}
        >
          Mailbox reasoning
        </div>
        <p className="text-sm text-[var(--foreground)] leading-relaxed">
          {example.reasoning}
        </p>
      </div>

      {/* Drafted reply (if any) */}
      {example.draft ? (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${accentColor} 6%, white)`,
          }}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div
              className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: accentColor }}
            >
              <Send className="h-3 w-3" strokeWidth={2} />
              Drafted reply · staged for Morning Connect
            </div>
            <Link
              href="/dashboard"
              className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Review in Morning Connect →
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
            {example.draft}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/40 p-4 font-mono text-[11px] text-[var(--muted)] leading-relaxed">
          No draft. Auto-dismissed inbounds don&apos;t consume your attention.
        </div>
      )}
    </div>
  );
}
