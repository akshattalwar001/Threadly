"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getDashboardOpportunities } from "@/lib/api";
import type { Opportunity } from "@/lib/api";

export function Opportunities() {
  const { user, loading } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let active = true;

    getDashboardOpportunities()
      .then((data) => {
        if (!active) {
          return;
        }

        setOpportunities(data);
      })
      .catch(() => {
        if (active) {
          setOpportunities([]);
        }
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
        Top Opportunities
      </div>

      <h2 className="font-editorial text-3xl mb-6">
        People worth meeting.
      </h2>

      {opportunities.length > 0 ? (
        <div className="space-y-4">
          {opportunities.map((person) => (
            <div
              key={person.id}
              className="rounded-2xl border border-[var(--border)] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {person.name}
                  </div>

                  <div className="text-sm text-[var(--muted-strong)]">
                    {person.title} · {person.company}
                  </div>
                </div>

                <div className="font-mono text-xs">
                  {person.warmth}%
                </div>
              </div>

              <p className="mt-3 text-sm text-[var(--muted-strong)]">
                Last contact {person.last_contact} ago
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-strong)]">
          No reconnect opportunities right now.
        </p>
      )}
    </section>
  );
}