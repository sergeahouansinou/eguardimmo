import type { Reminder, ReminderInput } from '@/platform/notificationSettings/notificationSettings';

export const DELAY_PRESETS = [7, 14, 30] as const;
export const REPEAT_MIN = 1;
export const REPEAT_MAX = 180;

const DEFAULT_REPEAT = '7';
const DEFAULT_OCCURRENCES = '2';

export interface ReminderDraft {
  enabled: boolean;
  delay: string;
  repeats: boolean;
  repeatEvery: string;
  occurrences: string;
  channels: string[];
}

export type ReminderErrors = Partial<Record<'delay' | 'repeatEvery' | 'occurrences' | 'channels', string>>;

const CHANNEL_LABELS: Readonly<Record<string, string>> = { in_app: 'Application', email: 'E-mail', push: 'Mobile' };

export const channelLabel = (channel: string): string => CHANNEL_LABELS[channel] ?? channel;

export function draftOf(reminder: Reminder): ReminderDraft {
  return {
    enabled: reminder.enabled,
    delay: String(reminder.delay_days),
    repeats: reminder.repeat_every_days !== null,
    repeatEvery: reminder.repeat_every_days === null ? DEFAULT_REPEAT : String(reminder.repeat_every_days),
    occurrences: String(reminder.max_occurrences),
    channels: reminder.channels,
  };
}

export function withRepetition(draft: ReminderDraft, repeats: boolean): ReminderDraft {
  const occurrences = repeats ? (draft.occurrences === '1' ? DEFAULT_OCCURRENCES : draft.occurrences) : '1';
  return { ...draft, repeats, occurrences };
}

function outside(value: string, min: number, max: number): boolean {
  return !/^\d+$/.test(value) || Number(value) < min || Number(value) > max;
}

const between = (min: number, max: number) => `Saisissez un nombre entre ${String(min)} et ${String(max)}.`;

export function validateReminder(draft: ReminderDraft, reminder: Reminder): ReminderErrors {
  const errors: ReminderErrors = {};
  if (outside(draft.delay, reminder.delay_min, reminder.delay_max)) errors.delay = between(reminder.delay_min, reminder.delay_max);
  if (draft.repeats && outside(draft.repeatEvery, REPEAT_MIN, REPEAT_MAX)) errors.repeatEvery = between(REPEAT_MIN, REPEAT_MAX);
  if (draft.repeats && outside(draft.occurrences, 1, reminder.occurrences_limit)) errors.occurrences = between(1, reminder.occurrences_limit);
  if (draft.channels.length === 0) errors.channels = 'Gardez au moins un canal.';
  return errors;
}

export function inputOf(draft: ReminderDraft, reminder: Reminder): ReminderInput {
  return {
    enabled: draft.enabled,
    delay_days: Number(draft.delay),
    repeat_every_days: draft.repeats ? Number(draft.repeatEvery) : null,
    max_occurrences: draft.repeats ? Number(draft.occurrences) : 1,
    channels: reminder.available_channels.filter((channel) => draft.channels.includes(channel)),
  };
}

export const timingLabel = (timing: Reminder['timing'], delay: string): string => {
  const days = delay === '' ? '…' : delay;
  const unit = Number(delay) > 1 ? 'jours' : 'jour';
  return timing === 'before' ? `${days} ${unit} avant` : `après ${days} ${unit}`;
};
