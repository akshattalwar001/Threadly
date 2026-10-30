export default function AuthHero() {
const crew = [
"Chief",
"Snap",
"Nudge",
"Gatekeeper",
"Pulse",
"Recall",
];

return (
    <section className="flex flex-col justify-center px-8 md:px-16 py-16">
      <div className="max-w-xl">
        <img
          src="/brand/logocolor.png"
          alt="Threadly"
          className="h-16 w-68 mb-8"
        />

        <h1
      className="font-editorial text-5xl md:text-7xl leading-[0.95] tracking-tight text-[var(--ink)]"
      style={{ fontWeight: 700 }}
    >
      Never lose
      <br />
      someone important
      <br />
      again.
    </h1>

    <p className="mt-6 text-base leading-relaxed text-[var(--muted-strong)] max-w-md">
      Threadly keeps your relationships alive across
      email, Telegram, meetings,
      introductions, and events.
    </p>

    <div className="flex flex-wrap gap-2 mt-8">
      {crew.map((member) => (
        <span
          key={member}
          className="px-3 py-1 rounded-full border border-[var(--border)] bg-white text-xs font-mono"
        >
          {member}
        </span>
      ))}
        </div>
      </div>
    </section>
  );
}
