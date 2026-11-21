export const IDS = {
  org: '01a1e544-3c72-70ab-999c-456ddcfeddf3',
  party: '01a1e544-3c81-7271-9be9-e27ad46d4aa7',
  partyNoEmail: '01a1e544-3c82-7271-9be9-e27ad46d4aa8',
};

const problem = (status: number, code: string, title: string, detail: string) => ({ type: `https://api.eguardimmo.test/problems/${code}`, title, status, detail, code, request_id: '01a1e544-3e7f-7232-9752-e4e20f308fdd' });

export const accessNone = { data: { party_id: IDS.party, status: 'none', email_hint: null, expires_at: null, linked_at: null } };
export const accessInvited = { data: { party_id: IDS.party, status: 'invited', email_hint: 'd***@example.com', expires_at: '2026-11-30T10:00:00+00:00', linked_at: null } };
export const accessLinked = { data: { party_id: IDS.party, status: 'linked', email_hint: 'd***@example.com', expires_at: null, linked_at: '2026-11-10T09:30:00+00:00' } };

export const partyPage = {
  data: [
    { id: IDS.party, kind: 'person', display_name: 'Danielle Martin', primary_email: 'danielle.martin@example.com', primary_phone: null, is_anonymized: false, archived_at: null },
    { id: IDS.partyNoEmail, kind: 'person', display_name: 'Yann Le Gall', primary_email: null, primary_phone: null, is_anonymized: false, archived_at: null },
    { id: '01a1e544-3c83-7271-9be9-e27ad46d4aa9', kind: 'person', display_name: 'Contact archivé', primary_email: null, primary_phone: null, is_anonymized: false, archived_at: '2026-10-01T00:00:00+00:00' },
  ],
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: `https://api.eguardimmo.test/api/v1/org/${IDS.org}/parties`, per_page: 20, next_cursor: null, prev_cursor: null },
};

export const problemEmailRequired = problem(422, 'tenant_access_email_required', 'Adresse e-mail requise', 'Indiquez l\'adresse e-mail à inviter : ce contact n\'a pas d\'e-mail principal.');
export const problemAlreadyLinked = problem(409, 'party_already_linked', 'Contact déjà rattaché', 'Ce contact est déjà rattaché à un compte : révoquez l\'accès avant d\'en inviter un autre.');
export const problemNotFound = problem(404, 'tenant_access_not_found', 'Accès introuvable', 'Aucune invitation ni aucun accès pour ce contact.');
export const problemForbidden = problem(403, 'role_forbidden', 'Action réservée', 'Votre rôle ne permet pas cette action.');
export const problemInvalidEmail = { ...problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.'), errors: { email: ['validation.email'] } };
