"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Mail,
  MessageCircle,
  ScanLine,
  AtSign,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { CREW, type Channel } from "@/lib/fixtures";
import { useAuth } from "@/context/AuthContext";
import { getDashboardAnalytics } from "@/lib/api";
import type { Analytics } from "@/lib/api";
import { WarmthBar } from "@/components/warmth-bar";

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

const PAGE_SIZE = 12;

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthLabel(ym: string) {
  // ym is "YYYY-MM"
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  const date = new Date(year, month - 1, 1);
  return MONTH_FORMATTER.format(date);
}

const CHANNEL_COLOR: Record<Channel, string> = {
  email: "var(--coral)",
  telegram: "var(--teal)",
  linkedin: "var(--indigo)",
  card: "var(--copper)",
  social: "var(--plum)",
};

export default function AnalyticsContactsPage() {
  const { user, loading } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

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

  const s = analytics?.summary;
  const growth = useMemo(() => analytics?.growth ?? [], [analytics]);
  const channelShare = useMemo(() => analytics?.channel_share ?? [], [analytics]);
  const topActive = useMemo(() => analytics?.top_active ?? [], [analytics]);

  const newThisMonth = growth.length > 0 ? growth[growth.length - 1].new_contacts : 0;
  const newLastMonth = growth.length > 1 ? growth[growth.length - 2].new_contacts : 0;
  const deltaPct = newLastMonth > 0
    ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
    : undefined;

  const chartData = useMemo(
    () => growth.map((g) => ({ ...g, month: monthLabel(g.month) })),
    [growth],
  );

  const crewBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of topActive) {
      counts.set(c.last_crew, (counts.get(c.last_crew) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([crew, count]) => ({ crew, count }));
  }, [topActive]);
  const maxCrew = Math.max(1, ...crewBreakdown.map((c) => c.count));

  const totalChannel = channelShare.reduce((a, c) => a + c.count, 0);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleContacts = topActive.slice(0, visibleCount);
  const hasMore = visibleCount < topActive.length;
  const remaining = topActive.length - visibleCount;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      {/* Header */}
      <header className="mb-10">
        <div className="pt-4 pl-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3">
          Analytics
        </div>
        <h1
          className="font-editorial text-4xl md:text-5xl lg:text-6xl leading-[0.95] tracking-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.03em" }}
        >
          How your Crew is working{" "}
          <span style={{ color: "var(--copper)" }}>your network</span>.
        </h1>
        <p className="mt-4 text-base md:text-lg text-[var(--muted-strong)] leading-relaxed max-w-2xl">
          Every contact captured, every message classified, every draft shipped.
          Across every Crew, since you started.
        </p>
      </header>

      {/* Hero stats — three big numbers */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <HeroStat
          label="New this month"
          value={newThisMonth}
          suffix="contacts"
          delta={deltaPct}
          sub={`vs ${newLastMonth} last month`}
          color="var(--coral)"
        />
        <HeroStat
          label="Active conversations"
          value={s?.active_conversations ?? 0}
          suffix="people"
          sub={`${s?.dormant ?? 0} in cold / dormant tier`}
          color="var(--warmth-warm)"
        />
        <HeroStat
          label="Total in your graph"
          value={s?.total_graph ?? 0}
          suffix="contacts"
          sub="since you started Connect Crew"
          color="var(--indigo)"
        />
      </section>

      {/* Growth chart */}
      <section className="mb-10 rounded-2xl border border-[var(--border)] bg-white p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
              Growth · last 7 months
            </div>
            <h2
              className="font-editorial text-xl md:text-2xl tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Your network over time.
            </h2>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded" style={{ backgroundColor: "var(--copper)", opacity: 0.8 }} />
              Cumulative
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded" style={{ backgroundColor: "var(--coral)" }} />
              New per month
            </span>
          </div>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart
              data={chartData}
              margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
            >
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--copper)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--copper)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}
              />
              <YAxis
                yAxisId="left"
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--ink)",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="cumulative"
                stroke="var(--copper)"
                strokeWidth={2}
                fill="url(#cumGrad)"
              />
              <Bar
                yAxisId="right"
                dataKey="new_contacts"
                fill="var(--coral)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* By Crew / By Channel — two side-by-side panels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 md:p-8">
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
              This month · by Crew
            </div>
            <h2
              className="font-editorial text-xl md:text-2xl tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Who did the work.
            </h2>
          </div>
          {crewBreakdown.length > 0 ? (
            <ul className="space-y-4">
              {crewBreakdown.map((c) => {
                const crew = CREW[c.crew as keyof typeof CREW] ?? {
                  name: c.crew,
                  color: "var(--muted-strong)",
                };
                const pct = (c.count / maxCrew) * 100;
                return (
                  <li key={c.crew}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: crew.color }}
                        />
                        <span className="font-medium text-[var(--foreground)] truncate capitalize">
                          {crew.name}
                        </span>
                      </div>
                      <span
                        className="font-editorial text-lg tabular-nums shrink-0"
                        style={{ color: crew.color, fontWeight: 700 }}
                      >
                        {c.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: crew.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-strong)]">
              No crew activity to break down yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 md:p-8">
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
              Where your graph lives · by channel
            </div>
            <h2
              className="font-editorial text-xl md:text-2xl tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Channel mix.
            </h2>
          </div>
          {channelShare.length > 0 ? (
            <ul className="space-y-4">
              {channelShare.map((c) => {
                const pct = totalChannel > 0 ? Math.round((c.count / totalChannel) * 100) : 0;
                const channel = c.channel as Channel;
                const Icon = CHANNEL_ICON[channel] ?? Mail;
                const color = CHANNEL_COLOR[channel] ?? "var(--muted-strong)";
                return (
                  <li key={c.channel}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color }}
                          strokeWidth={2}
                        />
                        <span className="font-medium text-[var(--foreground)] truncate">
                          {CHANNEL_LABEL[channel] ?? c.channel}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
                          {c.count}
                        </span>
                        <span
                          className="font-editorial text-lg tabular-nums"
                          style={{ color, fontWeight: 700 }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-strong)]">
              No channel activity yet.
            </p>
          )}
          <div className="mt-6 pt-4 border-t border-[var(--hairline)] grid grid-cols-3 gap-3">
            <MiniStat
              label="Drafts sent"
              value={s?.drafts_sent_this_month ?? 0}
              color="var(--sage)"
            />
            <MiniStat
              label="Drafts staged"
              value={s?.drafts_staged_this_month ?? 0}
              color="var(--gold)"
            />
            <MiniStat
              label="Avg warmth"
              value={s ? Math.round(s.avg_warmth) : 0}
              color="var(--terracotta)"
            />
          </div>
        </div>
      </section>

      {/* All contacts — paginated activity list */}
      <section className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
        <div className="p-6 md:p-8 border-b border-[var(--hairline)]">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
                All contacts · by activity this month
              </div>
              <h2
                className="font-editorial text-xl md:text-2xl tracking-tight"
                style={{ fontWeight: 600 }}
              >
                Everyone in your graph, ranked by conversation.
              </h2>
            </div>
            <div className="font-mono text-[11px] text-[var(--muted)] tabular-nums">
              Showing {visibleContacts.length} of {topActive.length}
            </div>
          </div>
        </div>
        <ul className="divide-y divide-[var(--hairline)]">
          {visibleContacts.map((c, i) => {
            const crew = CREW[c.last_crew as keyof typeof CREW] ?? {
              name: c.last_crew,
              color: "var(--muted-strong)",
            };
            const channel = c.channel as Channel;
            const ChannelIcon = CHANNEL_ICON[channel] ?? Mail;
            return (
              <li key={c.contact_id}>
                <Link
                  href={`/dashboard/contacts/${c.contact_id}`}
                  className="grid grid-cols-[auto_auto_1fr_auto] md:grid-cols-[auto_auto_1fr_180px_120px] gap-3 md:gap-5 px-6 md:px-8 py-4 items-center hover:bg-[var(--paper)]/40 transition-colors"
                >
                  <span className="font-mono text-xs text-[var(--muted)] w-6 tabular-nums text-right">
                    {i + 1}
                  </span>
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${crew.color} 14%, white)`,
                      color: crew.color,
                    }}
                  >
                    {c.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{c.name}</div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {c.company}
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <WarmthBar score={c.warmth} animated={false} />
                  </div>
                  <div className="font-mono text-xs text-[var(--muted-strong)] tabular-nums hidden md:flex items-center gap-1.5 justify-end">
                    <ChannelIcon className="h-3 w-3" strokeWidth={2} />
                    <span>{CHANNEL_LABEL[channel] ?? c.channel}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {hasMore ? (
          <div className="p-5 text-center border-t border-[var(--hairline)] bg-[var(--paper)]/30">
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-5 py-2 text-sm text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
            >
              Load {Math.min(PAGE_SIZE, remaining)} more
              <ChevronDown className="h-4 w-4" strokeWidth={2} />
              <span className="font-mono text-[10px] text-[var(--muted)] ml-1 tabular-nums">
                {remaining} remaining
              </span>
            </button>
          </div>
        ) : (
          <div className="p-5 text-center border-t border-[var(--hairline)] bg-[var(--paper)]/30">
            <div className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <Link
                href="/dashboard/lead-o-meter"
                className="underline hover:text-[var(--foreground)] transition-colors"
              >
                Open Lead-O-Meter
              </Link>
              <span>for the warmth-tier view.</span>
            </div>
          </div>
        )}
      </section>

      <p className="mt-10 mb-6 text-center font-mono text-[11px] text-[var(--muted)]">
        Analytics · live from your graph.
      </p>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  suffix,
  delta,
  sub,
  color,
}: {
  label: string;
  value: number;
  suffix: string;
  delta?: number;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl border p-6 md:p-7 relative overflow-hidden"
      style={{
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 5%, white)`,
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-widest mb-3"
        style={{ color }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="font-editorial leading-none tabular-nums"
          style={{
            fontSize: "clamp(3rem, 7vw, 4.5rem)",
            fontWeight: 800,
            color: "var(--ink)",
            letterSpacing: "-0.04em",
          }}
        >
          {value}
        </span>
        <span className="text-sm text-[var(--muted)]">{suffix}</span>
        {typeof delta === "number" ? (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums ml-1"
            style={{
              backgroundColor: delta >= 0
                ? "color-mix(in srgb, var(--sage) 14%, white)"
                : "color-mix(in srgb, var(--indigo) 10%, white)",
              color: delta >= 0 ? "var(--sage)" : "var(--indigo)",
            }}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
            ) : (
              <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="text-sm text-[var(--muted-strong)] leading-relaxed">
        {sub}
      </div>
    </div>
  );
}

function MiniStat({
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
        className="font-editorial text-2xl tabular-nums"
        style={{ color, fontWeight: 700 }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-strong)] mt-0.5">
        {label}
      </div>
    </div>
  );
}
