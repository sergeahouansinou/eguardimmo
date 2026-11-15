'use client';

import { Button, Card, CardTitle, Checkbox, Select, TextField, Textarea } from '@eguardimmo/ui';
import { useInviteCandidate, useUnits } from './hooks';
import { PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from './kit';
import { useZodForm } from './kit/useZodForm';
import { locatairesPaths } from './paths';
import { REQUESTED_DOCUMENTS, candidateInviteSchema, unitFullLabel } from './schemas';

export function CandidatInvitePage() {
  const { push, search } = useGestionNavigation();
  const notify = useNotify();
  const units = useUnits();
  const invite = useInviteCandidate();
  const form = useZodForm(candidateInviteSchema, {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    unitId: search.get('bien') ?? '',
    message: '',
    requestedDocuments: [REQUESTED_DOCUMENTS[0], REQUESTED_DOCUMENTS[1]] as string[],
  });

  const submit = async () => {
    const values = form.submit();
    if (!values) return;
    const message = values.message.trim() === '' ? `Bonjour ${values.firstName}, voici le lien pour déposer votre dossier.` : values.message;
    try {
      await invite.mutateAsync({ ...values, message });
      noticeAfterNavigation({ title: 'Invitation envoyée', description: `${values.firstName} ${values.lastName} recevra un lien à ${values.email}.` });
      push(locatairesPaths.candidates);
    } catch (error) {
      notify({ tone: 'danger', title: 'Invitation impossible', description: errorMessage(error) });
    }
  };

  const toggleDocument = (name: string, checked: boolean) => {
    const current = form.values.requestedDocuments;
    form.setValue('requestedDocuments', checked ? [...current, name] : current.filter((entry) => entry !== name));
  };

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <PageHeader
        crumbs={[{ label: 'Candidats', href: locatairesPaths.candidates }, { label: 'Inviter un candidat' }]}
        title="Inviter un candidat"
        subtitle="Le candidat reçoit un lien pour déposer son dossier. Il ne voit que le bien concerné."
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="group" aria-labelledby="ci-f" className="gap-3">
          <CardTitle as="h2" id="ci-f">Candidat</CardTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Prénom *" placeholder="Ex. Léa" value={form.values.firstName} error={form.error('firstName')} onChange={(event) => { form.setValue('firstName', event.target.value); }} onBlur={() => { form.touch('firstName'); }} />
            <TextField label="Nom *" placeholder="Ex. Martin" value={form.values.lastName} error={form.error('lastName')} onChange={(event) => { form.setValue('lastName', event.target.value); }} onBlur={() => { form.touch('lastName'); }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="E-mail *" type="email" placeholder="lea.martin@example.com" value={form.values.email} error={form.error('email')} onChange={(event) => { form.setValue('email', event.target.value); }} onBlur={() => { form.touch('email'); }} />
            <TextField label="Téléphone" type="tel" placeholder="+33 6 11 22 33 44" value={form.values.phone} error={form.error('phone')} onChange={(event) => { form.setValue('phone', event.target.value); }} onBlur={() => { form.touch('phone'); }} />
          </div>
          <Select
            label="Bien concerné *"
            placeholder="Choisir un bien"
            searchable
            value={form.values.unitId}
            error={form.error('unitId')}
            onValueChange={(value) => { form.setValue('unitId', value); }}
            options={(units.data ?? []).map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))}
          />
          <Textarea label="Message d’accompagnement" placeholder="Bonjour Léa, voici le lien pour déposer votre dossier." value={form.values.message} onChange={(event) => { form.setValue('message', event.target.value); }} />
        </Card>
        <Card role="group" aria-labelledby="ci-d" className="gap-3">
          <CardTitle as="h2" id="ci-d">Pièces demandées</CardTitle>
          {REQUESTED_DOCUMENTS.map((name) => (
            <Checkbox key={name} label={name} checked={form.values.requestedDocuments.includes(name)} onChange={(event) => { toggleDocument(name, event.target.checked); }} />
          ))}
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { push(locatairesPaths.candidates); }}>Annuler</Button>
        <Button type="submit" loading={invite.isPending}>Envoyer l’invitation</Button>
      </div>
    </form>
  );
}
