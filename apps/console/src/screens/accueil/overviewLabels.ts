const STATUS_LABELS: Record<string, string> = {
  trialing: 'essai',
  free: 'gratuit',
  active: 'actif',
  past_due: 'impayé',
  cancelling: 'résiliation en cours',
  ended: 'terminé',
};

export const subscriptionStatusLabel = (status: string): string => STATUS_LABELS[status] ?? status;
