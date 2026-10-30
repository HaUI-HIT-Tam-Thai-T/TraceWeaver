export function dateString(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Keep time and fractional seconds verbatim; Date is used only to lay out days.
export function replaceCalendarDate(value: string, day: string) {
  return `${day}T${value.split("T")[1] || "00:00:00"}`;
}

export type CalendarTimePart = "hour" | "minute" | "second" | "fraction";

export function replaceCalendarTime(value: string, part: CalendarTimePart, next: string) {
  if (!value) return value;
  const [day = "", time = "00:00:00"] = value.split("T");
  const [whole = "", fraction = ""] = time.split(".");
  const [hour = "00", minute = "00", second = "00"] = whole.split(":");
  if (part === "fraction") {
    if (!/^\d{0,6}$/.test(next)) return value;
  } else if (!/^\d{2}$/.test(next) || Number(next) > (part === "hour" ? 23 : 59)) return value;
  const nextFraction = part === "fraction" ? next : fraction;
  return `${day}T${part === "hour" ? next : hour}:${part === "minute" ? next : minute}:${part === "second" ? next : second}${nextFraction ? `.${nextFraction}` : ""}`;
}

export function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
