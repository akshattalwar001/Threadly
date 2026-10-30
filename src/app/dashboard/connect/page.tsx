"use client";

import { useState } from "react";
import {
  Send,
  Sparkles,
  ArrowRight,
  Users,
  Target,
  MessageSquare,
  Bot,
} from "lucide-react";

import { askChief as askChiefApi } from "@/lib/api";
import type { ChiefAnswer } from "@/lib/api";

const suggestedPrompts = [
  "Who should I reconnect with this week?",
  "Who can help me become an AI Security Engineer?",
  "Which connections are going cold?",
  "Who can introduce me to recruiters at Google?",
];

const opportunities = [
  {
    title: "AI Research Mentor",
    path: "Warm path through IoSC network",
    score: 92,
  },
  {
    title: "Google STEP Recruiter",
    path: "2nd degree connection",
    score: 87,
  },
  {
    title: "Cybersecurity Founder",
    path: "Mutual connection available",
    score: 84,
  },
];

const recommendedActions = [
  {
    name: "Rahul Sharma",
    reason: "No interaction in 73 days",
    draft:
      "Hey Rahul, it's been a while. Would love to catch up and hear what you've been working on lately.",
  },
  {
    name: "Aditi Verma",
    reason: "Strong AI network overlap",
    draft:
      "Hi Aditi, I noticed we're both exploring AI security. Would love to connect and exchange ideas.",
  },
];

const crewSignals = [
  {
    name: "Snap",
    value: "2 new contacts captured",
    color: "var(--terracotta)",
  },
  {
    name: "Nudge",
    value: "3 follow-ups suggested",
    color: "var(--teal)",
  },
  {
    name: "Pulse",
    value: "1 relationship cooling",
    color: "var(--indigo)",
  },
  {
    name: "Recall",
    value: "5 memories surfaced",
    color: "var(--plum)",
  },
];

