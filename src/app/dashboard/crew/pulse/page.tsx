"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  MessageCircle,
  Mail,
  ScanLine,
  AtSign,
  Users,
} from "lucide-react";
import { CREW, type Channel } from "@/lib/fixtures";
import { useAuth } from "@/context/AuthContext";
import {
  getPulseDashboard,
  getPulseRecentlyActive,
  getDashboardActivity,
} from "@/lib/api";
import type {
  PulseDashboard,
  RecentlyActiveContact,
  ActivityEntry,
} from "@/lib/api";

// ─── Pulse (/dashboard/crew/pulse) ─────────────────────────────────────────
//
// Pulse is your network's vital signs — real signal, not a fake DM inbox.
// Two things live here that nowhere else in the app shows:
//
//   1. Recently active — contacts sorted by real last-contact recency
//      (r.lastContact, driven by actual Telegram message timestamps for
//      Telegram contacts). Different axis from Lead-O-Meter (sorted by
//      warmth) and Nudge (sorted by who's cooling).
//
//   2. The full activity feed — every logged Crew action, unsliced
//      (the Dashboard home page only shows a 4-item preview).

const CHANNEL_ICON: Record<Channel, typeof Mail> = {
  email: Mail,
  telegram: MessageCircle,
  linkedin: ScanLine,
  card: ScanLine,
  social: AtSign,
};

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Gmail",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  card: "Card",
  social: "Social",
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

export default function PulsePage() {
  const crew = CREW.social;
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<PulseDashboard | null>(null);
  const [recentlyActive, setRecentlyActive] = useState<RecentlyActiveContact[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getPulseDashboard()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      });

    getPulseRecentlyActive()
      .then((data) => {
        if (active) setRecentlyActive(data);
      })
      .catch(() => {
        if (active) setRecentlyActive([]);
      });

    getDashboardActivity()
      .then((data) => {
        if (active) setActivity(data);
      })
      .catch(() => {
        if (active) setActivity([]);
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <div className="pt-4 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Dashboard
      </Link>

      <header className="anim-fade-up">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: crew.color }}
        >
          Crew · 04 · Pulse
        </div>
        <h1
          className="font-editorial text-4xl md:text-5xl tracking-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.025em" }}
        >
          Pulse tracks who&apos;s really in touch.
        </h1>
        <p className="mt-4 text-[var(--muted-strong)] max-w-2xl leading-relaxed text-base md:text-lg">
          Real signal, not vanity connections: recency of contact, message
          volume, and your network&apos;s live health score. Everything
          here is computed from your actual graph, no fake integrations.
        </p>
      </header>

      {/* Network pulse stats */}
      {stats ? (
        <section className="anim-fade-up" style={{ animationDelay: "0.02s" }}>
          <div
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: crew.color }}
          >
            Network pulse · {stats.networkHealth}/100
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Relationships", value: stats.people },
              { label: "Companies", value: stats.companies },
              { label: "AI Builders", value: stats.aiBuilders },
              { label: "Founders", value: stats.founders },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: `color-mix(in srgb, ${crew.color} 25%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${crew.color} 5%, white)`,
                }}
              >
                <div
                  className="font-editorial text-3xl"
                  style={{ color: crew.color, fontWeight: 800 }}
                >
                  {stat.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Recently active */}
      <section className="anim-fade-up" style={{ animationDelay: "0.06s" }}>
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              backgroundColor: `color-mix(in srgb, ${crew.color} 14%, white)`,
              color: crew.color,
            }}
          >
            <Activity className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-1"
              style={{ color: crew.color }}
            >
              Recently active
            </div>
            <h2
              className="font-editorial text-xl md:text-2xl tracking-tight leading-tight"
              style={{ fontWeight: 700 }}
            >
              Who&apos;s actually talking to you right now.
            </h2>
            <p className="mt-1.5 text-sm text-[var(--muted-strong)] leading-relaxed max-w-2xl">
              Sorted by real last-contact recency, not warmth score, not
              who&apos;s cooling off. Just who you&apos;ve actually been in
              touch with lately.
            </p>
          </div>
        </div>

        {recentlyActive.length > 0 ? (
          <div className="space-y-3">
            {recentlyActive.map((c) => {
              const channel = c.channel as Channel;
              const ChannelIcon = CHANNEL_ICON[channel] ?? Mail;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[var(--border)] p-4 flex items-center gap-3"
                >
                  <div
                    className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-mono text-xs"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${crew.color} 14%, white)`,
                      color: crew.color,
                    }}
                  >
                    {c.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-sm text-[var(--muted-strong)] truncate">
                      {c.title ? `${c.title} · ` : ""}
                      {c.company}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--muted)]">
                    <ChannelIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {CHANNEL_LABEL[channel] ?? channel}
                  </div>
                  {channel === "telegram" && c.telegram_message_count > 0 ? (
                    <div
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${crew.color} 12%, white)`,
                        color: crew.color,
                      }}
                    >
                      {c.telegram_message_count} messages
                    </div>
                  ) : null}
                  <div className="font-mono text-xs text-[var(--muted)] whitespace-nowrap">
                    {formatRelative(c.last_contact)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-strong)]">
            No recent contact activity yet.
          </p>
        )}
      </section>

      {/* Full activity feed */}
      <section className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              backgroundColor: `color-mix(in srgb, ${crew.color} 14%, white)`,
              color: crew.color,
            }}
          >
            <Users className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-1"
              style={{ color: crew.color }}
            >
              Full activity log
            </div>
            <h2
              className="font-editorial text-xl md:text-2xl tracking-tight leading-tight"
              style={{ fontWeight: 700 }}
            >
              Every logged Crew action, unfiltered.
            </h2>
            <p className="mt-1.5 text-sm text-[var(--muted-strong)] leading-relaxed max-w-2xl">
              The Dashboard home page only shows a short preview, this is
              the full feed behind it.
            </p>
          </div>
        </div>

        {activity.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] divide-y divide-[var(--hairline)]">
            {activity.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{entry.action}</div>
                  <div className="text-sm text-[var(--muted-strong)] truncate">
                    {entry.detail}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--muted) 10%, white)",
                      color: "var(--muted-strong)",
                    }}
                  >
                    {entry.crew}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)] whitespace-nowrap">
                    {formatRelative(entry.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-strong)]">
            No activity logged yet.
          </p>
        )}
      </section>
    </div>
  );
}
