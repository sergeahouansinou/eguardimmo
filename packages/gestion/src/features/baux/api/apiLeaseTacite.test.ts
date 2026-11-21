import { describe, expect, it } from 'vitest';
import { apiLeaseResponseSchema } from './apiSchemas';
import { toLease } from './apiMapping';
import { leaseSchema } from '../schemas';

const raw = {"data":{"id":"01a1e53a-9db9-70eb-ad6f-04ef2e622e28","reference":"BL-2026-0001","jurisdiction":"FR","regime_key":"fr.residential.unfurnished","status":"signed","phase":"upcoming","starts_on":"2026-12-01","end_date":null,"duration_months":36,"tacit_renewal":true,"periodicity":"monthly","currency":"EUR","main_unit":{"id":"01a1e538-74cb-70e2-956c-5c41b2e530e2","reference":"Appartement A3","property":{"id":"01a1e537-eae8-72e5-aa97-f9ae92e24916","name":"Résidence des Tilleuls"}},"tenants":[{"id":"01a1e538-d8e5-707a-8a40-d0627946cf79","display_name":"Koffi Adjovi","kind":"person","is_anonymized":false}],"lock_version":2,"archived_at":null,"billing_timing":"advance","due_day":5,"payment_method":"transfer","signed_on":"2026-11-16","signed_file_id":null,"notice":null,"jurisdiction_data":{"revision_index":"irl"},"custom_fields":{},"note":null,"units":[{"id":"01a1e53a-9dbc-71e5-ba54-2923ddce9f59","unit":{"id":"01a1e538-74cb-70e2-956c-5c41b2e530e2","reference":"Appartement A3","property":{"id":"01a1e537-eae8-72e5-aa97-f9ae92e24916","name":"Résidence des Tilleuls"}},"is_main":true,"valid_from":"2026-12-01","end_date":null}],"parties":[{"id":"01a1e53a-9dbe-7044-a0a4-227e7560fc8b","party":{"id":"01a1e538-d8e5-707a-8a40-d0627946cf79","display_name":"Koffi Adjovi","kind":"person","is_anonymized":false},"role":"tenant","joint_liability":false,"guarantees_party_id":null,"guarantee":null,"valid_from":"2026-12-01","end_date":null}],"terms":[{"id":"01a1e53a-9dc3-729f-af3c-ff3425004f21","component":{"id":"01a1e535-671d-7301-b9bc-989ac0211c36","key":"rent","label":"Loyer","semantic_key":"rent"},"amount":{"amount":85000,"currency":"EUR"},"vat_bp":0,"indexed":true,"valid_from":"2026-12-01","end_date":null,"in_force":true,"reason":"initial","replaces_id":null},{"id":"01a1e53a-9dc4-700b-a432-9628ab1c9710","component":{"id":"01a1e535-671d-7301-b9bc-989ac0e5656c","key":"charges_provision","label":"Provision sur charges","semantic_key":"charges_provision"},"amount":{"amount":8000,"currency":"EUR"},"vat_bp":0,"indexed":false,"valid_from":"2026-12-01","end_date":null,"in_force":true,"reason":"initial","replaces_id":null},{"id":"01a1e53a-9dc5-7370-8746-88db89f992c3","component":{"id":"01a1e535-671f-7384-b899-728cd35a65b3","key":"deposit","label":"Dépôt de garantie","semantic_key":"deposit"},"amount":{"amount":85000,"currency":"EUR"},"vat_bp":0,"indexed":false,"valid_from":"2026-12-01","end_date":null,"in_force":true,"reason":"initial","replaces_id":null}]}};

describe('bail à reconduction tacite renvoyé par le backend (end_date null)', () => {
  it('dérive la fin théorique de la durée et passe le schéma du formulaire', () => {
    const parsed = apiLeaseResponseSchema.safeParse(raw);
    if (!parsed.success) throw new Error('API: ' + JSON.stringify(parsed.error.issues, null, 1));
    const lease = toLease(parsed.data.data, '2026-11-16');
    const final = leaseSchema.safeParse(lease);
    if (!final.success) throw new Error('LEASE: ' + JSON.stringify(final.error.issues, null, 1) + JSON.stringify(lease));
    expect(final.success).toBe(true);
    expect(lease.end).toBe('2029-11-30');
  });
});
