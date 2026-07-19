export function GradientBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-50 dark:bg-black"
    >
      <div className="absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/20" />
      <div className="absolute -top-24 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10" />
      <div className="absolute bottom-[-14rem] left-1/3 h-[34rem] w-[34rem] rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-400/10" />
      <div
        className="absolute inset-0 text-zinc-900 opacity-[0.04] dark:text-zinc-50 dark:opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
