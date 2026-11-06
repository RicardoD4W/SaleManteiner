export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year, monthNumber - 1 + delta, 1));
}

export function monthBounds(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` };
}

export function lastNMonths(n: number, now: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(monthKey(date));
  }
  return result;
}
