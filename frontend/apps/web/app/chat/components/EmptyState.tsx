export function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-8 text-sm text-neutral-600">
      <h2 className="text-base font-semibold text-neutral-800">Start a query.</h2>
      <p>
        PetroBrain answers questions grounded in your tenant&apos;s SOPs, standards, and
        emissions data. Numbers come from the calculation tools — never from prose.
      </p>
      <p>
        Pick a <span className="font-medium">module</span> (Well Control or Emissions / MRV) when the
        question is specialist; the <span className="font-medium">asset context</span> filters the
        retrieved clauses to the relevant facility.
      </p>
      <p className="text-neutral-500">
        Example: <em>&ldquo;Build a kill sheet for 10,000 ft TVD, OMW 9.6 ppg, SIDPP 400, SICP 600,
          pit gain 20 bbl.&rdquo;</em>
      </p>
    </div>
  );
}
