"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getDashboardActivity } from "@/lib/api";
import type { ActivityEntry } from "@/lib/api";

const CREW_COLORS: Record<string, string> = {
  chief: "var(--plum)",
  scan: "var(--coral)",
  snap: "var(--coral)",
  nudge: "var(--teal)",
  inbound: "var(--copper)",
  gatekeeper: "var(--copper)",
  social: "var(--indigo)",
  pulse: "var(--indigo)",
  scribe: "var(--sage)",
  recall: "var(--sage)",
  signals: "var(--teal)",
};

const FALLBACK_COLORS = [
  "var(--plum)",
  "var(--coral)",
  "var(--teal)",
  "var(--copper)",
  "var(--indigo)",
  "var(--sage)",
];

function colorForCrew(crew: string, index: number) {
  return CREW_COLORS[crew.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function CrewActivity() {
  const { user, loading } = useAuth();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

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

        setActivity(data);
      })
      .catch(() => {
        if (active) {
          setActivity([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  const grouped = Object.entries(
    activity.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.crew] = (acc[entry.crew] ?? 0) + 1;
      return acc;
    }, {}),
  );

  return (
    <section className="mb-8">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
        Crew Activity
      </div>

      <h2 className="font-editorial text-4xl mb-6">
        Working behind the scenes.
      </h2>

      {grouped.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map(([crew, count], index) => (
            <div
              key={crew}
              className="rounded-2xl border border-[var(--border)] p-5 bg-white"
            >
              <div
                className="font-editorial text-2xl capitalize"
                style={{
                  color: colorForCrew(crew, index),
                }}
              >
                {crew}
              </div>

              <div className="mt-2 text-sm text-[var(--muted-strong)]">
                {count} {count === 1 ? "action" : "actions"} logged
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          No crew activity yet.
        </p>
      )}
    </section>
  );
}