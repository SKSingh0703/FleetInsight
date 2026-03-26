export default function SummaryCard({ title, value }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="mt-2 text-xl font-semibold text-gray-900">
        {value ?? "—"}
      </div>
    </div>
  );
}

