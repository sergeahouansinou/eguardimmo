'use client';

import { Card, Checkbox, Switch } from '@eguardimmo/ui';
import { useState } from 'react';
import { useUpdateReport } from './hooks';
import { sectionLabel } from './labels';
import { SECTIONS } from './model';
import type { Report, ReportChanges, Section } from './model';
import { ActionError, RoleNotice } from './parts';

export function ReportSettings({ report, editable }: { report: Report; editable: boolean }) {
  const update = useUpdateReport();
  const [failure, setFailure] = useState<unknown>(null);
  const locked = !editable || update.isPending;

  const change = async (changes: ReportChanges) => {
    setFailure(null);
    try {
      await update.mutateAsync({ id: report.id, lockVersion: report.lockVersion, changes });
    } catch (error) {
      setFailure(error);
    }
  };

  const toggleSection = (section: Section, checked: boolean) => {
    const next = SECTIONS.filter((candidate) => (candidate === section ? checked : report.sections.includes(candidate)));
    void change({ sections: next });
  };

  return (
    <Card role="region" aria-label="Contenu et options" className="gap-3">
      <h2 className="text-block-title text-fg">Contenu et options</h2>
      <fieldset className="flex min-w-0 flex-col gap-1.5 border-0 p-0" disabled={locked}>
        <legend className="mb-1 p-0 text-caption text-fg-muted">Sections du compte rendu</legend>
        {SECTIONS.map((section) => {
          const checked = report.sections.includes(section);
          return (
            <Checkbox
              key={section}
              label={sectionLabel[section]}
              checked={checked}
              disabled={locked || (checked && report.sections.length === 1)}
              onChange={(event) => { toggleSection(section, event.target.checked); }}
            />
          );
        })}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Switch label="Papier à en-tête" checked={report.options.letterhead} disabled={locked} onCheckedChange={(value) => { void change({ options: { letterhead: value } }); }} />
        <Switch label="Détail des relances" checked={report.options.reminderDetail} disabled={locked} onCheckedChange={(value) => { void change({ options: { reminderDetail: value } }); }} />
        <Switch label="Prévenir le mandant à la publication" checked={report.notify} disabled={locked} onCheckedChange={(value) => { void change({ notify: value }); }} />
      </div>
      {failure === null ? null : <ActionError title="Modification non enregistrée" error={failure} />}
      <RoleNotice>
        {editable
          ? 'L’assemblage des quittances jointes n’est pas encore disponible : seule la liste des quittances est incluse.'
          : 'Ce compte rendu n’est plus modifiable.'}
      </RoleNotice>
    </Card>
  );
}
