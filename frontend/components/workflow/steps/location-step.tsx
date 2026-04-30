type LocationStepProps = {
  value: string;
  loading: boolean;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
};

export function LocationStep({ value, loading, onChange, onSubmit }: LocationStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Property Location</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Input raw address text. This field is required before document upload.</p>
      </div>

      <textarea
        className="input-base min-h-32 resize-none"
        placeholder="Contoh: Jl. Merdeka No 123, Bandung"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">AI Parsed Preview</p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{value ? `Preview parsing: "${value}"` : 'Address preview will appear here.'}</p>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="w-full rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 sm:w-auto"
      >
        {loading ? 'Saving location...' : 'Continue'}
      </button>
    </div>
  );
}
