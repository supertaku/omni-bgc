import type { FoodHours } from './contracts';
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function clock(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
/** Venue, delivery and ordering schedules never become restaurant operating hours. */
export function restaurantHoursLines(hours: FoodHours): string[] {
  if (hours.kind !== 'restaurant' || !hours.sourceUrl || !hours.text) return ['Hours not available.'];
  if (!hours.weeklySchedule?.length) return [hours.text];
  const schedule = days.map((_, index) => hours.weeklySchedule!
    .filter(row => row.day === (index + 1) % 7)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(row => `${clock(row.start)}–${clock(row.end)}`).join(', '));
  const lines: string[] = [];
  for (let first = 0; first < 7;) {
    let last = first;
    while (last + 1 < 7 && schedule[last + 1] === schedule[first]) last++;
    if (schedule[first]) lines.push(`${days[first]}${last > first ? `–${days[last]}` : ''}: ${schedule[first]}`);
    first = last + 1;
  }
  return lines.length ? lines : [hours.text];
}
