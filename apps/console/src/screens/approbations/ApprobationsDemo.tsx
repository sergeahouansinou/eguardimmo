'use client';

import Link from 'next/link';
import { RouteUnavailable } from '@/ui/RouteUnavailable';

export function ApprobationsDemo() {
  return <RouteUnavailable title="Approbations" Link={Link} note="Les approbations n’existent pas dans le mode de démonstration." />;
}
