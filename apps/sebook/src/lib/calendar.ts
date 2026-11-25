export interface DateParts {
  y: number;
  m: number;
  d: number;
}

export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function keyOf(o: DateParts | null): number | null {
  return o ? o.y * 10000 + (o.m + 1) * 100 + o.d : null;
}

export function dateOf(o: DateParts): Date {
  return new Date(o.y, o.m, o.d);
}

function dateOfKey(key: number): Date {
  return new Date(Math.floor(key / 10000), (Math.floor(key / 100) % 100) - 1, key % 100);
}

function keyOfDate(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function partsOfIso(iso: string): DateParts | null {
  const match = ISO_DAY.exec(iso);
  if (!match) return null;
  const parts = { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
  const date = dateOf(parts);
  return date.getFullYear() === parts.y && date.getMonth() === parts.m && date.getDate() === parts.d ? parts : null;
}

export function isoOfParts(o: DateParts): string {
  return `${String(o.y).padStart(4, "0")}-${String(o.m + 1).padStart(2, "0")}-${String(o.d).padStart(2, "0")}`;
}

export function addDaysToParts(o: DateParts, days: number): DateParts {
  const date = new Date(o.y, o.m, o.d + days);
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

export function monthLabel(y: number, m: number, monthsLong: readonly string[] = MONTHS_EN): string {
  return `${monthsLong[m] ?? ""} ${String(y)}`;
}

export function shortDate(o: DateParts | null, monthsShort?: readonly string[], lang = "en"): string | null {
  if (!o) return null;
  const month = (monthsShort ?? MONTHS_EN)[o.m]?.slice(0, monthsShort ? undefined : 3) ?? "";
  return lang === "fr" ? `${String(o.d)} ${month}` : `${month} ${String(o.d)}`;
}

export function nightsBetween(ci: DateParts | null, co: DateParts | null): number {
  if (!ci || !co) return 0;
  return Math.round((dateOf(co).getTime() - dateOf(ci).getTime()) / DAY_MS);
}

export interface BookedRange {
  checkIn: string;
  checkOut: string;
}

export function isoToKey(iso: string): number | null {
  const match = ISO_DAY.exec(iso);
  if (!match) return null;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

export function bookedNightKeys(ranges: readonly BookedRange[]): Set<number> {
  const blocked = new Set<number>();
  for (const range of ranges) {
    const ci = isoToKey(range.checkIn);
    const co = isoToKey(range.checkOut);
    if (ci === null || co === null) continue;
    const end = dateOfKey(co);
    for (const t = dateOfKey(ci); t < end; t.setDate(t.getDate() + 1)) blocked.add(keyOfDate(t));
  }
  return blocked;
}

export function rangeCrossesBlocked(ciKey: number, coKey: number, blocked: ReadonlySet<number>): boolean {
  const end = dateOfKey(coKey);
  for (const t = dateOfKey(ciKey); t < end; t.setDate(t.getDate() + 1)) {
    if (blocked.has(keyOfDate(t))) return true;
  }
  return false;
}

export interface DayCell {
  empty: boolean;
  day: number;
  label: string;
  past: boolean;
  booked: boolean;
  beyond: boolean;
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
}

const EMPTY_BLOCKED: ReadonlySet<number> = new Set<number>();

const EMPTY_CELL: DayCell = { empty: true, day: 0, label: "", past: false, booked: false, beyond: false, disabled: false, isStart: false, isEnd: false, inRange: false };

export function buildMonthCells(
  y: number,
  m: number,
  ci: DateParts | null,
  co: DateParts | null,
  today: DateParts,
  blocked: ReadonlySet<number> = EMPTY_BLOCKED,
  last: DateParts | null = null,
): DayCell[] {
  const todayKey = keyOf(today) ?? 0;
  const lastKey = keyOf(last);
  const cik = keyOf(ci);
  const cok = keyOf(co);
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells: DayCell[] = Array.from({ length: offset }, () => EMPTY_CELL);
  for (let d = 1; d <= daysInMonth; d++) {
    const k = y * 10000 + (m + 1) * 100 + d;
    const past = k < todayKey;
    const beyond = lastKey !== null && k > lastKey;
    const booked = !past && blocked.has(k);
    cells.push({
      empty: false,
      day: d,
      label: String(d),
      past,
      booked,
      beyond,
      disabled: past || booked || beyond,
      isStart: k === cik,
      isEnd: k === cok,
      inRange: cik !== null && cok !== null && k > cik && k < cok,
    });
  }
  return cells;
}

export function prevBlocked(y: number, m: number, today: DateParts): boolean {
  return y === today.y && m <= today.m;
}

export function nextBlocked(y: number, m: number, last: DateParts): boolean {
  return y > last.y || (y === last.y && m >= last.m);
}

export function shiftMonth(y: number, m: number, delta: number, today: DateParts): { y: number; m: number } {
  if (delta < 0 && prevBlocked(y, m, today)) return { y, m };
  const date = new Date(y, m + delta, 1);
  return { y: date.getFullYear(), m: date.getMonth() };
}

export function nightsBetweenKeys(ciKey: number, coKey: number): number {
  return Math.round((dateOfKey(coKey).getTime() - dateOfKey(ciKey).getTime()) / DAY_MS);
}

export interface Selection {
  checkIn: DateParts | null;
  checkOut: DateParts | null;
}

export interface SelectOptions {
  blocked?: ReadonlySet<number>;
  minNights?: number;
}

export function selectDay(ci: DateParts | null, co: DateParts | null, y: number, m: number, d: number, opts: SelectOptions = {}): Selection {
  const blocked = opts.blocked ?? EMPTY_BLOCKED;
  const minNights = opts.minNights && opts.minNights > 0 ? opts.minNights : 1;
  const k = y * 10000 + (m + 1) * 100 + d;
  const picked = { y, m, d };

  if (blocked.has(k)) return { checkIn: ci, checkOut: co };
  if (!ci || co) return { checkIn: picked, checkOut: null };

  const cik = keyOf(ci) ?? 0;
  if (k <= cik) return { checkIn: picked, checkOut: null };
  if (nightsBetweenKeys(cik, k) < minNights) return { checkIn: ci, checkOut: null };
  if (rangeCrossesBlocked(cik, k, blocked)) return { checkIn: picked, checkOut: null };
  return { checkIn: ci, checkOut: picked };
}
