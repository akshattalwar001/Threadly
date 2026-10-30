"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Upload,
  X,
  RotateCcw,
  Sparkles,
  Check,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { scannerScan } from "@/lib/api";
import type { ScannerResult } from "@/lib/api";
import { useGensparkPanel } from "@/components/genspark-side-panel";

type Mode = "idle" | "camera" | "preview" | "processing" | "done" | "error";

// Shown in the side panel while OCR + the LLM extraction are in flight.
const WAITING_STEPS = [
  "Reading text from the card (OCR, in-browser)",
  "Groq extracting structured fields",
  "Filing the contact into your graph",
];

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [image, setImage] = useState<string | null>(null);
  const [metContext, setMetContext] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);

  const panel = useGensparkPanel();

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    setCameraError(null);
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(msg);
      setMode("idle");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // jpeg 0.85 — keeps payload under Vercel's 4.5MB body limit for
    // ~720p cards, well under Anthropic's 5MB vision cap.
    setImage(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setMode("preview");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  }

  async function process() {
    if (!image) return;
    setMode("processing");
    setErrorMessage(null);

    // Long-stepped "working" panel — gives OCR + the LLM call time to
    // return without the panel finishing early.
    panel.run({
      crew: "scan",
      title: "Scan · OCR + Groq",
      steps: WAITING_STEPS,
      stepMs: 3500,
      autoDismissMs: null,
    });

    try {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(image, "eng");
      const ocrText = data.text.trim();

      if (!ocrText) {
        panel.run({
          crew: "scan",
          title: "Scan · couldn't read card",
          steps: ["No text detected in the image"],
          stepMs: 350,
          autoDismissMs: 1500,
        });
        setErrorMessage(
          "Couldn't detect any text in that photo. Try again with better lighting or a straighter angle.",
        );
        setMode("error");
        return;
      }

      const combinedText = metContext.trim()
        ? `${ocrText}\n\nMet at: ${metContext.trim()}`
        : ocrText;

      const scanned = await scannerScan(combinedText);

      panel.run({
        crew: "scan",
        title: "Scan · OCR + Groq",
        steps: [
          "OCR extracted text from the card",
          "Groq extracted structured fields",
          "Contact filed into your graph",
        ],
        stepMs: 450,
        autoDismissMs: null,
        onDone: () => setMode("done"),
      });
      setResult(scanned);
      setProcessedCount((c) => c + 1);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      panel.run({
        crew: "scan",
        title: "Scan · error",
        steps: [`Request failed: ${msg}`],
        stepMs: 400,
        autoDismissMs: 1500,
      });
      setErrorMessage(msg);
      setMode("error");
    }
  }

  function reset() {
    stopCamera();
    panel.close();
    setImage(null);
    setMetContext("");
    setResult(null);
    setErrorMessage(null);
    setMode("idle");
    setCameraError(null);
  }

  return (
  <div className="pt-4 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Dashboard
      </Link>
    <div className="pt-4 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 min-w-0 paper-grain min-h-screen">
      {/* Header */}
      <header className="mb-10">
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-3"
          style={{ color: "var(--coral)" }}
        >
          Crew · 01 · Snap
        </div>
        <h1
          className="font-editorial text-4xl md:text-5xl lg:text-6xl leading-[0.95] tracking-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.03em" }}
        >
          Snap a card.
          <br />
          <span className="text-[var(--muted-strong)]">
            The Crew does the rest.
          </span>
        </h1>
        <p className="mt-4 text-sm md:text-base text-[var(--muted-strong)] leading-relaxed max-w-2xl">
          Snap a photo with your camera or drop a file. Text is read from
          the card in your browser, then Groq extracts the contact&apos;s
          details and files them straight into your graph.
        </p>
      </header>

      {/* Main stage */}
      <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden min-h-[480px] flex flex-col">
        {/* ─── Idle ─── */}
        {mode === "idle" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 md:p-14 text-center">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: "color-mix(in srgb, var(--coral) 14%, white)",
                border:
                  "1px solid color-mix(in srgb, var(--coral) 30%, transparent)",
              }}
            >
              <Camera
                className="h-8 w-8"
                style={{ color: "var(--coral)" }}
                strokeWidth={1.5}
              />
            </div>
            <h2
              className="font-editorial text-2xl md:text-3xl tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Add a business card
            </h2>
            <p className="mt-3 text-sm text-[var(--muted-strong)] max-w-md leading-relaxed">
              Use your camera or upload a file. Both work on desktop and
              mobile. If camera permission is denied, upload still works.
            </p>
            {cameraError ? (
              <div
                className="mt-4 inline-flex items-center gap-2 text-xs font-mono rounded px-3 py-1.5"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--indigo) 10%, white)",
                  color: "var(--indigo)",
                }}
              >
                <AlertCircle className="h-3 w-3" strokeWidth={2} />
                {cameraError} · try Upload file
              </div>
            ) : null}
            <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-full text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "var(--coral)" }}
              >
                <Camera className="h-4 w-4" strokeWidth={2} /> Use camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
              >
                <Upload className="h-4 w-4" strokeWidth={2} /> Upload file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
            </div>

            <div className="mt-8 font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">
              Processed this session · {processedCount}
            </div>
          </div>
        ) : null}

        {/* ─── Camera ─── */}
        {mode === "camera" ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-black relative overflow-hidden aspect-video max-h-[70vh]">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[70%] h-[45%] border-2 border-white/40 rounded-lg" />
              </div>
              <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest text-white/80 bg-black/40 backdrop-blur-sm rounded px-2 py-1">
                Align card within the guide
              </div>
            </div>
            <div className="p-5 flex items-center justify-center gap-6 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-strong)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={capture}
                className="h-14 w-14 rounded-full border-4 border-[var(--foreground)] bg-white hover:scale-105 transition-transform"
                aria-label="Capture"
              />
              <div className="w-[84px]" aria-hidden />
            </div>
          </div>
        ) : null}

        {/* ─── Preview / Processing / Done ─── */}
        {(mode === "preview" || mode === "processing" || mode === "done") &&
        image ? (
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8 p-6 md:p-8 flex-1">
              {/* Card preview */}
              <div
                className={`${mode === "preview" ? "md:w-[360px]" : "md:w-[220px]"} w-full transition-all`}
              >
                <div className="relative rounded-xl overflow-hidden shadow-md bg-[var(--paper)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="captured card"
                    className="w-full h-auto"
                  />
                  {mode === "done" ? (
                    <div
                      className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--sage) 95%, white)",
                        color: "white",
                      }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} /> Filed
                    </div>
                  ) : null}
                </div>
                {mode === "processing" ? (
                  <div className="mt-3 flex items-center gap-2 font-mono text-xs text-[var(--muted-strong)]">
                    <Sparkles
                      className="h-3.5 w-3.5 anim-pulse-hot"
                      style={{ color: "var(--coral)" }}
                    />
                    Reading and extracting…
                  </div>
                ) : null}
              </div>

              {/* Result / preview */}
              <div className="min-w-0">
                {mode === "preview" ? (
                  <div className="h-full flex flex-col">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3">
                        Ready to process
                      </div>
                      <h3
                        className="font-editorial text-xl md:text-2xl tracking-tight leading-tight mb-3"
                        style={{ fontWeight: 600 }}
                      >
                        Send this card to the Crew?
                      </h3>
                      <p className="text-sm text-[var(--muted-strong)] leading-relaxed mb-5">
                        Text is read from the card in your browser (OCR),
                        then Groq extracts the contact&apos;s details and
                        files them into your graph.
                      </p>

                      {/* Where did we meet? */}
                      <label className="block mb-5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] block mb-1.5">
                          Where did you meet? <span className="normal-case tracking-normal">(optional)</span>
                        </span>
                        <input
                          type="text"
                          value={metContext}
                          onChange={(e) => setMetContext(e.target.value)}
                          placeholder="e.g. TOKEN2049 · reception · ABA dinner"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)]/40 p-2.5 text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                        />
                        <span className="block mt-1.5 text-[11px] text-[var(--muted)] leading-relaxed">
                          Used as extra context for the extraction. Optional.
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}

                {mode === "processing" ? (
                  <div className="font-mono text-xs text-[var(--muted-strong)] space-y-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-3">
                      In progress
                    </div>
                    <p className="leading-relaxed">
                      Watch the side panel on the right for live progress
                      while OCR and the extraction step run.
                    </p>
                  </div>
                ) : null}

                {mode === "done" && result ? (
                  <DoneView result={result} />
                ) : null}
              </div>
            </div>

            <div className="p-5 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-strong)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={2} /> Scan another
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {mode === "preview" ? (
                  <button
                    type="button"
                    onClick={process}
                    className="inline-flex items-center gap-2 rounded-full text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "var(--coral)" }}
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={2} /> Extract
                    contact
                  </button>
                ) : null}
                {mode === "done" && result ? (
                  <>
                    <Link
                      href="/dashboard/contacts"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                    >
                      View in Contacts
                    </Link>
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-2 rounded-full text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: "var(--coral)" }}
                    >
                      <Camera className="h-4 w-4" strokeWidth={2} /> Next card
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Error state ─── */}
        {mode === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 md:p-14 text-center">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: "color-mix(in srgb, var(--indigo) 10%, white)",
                border:
                  "1px solid color-mix(in srgb, var(--indigo) 30%, transparent)",
              }}
            >
              <AlertCircle
                className="h-7 w-7"
                style={{ color: "var(--indigo)" }}
                strokeWidth={1.5}
              />
            </div>
            <h2
              className="font-editorial text-2xl tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Couldn&apos;t read this card clearly.
            </h2>
            <p className="mt-3 text-sm text-[var(--muted-strong)] max-w-md leading-relaxed">
              {errorMessage ??
                "Text was below the OCR-confidence threshold. Try another photo with better lighting, or enter the fields manually."}
            </p>

            <div className="mt-7 flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--muted-strong)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
              >
                Try another photo
              </button>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  </div>
  );
}

