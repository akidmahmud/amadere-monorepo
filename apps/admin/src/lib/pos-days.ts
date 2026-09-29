/** "Today", "Yesterday", "5 days ago" — whole calendar days in local time. */
export function daysAgo(date: string | Date, now: number = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const n = Math.round(day(now) - day(new Date(date).getTime()));
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  return `${n} days ago`;
}
