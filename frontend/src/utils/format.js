export function formatMoney(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