function DoneView({ result }: { result: ScannerResult }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--sage)] mb-3 flex items-center gap-1.5">
        <Check className="h-3 w-3" strokeWidth={3} />
        Extracted · confidence {Math.round(result.confidence * 100)}%
      </div>
      <h3
        className="font-editorial text-xl md:text-2xl tracking-tight leading-tight mb-5"
        style={{ fontWeight: 600 }}
      >
        {result.name ?? "Unknown name"}
      </h3>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-5">
        {(
          [
            ["role", result.role],
            ["company", result.company],
            ["email", result.email],
            ["phone", result.phone],
            ["met at", result.event],
          ] as const
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[88px_1fr] gap-3 items-start"
            >
              <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] pt-0.5">
                {k}
              </dt>
              <dd className="text-sm text-[var(--foreground)] break-all">
                {v}
              </dd>
            </div>
          ))}
      </dl>

      {result.topics.length > 0 ? (
        <div className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full px-2.5 py-0.5 text-xs"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--coral) 10%, white)",
                  color: "var(--coral)",
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {result.commitments.length > 0 ? (
        <div className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Commitments
          </div>
          <ul className="space-y-1">
            {result.commitments.map((c) => (
              <li key={c} className="text-sm text-[var(--foreground)]">
                · {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg p-3 border border-[var(--border)] font-mono text-[11px] leading-relaxed text-[var(--muted-strong)]">
        {result.summary}
      </div>
    </div>
  );
}
