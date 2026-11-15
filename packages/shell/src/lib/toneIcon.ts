import { Bell, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../data/schemas';

export const toneIcon: Record<Tone, LucideIcon> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
  neutral: Bell,
};
