"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";

import {
  getGoogleStatus,
  getGoogleAuthUrl,
  getGoogleContactGroups,
  googleSync,
  googleDisconnect,
  type GoogleStatus,
  type GoogleContactGroup,
} from "@/lib/api";

export function GoogleConnect() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<GoogleContactGroup[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    created: number;
  } | null>(null);

  const refreshStatus = async () => {
    const s = await getGoogleStatus();
    setStatus(s);
    if (s.connected) {
      const g = await getGoogleContactGroups();
      setGroups(g);
    }
  };

  useEffect(() => {
    refreshStatus()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const googleParam = searchParams.get("google");

    if (googleParam === "connected") {
      refreshStatus().catch(() => {});
    } else if (googleParam === "error") {
      setError(searchParams.get("message") || "Google connection failed.");
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { auth_url } = await getGoogleAuthUrl();
      window.location.href = auth_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const toggleGroup = (resourceName: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(resourceName)) {
        next.delete(resourceName);
      } else {
        next.add(resourceName);
      }
      return next;
    });
  };

  const handleSync = async () => {
    setBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await googleSync(Array.from(selectedGroups));
      setSyncResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await googleDisconnect();
      setSyncResult(null);
      setGroups(null);
      setSelectedGroups(new Set());
      setStatus({ connected: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border bg-white p-6 max-w-xl"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Mail size={18} style={{ color: "var(--teal)" }} />
        <div className="font-editorial text-xl">Google Contacts &amp; Gmail</div>
      </div>

      <p className="text-sm text-[var(--muted-strong)] mb-6">
        Connect Google so Chief can pull your contacts and Gmail activity
        into the graph. Read-only: Threadly never sends mail or edits
        contacts on your behalf.
      </p>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Checking status...</div>
      ) : status?.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--teal)]">
            <CheckCircle2 size={16} />
            Connected as {status.email}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">
              Which Google Contacts groups should sync in?
            </div>
            <p className="text-xs text-[var(--muted)] mb-3">
              Only contacts in the groups you pick are imported, nothing
              syncs by default. Manage groups/labels in Google Contacts.
            </p>

            {groups === null ? (
              <div className="text-sm text-[var(--muted)]">
                Loading groups...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">
                No contact groups found. Create labels in Google Contacts
                first, then refresh this page.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {groups.map((g) => (
                  <label
                    key={g.resource_name}
                    className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(g.resource_name)}
                      onChange={() => toggleGroup(g.resource_name)}
                    />
                    <span className="flex-1">{g.name}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {g.member_count}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={busy || selectedGroups.size === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {busy ? "Syncing..." : "Sync selected groups"}
            </button>

            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              <LogOut size={16} />
              Disconnect
            </button>
          </div>

          {syncResult ? (
            <div className="text-sm text-[var(--muted-strong)]">
              Synced {syncResult.synced} contacts, {syncResult.created} new.
            </div>
          ) : null}
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Redirecting..." : "Connect Google"}
        </button>
      )}
    </div>
  );
}
