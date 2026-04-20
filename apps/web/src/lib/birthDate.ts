export type BirthDateParts = { day: string; month: string; year: string };

export function parseIsoDate(iso: string): BirthDateParts {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { day: "", month: "", year: "" };
  const [year, month, day] = iso.split("-");
  return { day: day ?? "", month: month ?? "", year: year ?? "" };
}

export function partsToIso(parts: BirthDateParts): string {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  if (!parts.day || !parts.month || parts.year.length !== 4) return "";
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year))
    return "";
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > 31) return "";
  if (year < 1900 || year > 2200) return "";
  const lastDay = new Date(year, month, 0).getDate();
  if (day > lastDay) return "";
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");
  return `${yyyy}-${mm}-${dd}`;
}
