'use client';

type AdSlotProps = {
  placement: 'hero' | 'results';
};

const labels = {
  hero: 'Advertisement',
  results: 'Sponsored',
} as const;

export default function AdSlot({ placement }: AdSlotProps) {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== 'true') {
    return null;
  }

  return (
    <aside
      aria-label={labels[placement]}
      className="mx-auto mt-8 flex min-h-24 max-w-3xl items-center justify-center rounded-2xl border border-white/20 bg-slate-950/10 px-4 py-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-orange-100/80"
    >
      <span>{labels[placement]}</span>
    </aside>
  );
}
