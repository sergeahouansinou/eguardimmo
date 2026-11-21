'use client';

import { useLeaseChoices } from '../finances/rent/useLeaseChoices';
import { useUnits } from '../locataires/hooks';
import { unitFullLabel } from '../locataires/schemas';
import { subjectTypeLabel } from './labels';
import type { CertificateSubject, SubjectType } from './model';
import { useConformiteSource } from './source';

export const CHOOSABLE_SUBJECTS = ['organization', 'unit', 'lease'] as const satisfies readonly SubjectType[];
export type ChoosableSubject = (typeof CHOOSABLE_SUBJECTS)[number];

export interface SubjectChoices {
  organizationId: string | null;
  unitOptions: { value: string; label: string }[];
  leaseOptions: { value: string; label: string }[];
  labelOf: (subject: CertificateSubject) => string;
}

export function useSubjectChoices(): SubjectChoices {
  const { organizationId } = useConformiteSource();
  const units = useUnits();
  const leases = useLeaseChoices();
  const unitList = units.data ?? [];
  return {
    organizationId,
    unitOptions: unitList.map((unit) => ({ value: unit.id, label: unitFullLabel(unit) })),
    leaseOptions: leases.options,
    labelOf: (subject) => {
      if (subject.type === 'organization') return 'Organisation';
      if (subject.type === 'unit') {
        const unit = unitList.find((entry) => entry.id === subject.id);
        return unit ? unitFullLabel(unit) : subjectTypeLabel.unit;
      }
      if (subject.type === 'lease') {
        const reference = leases.referenceOf(subject.id);
        return reference ? `Bail ${reference}` : subjectTypeLabel.lease;
      }
      return subjectTypeLabel[subject.type];
    },
  };
}
