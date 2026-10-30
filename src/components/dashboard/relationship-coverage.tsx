"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getDashboardCoverage } from "@/lib/api";
import type { CoverageRow } from "@/lib/api";

export function RelationshipCoverage() {
  const { user, loading } = useAuth();
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getDashboardCoverage()
      .then((data) => {
        if (!active) {
          return;
        }

        setCoverage(data);
      })
      .catch(() => {
        if (active) {
          setCoverage([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
        Coverage
      </div>

      <h2 className="font-editorial text-3xl mb-6">
        Relationship Map
      </h2>

      {coverage.length > 0 ? (
        <div className="space-y-5">
          {coverage.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between mb-2">
                <span>{item.label}</span>
                <span className="font-mono text-sm">
                  {item.pct}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: "var(--teal)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          No coverage data yet.
        </p>
      )}
    </section>
  );
}