export default function ConnectPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<ChiefAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const askChief = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setAnswer(null);
    setError(null);

    try {
      const result = await askChiefApi(query);
      setAnswer(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Chief couldn't reach the graph.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 paper-grain min-h-screen">
      {/* Hero */}
      <section className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-4">
          Relationship Intelligence
        </div>

        <h1
          className="font-editorial text-5xl md:text-7xl leading-[0.9]"
          style={{
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          Connect
        </h1>

        <p className="mt-5 max-w-2xl text-[var(--muted-strong)] leading-relaxed">
          Ask Chief questions about your network, opportunities,
          introductions, relationships and next best actions.
        </p>
      </section>

      {/* Chief */}
      <section className="mb-10">
        <div
          className="rounded-3xl overflow-hidden border"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(135deg,var(--plum),color-mix(in srgb,var(--plum) 75%, black))",
          }}
        >
          <div className="p-8 md:p-10">
            <div className="flex items-center gap-2 mb-3 text-white/80">
              <Bot size={18} />
              <span className="font-mono text-[10px] uppercase tracking-widest">
                Chief
              </span>
            </div>

            <h2
              className="font-editorial text-4xl md:text-5xl text-white"
              style={{
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              Ask the graph
            </h2>

            <p className="mt-4 text-white/75 max-w-xl">
              Who should you meet next? Which relationship
              matters most? Where is the fastest path to your goal?
            </p>

            <div className="mt-8 flex flex-col md:flex-row gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Who can help me become an AI Security Engineer?"
                className="flex-1 rounded-2xl px-5 py-4 bg-white/10 text-white placeholder:text-white/40 border border-white/10 outline-none"
              />

              <button
                onClick={askChief}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-[var(--ink)] px-6 py-4 font-medium"
              >
                {loading ? (
                  <>
                    <Sparkles size={18} />
                    Thinking
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Ask Chief
                  </>
                )}
              </button>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl bg-white/10 border border-white/10 p-4 text-white/90">
                {error}
              </div>
            ) : null}

            {answer ? (
              <div className="mt-6 rounded-2xl bg-white/10 border border-white/10 p-4 text-white/90">
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2">
                  Chief answer
                </div>
                <ChiefAnswerView answer={answer} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Suggested Prompts */}
      <section className="mb-12">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Suggested Questions
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setQuery(prompt)}
              className="text-left rounded-2xl border p-4 hover:bg-[var(--paper)] transition-colors"
              style={{
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span>{prompt}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Analytics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="rounded-2xl border p-6 bg-white">
          <Target
            size={20}
            style={{ color: "var(--terracotta)" }}
          />

          <div className="mt-4 font-editorial text-5xl">
            14
          </div>

          <div className="mt-1 text-sm text-[var(--muted-strong)]">
            High-value opportunities
          </div>
        </div>

        <div className="rounded-2xl border p-6 bg-white">
          <Users
            size={20}
            style={{ color: "var(--teal)" }}
          />

          <div className="mt-4 font-editorial text-5xl">
            126
          </div>

          <div className="mt-1 text-sm text-[var(--muted-strong)]">
            Warm relationships
          </div>
        </div>

        <div className="rounded-2xl border p-6 bg-white">
          <MessageSquare
            size={20}
            style={{ color: "var(--plum)" }}
          />

          <div className="mt-4 font-editorial text-5xl">
            8
          </div>

          <div className="mt-1 text-sm text-[var(--muted-strong)]">
            Suggested conversations
          </div>
        </div>
      </section>

      {/* Opportunities */}
      <section className="mb-12">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Top Opportunities
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {opportunities.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border p-5 bg-white"
            >
              <div className="font-editorial text-xl">
                {item.title}
              </div>

              <div className="mt-2 text-sm text-[var(--muted-strong)]">
                {item.path}
              </div>

              <div
                className="mt-4 inline-flex rounded-full px-3 py-1 text-xs"
                style={{
                  background:
                    "color-mix(in srgb,var(--terracotta) 12%, white)",
                  color: "var(--terracotta)",
                }}
              >
                Match {item.score}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended Outreach */}
      <section className="mb-12">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Recommended Outreach
        </div>

        <div className="space-y-4">
          {recommendedActions.map((action) => (
            <div
              key={action.name}
              className="rounded-2xl border bg-white p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-editorial text-xl">
                  {action.name}
                </div>

                <div className="text-xs text-[var(--muted)]">
                  {action.reason}
                </div>
              </div>

              <div className="rounded-xl bg-[var(--paper)] p-4 text-sm leading-relaxed">
                {action.draft}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Crew Activity */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Crew Activity
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {crewSignals.map((crew) => (
            <div
              key={crew.name}
              className="rounded-2xl p-5 text-white"
              style={{
                backgroundColor: crew.color,
              }}
            >
              <div className="font-editorial text-2xl">
                {crew.name}
              </div>

              <div className="mt-2 text-white/80 text-sm">
                {crew.value}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChiefAnswerView({ answer }: { answer: ChiefAnswer }) {
  return (
    <div className="space-y-4 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
      <div>{answer.text}</div>

      {answer.cards && answer.cards.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
          {answer.cards.map((card) => (
            <div
              key={`${card.name}-${card.company}`}
              className="rounded-2xl bg-white/10 border border-white/10 p-4"
            >
              <div className="font-editorial text-lg text-white">
                {card.name}
              </div>
              <div className="mt-1 text-white/70 text-sm">
                {card.role}
              </div>
              <div className="mt-0.5 text-white/55 text-xs uppercase tracking-widest">
                {card.company}
              </div>
              <div className="mt-4 text-white/90 text-sm leading-relaxed">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-white/55 mb-1">
                  Reason
                </span>
                {card.reason}
              </div>
              <div className="mt-3 text-white/90 text-sm leading-relaxed">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-white/55 mb-1">
                  Potential
                </span>
                {card.potential}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
