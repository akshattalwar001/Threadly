"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getDashboardActivity } from "@/lib/api";
import type { ActivityEntry } from "@/lib/api";

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const now = Date.now();
  const hours = Math.max(0, Math.floor((now - then) / (1000 * 60 * 60)));
  if (hours < 1) return "moments ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const WINS_LIMIT = 4;

export function RecentWins() {
  const { user, loading } = useAuth();
  const [wins, setWins] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getDashboardActivity()
      .then((data) => {
        if (!active) {
          return;
        }

        setWins(data.slice(0, WINS_LIMIT));
      })
      .catch(() => {
        if (active) {
          setWins([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
        Recent Progress
      </div>

      <h2 className="font-editorial text-3xl mb-6">
        Momentum.
      </h2>

      {wins.length > 0 ? (
        <div className="space-y-4">
          {wins.map((win) => (
            <div
              key={win.id}
              className="flex items-center justify-between border-b border-[var(--border)] pb-4"
            >
              <div>
                <div className="font-medium">
                  {win.action}
                </div>

                <div className="text-sm text-[var(--muted-strong)]">
                  {win.detail}
                </div>
              </div>

              <div className="font-mono text-xs text-[var(--muted)]">
                {formatRelative(win.timestamp)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          No recent progress yet.
        </p>
      )}
    </section>
  );
}