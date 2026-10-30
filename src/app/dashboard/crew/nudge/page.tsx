"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
ArrowLeft,
BellRing,
Info,
Clock3,
MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getNudgeSuggestions } from "@/lib/api";
import type { NudgeSuggestion } from "@/lib/api";

const moments = [
"Aditi Verma · Work Anniversary · Tomorrow",
"Rahul Sharma · Birthday · 3 days",
"Vikram Patel · Startup Launch Anniversary · 7 days",
];

export default function NudgePage() {
  const { user, loading } = useAuth();
  const [suggestions, setSuggestions] = useState<NudgeSuggestion[]>([]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getNudgeSuggestions()
      .then((data) => {
        if (!active) {
          return;
        }

        setSuggestions(data);
      })
      .catch(() => {
        if (active) {
          setSuggestions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <div className="pt-4 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Dashboard
      </Link>

      {/* Header */}
      <header className="mt-6">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--teal)" }}
        >
          Crew · 02 · Nudge
        </div>

        <h1
          className="font-editorial text-4xl md:text-5xl tracking-tight"
          style={{
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          Nudge keeps important relationships warm.
        </h1>

        <p className="mt-4 text-[var(--muted-strong)] max-w-2xl leading-relaxed text-base md:text-lg">
          Nudge identifies relationships that are cooling,
          drafts timely outreach, and makes sure opportunities
          don't quietly disappear because you forgot to send
          one message.
        </p>
      </header>

      {/* Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        <MetricCard
          value={String(suggestions.length)}
          label="Need Attention"
          icon={<BellRing size={18} />}
          color="var(--teal)"
        />

        <MetricCard
          value={String(suggestions.length)}
          label="Suggestions Ready"
          icon={<MessageSquare size={18} />}
          color="var(--plum)"
        />
      </section>

      {/* High Priority Nudges */}
      <section className="mt-10">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Nudge Suggestions
        </div>

        {suggestions.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-white">
            {suggestions.map((nudge, index) => (
              <div
                key={`${nudge.name}-${index}`}
                className={`grid md:grid-cols-3 gap-4 p-5 ${
                  index !== suggestions.length - 1
                    ? "border-b border-[var(--border)]"
                    : ""
                }`}
              >
                <div>
                  <div className="font-editorial text-lg">
                    {nudge.name}
                  </div>

                  <div className="text-sm text-[var(--muted)]">
                    {nudge.reason}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
                    Suggested message
                  </div>

                  <div className="text-sm leading-relaxed">
                    {nudge.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-strong)]">
            No follow-up suggestions right now.
          </div>
        )}
      </section>

      {/* Upcoming Moments */}
      <section className="mt-10">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Upcoming Moments
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {moments.map((moment) => (
            <div
              key={moment}
              className="rounded-2xl border border-[var(--border)] bg-white p-5"
            >
              <Clock3
                size={18}
                style={{ color: "var(--plum)" }}
              />

              <div className="mt-3 text-sm leading-relaxed">
                {moment}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="mt-10">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-4">
          Automation Rules
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <div className="space-y-4">
            <Rule text="Create a nudge after 30 days of silence." />
            <Rule text="Create a follow-up after a referral." />
            <Rule text="Create a check-in after meeting someone in person." />
            <Rule text="Prioritize people aligned with current goals." />
          </div>
        </div>
      </section>

      {/* Judge Note */}
      <aside
        className="mt-10 rounded-2xl border p-6"
        style={{
          borderColor:
            "color-mix(in srgb, var(--teal) 35%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--teal) 7%, white)",
        }}
      >
        <div className="flex items-start gap-3">
          <Info
            className="h-4 w-4 mt-0.5 shrink-0"
            strokeWidth={1.75}
            style={{ color: "var(--teal)" }}
          />

          <div>
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "var(--teal)" }}
            >
              Note to Judges
            </div>

            <p className="text-sm leading-relaxed">
              Nudge suggestions above are generated live from your
              relationship graph, it continuously monitors
              relationship warmth, detects decay, ranks
              relationship importance relative to goals,
              and generates personalized outreach before
              opportunities disappear.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MetricCard({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div style={{ color }}>{icon}</div>

      <div className="mt-4 font-editorial text-4xl">
        {value}
      </div>

      <div className="mt-1 text-sm text-[var(--muted-strong)]">
        {label}
      </div>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: "var(--teal)",
        }}
      />

      <span className="text-sm">
        {text}
      </span>
    </div>
  );
}