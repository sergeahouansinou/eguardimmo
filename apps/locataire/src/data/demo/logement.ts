import { addDays, addMonths, formatDate, formatWeekdayDate, yearOf } from '@/lib/dates';
import { SourceError } from '../errors';
import type { DemoState } from '../demoState';
import { INTERVENTION_TYPES, interventionInputSchema, rescheduleInputSchema } from '../schemas/interventions';
import type { Intervention, InterventionInput, RescheduleInput } from '../schemas/interventions';
import { NOTICE_REASONS, attestationInputSchema, noticeInputSchema } from '../schemas/logement';
import type { Attestation, AttestationInput, NoticeInput } from '../schemas/logement';
import { pad4, run } from './run';

const EXTENSIONS: Record<AttestationInput['fileType'], string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

export function logementOps(state: DemoState) {
  return {
    lease: () => run(() => state.lease),
    inspections: () => run(() => state.inspections),
    documents: () => run(() => state.documents),
    attestations: () => run(() => state.attestations),
    interventions: () => run(() => state.interventions),
    giveNotice: (input: NoticeInput) =>
      run(() => {
        const values = noticeInputSchema.parse(input);
        if (state.lease.status === 'conge_donne') throw new SourceError('etat_invalide', 'Un congé a déjà été envoyé.');
        const earliest = addMonths(state.today, state.lease.noticeMonths);
        if (values.departureOn < earliest) {
          throw new SourceError('donnees_invalides', `Le départ est possible au plus tôt le ${formatDate(earliest)}.`);
        }
        const reason = NOTICE_REASONS.find((candidate) => candidate.value === values.reason)?.label ?? 'Non précisé';
        state.lease.status = 'conge_donne';
        state.lease.notice = {
          reference: 'CG-2026-0042',
          sentOn: state.today,
          departureOn: values.departureOn,
          reason,
        };
        const exit = state.inspections.find((candidate) => candidate.kind === 'sortie');
        if (exit) {
          exit.status = 'propose';
          exit.caption = 'Proposé par Gestion Les Tilleuls avant votre départ';
        }
        return state.lease;
      }),
    createIntervention: (input: InterventionInput) =>
      run(() => {
        const values = interventionInputSchema.parse(input);
        const type = INTERVENTION_TYPES.find((candidate) => candidate.value === values.type);
        if (!type) throw new SourceError('donnees_invalides', 'Type de problème inconnu.');
        const intervention: Intervention = {
          id: `INT-${String(yearOf(state.today))}-${pad4(state.nextInterventionNumber)}`,
          title: values.title,
          typeLabel: type.label,
          room: values.room,
          description: values.description,
          urgency: values.urgency,
          status: 'signalee',
          reportedAt: state.now,
          photos: values.photos,
          availability: values.availability,
          appointment: null,
          mandatedOn: null,
          timeline: [
            {
              label: 'Signalement envoyé',
              detail: `${formatDate(state.today)}, ${state.now.slice(11, 16)}${values.photos.length > 0 ? ' · photos jointes' : ''}`,
              state: 'done',
            },
            { label: 'Prise en compte par Gestion Les Tilleuls', detail: 'En attente du gestionnaire', state: 'next' },
            { label: 'Intervention terminée', detail: 'Après le passage de l’intervenant', state: 'todo' },
          ],
        };
        state.nextInterventionNumber += 1;
        state.interventions.unshift(intervention);
        return intervention;
      }),
    rescheduleIntervention: (input: RescheduleInput) =>
      run(() => {
        const values = rescheduleInputSchema.parse(input);
        const intervention = state.interventions.find((candidate) => candidate.id === values.id);
        if (!intervention?.appointment) throw new SourceError('introuvable', 'Aucun rendez-vous à modifier.');
        if (values.date < addDays(state.today, 1)) {
          throw new SourceError('donnees_invalides', 'Le rendez-vous doit être fixé à partir de demain.');
        }
        intervention.appointment = { ...intervention.appointment, date: values.date, slot: values.slot };
        const step = intervention.timeline.find((candidate) => candidate.label === 'Rendez-vous prévu');
        if (step) step.detail = `${formatWeekdayDate(values.date)}, de ${values.slot}`;
        return intervention;
      }),
    depositAttestation: (input: AttestationInput) =>
      run(() => {
        const values = attestationInputSchema.parse(input);
        const label = `Attestation ${String(yearOf(values.startOn))}-${String(yearOf(values.endOn))}`;
        const attestation: Attestation = {
          id: `${label.toLowerCase().replace(/ /g, '-')}-${String(state.nextAttestationNumber)}`,
          label,
          insurer: values.insurer,
          contractNumber: values.contractNumber.toUpperCase(),
          startOn: values.startOn,
          endOn: values.endOn,
          guarantees: 'Risques locatifs inclus',
          depositedOn: state.today,
          fileName: values.fileName,
        };
        state.attestations.unshift(attestation);
        state.documents.push({
          id: `attestation-d-assurance-${String(state.nextAttestationNumber)}`,
          name: "Attestation d'assurance",
          category: 'Assurance',
          group: 'autres',
          issuedOn: state.today,
          sizeBytes: values.fileSize,
          detail: `${EXTENSIONS[values.fileType]} · ${formatDate(state.today)}`,
          homeDetail: null,
          href: '/assurance',
        });
        state.nextAttestationNumber += 1;
        return attestation;
      }),
  };
}
