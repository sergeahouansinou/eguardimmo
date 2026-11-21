import type { InterventionVisit, TenantIntervention } from './interventionModel';
import type { ApiIntervention } from './interventionSchemas';

type ApiVisit = ApiIntervention['visits'][number];

const toVisit = (visit: ApiVisit): InterventionVisit => ({
  id: visit.id,
  scheduledOn: visit.scheduled_on,
  slot: visit.slot,
  presenceRequired: visit.presence_required,
  status: visit.status,
  requestedOn: visit.requested_on,
  requestedSlot: visit.requested_slot,
  contactName: visit.contact_name,
  contactPhone: visit.contact_phone,
});

export function toIntervention(item: ApiIntervention): TenantIntervention {
  return {
    id: item.id,
    reference: item.reference,
    state: item.state,
    nature: item.nature,
    title: item.title,
    description: item.description,
    room: item.room,
    availability: item.availability,
    reportedUrgency: item.reported_urgency,
    place: item.place,
    reportedOn: item.reported_on,
    decline: item.decline,
    completedOn: item.completed_on,
    visits: item.visits.map(toVisit),
    cancellable: item.cancellable,
    events: item.events?.map((event) => ({ id: event.id, kind: event.kind, author: event.author, text: event.text, createdAt: event.created_at })) ?? null,
    files: item.files?.map((file) => ({ id: file.id, kind: file.kind, uploadedBy: file.uploaded_by, createdAt: file.created_at })) ?? null,
  };
}
