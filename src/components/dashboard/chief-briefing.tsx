"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getDashboardAnalytics } from "@/lib/api";
import type { Analytics } from "@/lib/api";

function getGreeting(hour: number) {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function ChiefBriefing() {
  const { user, loading } = useAuth();
  const greetingName = user?.displayName?.split(" ")[0] ?? "there";
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [greeting, setGreeting] = useState("Good Day");

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getDashboardAnalytics()
      .then((data) => {
        if (!active) {
          return;
        }

        setAnalytics(data);
      })
      .catch(() => {
        if (active) {
          setAnalytics(null);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <section className="mb-10 rounded-3xl overflow-hidden border border-[var(--border)] shadow-sm">
      <div
        className="p-8 md:p-12"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--plum) 14%, white) 0%, color-mix(in srgb, var(--indigo) 12%, white) 100%)",
        }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-4"
          style={{ color: "var(--plum)" }}
        >
          Chief's Briefing
        </div>

        <h1
          className="font-editorial leading-[0.95] tracking-tight text-[var(--ink)]"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 700,
          }}
        >
          {greeting}, {greetingName}.
        </h1>

        <p className="mt-5 max-w-2xl text-[var(--muted-strong)] leading-relaxed text-lg">
          {analytics
            ? `You have ${analytics.summary.total_graph} people in your graph, with ${analytics.summary.active_conversations} active conversations right now.`
            : "Your Crew is watching your network for the next opportunity to reconnect."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="rounded-full px-4 py-2 bg-white/80 border border-[var(--border)]">
            <span className="font-mono text-xs uppercase tracking-widest">
              Network Strength · {analytics ? `${Math.round(analytics.summary.avg_warmth)}/100` : "--"}
            </span>
          </div>

          <div className="rounded-full px-4 py-2 bg-white/80 border border-[var(--border)]">
            <span className="font-mono text-xs uppercase tracking-widest">
              Dormant · {analytics ? analytics.summary.dormant : "--"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}