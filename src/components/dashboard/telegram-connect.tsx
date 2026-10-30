"use client";

import { useEffect, useState } from "react";
import { Send, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";

import {
  getTelegramStatus,
  telegramConnectStart,
  telegramConnectVerify,
  telegramSync,
  telegramDisconnect,
  type TelegramStatus,
} from "@/lib/api";

type Step = "loading" | "connected" | "phone" | "code" | "password";

export function TelegramConnect() {
  const [step, setStep] = useState<Step>("loading");
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    created: number;
  } | null>(null);

  const refreshStatus = async () => {
    const s = await getTelegramStatus();
    setStatus(s);
    setStep(s.connected ? "connected" : "phone");
  };

  useEffect(() => {
    refreshStatus().catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
      setStep("phone");
    });
  }, []);

  const handleStart = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await telegramConnectStart(phone.trim());
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await telegramConnectVerify(
        phone.trim(),
        code.trim(),
        password || undefined,
      );

      if ("needs_password" in result) {
        setStep("password");
      } else {
        await refreshStatus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await telegramSync();
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
      await telegramDisconnect();
      setPhone("");
      setCode("");
      setPassword("");
      setSyncResult(null);
      setStep("phone");
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
        <Send size={18} style={{ color: "var(--teal)" }} />
        <div className="font-editorial text-xl">Telegram</div>
      </div>

      <p className="text-sm text-[var(--muted-strong)] mb-6">
        Connect your Telegram account so Chief can pull your contacts
        into the graph.
      </p>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      ) : null}

      {step === "loading" ? (
        <div className="text-sm text-[var(--muted)]">Checking status...</div>
      ) : null}

      {step === "phone" ? (
        <div className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="w-full rounded-xl px-4 py-3 border outline-none"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handleStart}
            disabled={busy || !phone.trim()}
            className="rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Sending code..." : "Send code"}
          </button>
        </div>
      ) : null}

      {step === "code" ? (
        <div className="space-y-3">
          <div className="text-sm text-[var(--muted-strong)]">
            Enter the code sent to {phone} via Telegram.
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="12345"
            className="w-full rounded-xl px-4 py-3 border outline-none"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handleVerify}
            disabled={busy || !code.trim()}
            className="rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Verifying..." : "Verify"}
          </button>
        </div>
      ) : null}

      {step === "password" ? (
        <div className="space-y-3">
          <div className="text-sm text-[var(--muted-strong)]">
            This account has two-factor authentication enabled. Enter
            your Telegram cloud password.
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Cloud password"
            className="w-full rounded-xl px-4 py-3 border outline-none"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handleVerify}
            disabled={busy || !password.trim()}
            className="rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Verifying..." : "Confirm password"}
          </button>
        </div>
      ) : null}

      {step === "connected" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[var(--teal)]">
            <CheckCircle2 size={16} />
            Connected as {status?.phone}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {busy ? "Syncing..." : "Sync contacts"}
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
              Synced {syncResult.synced} contacts, {syncResult.created}{" "}
              new.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
