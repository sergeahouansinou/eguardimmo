import { describe, expect, it } from 'vitest';
import { createDemoSource } from './demoSource';
import { DEMO_CONFIRMATION_CODE } from './demo/compte';
import { chargesSchema, installmentSchema, mandateSchema, paymentSchema, receiptSchema } from './schemas/loyers';
import { interventionSchema } from './schemas/interventions';
import { attestationSchema, documentSchema, inspectionSchema, leaseSchema } from './schemas/logement';
import { homeSchema, preferenceSchema, profileSchema, securitySchema } from './schemas/compte';
import { shellSchema } from '@eguardimmo/shell';
import { z } from 'zod';

const validProfile = {
  firstName: 'Koffi',
  lastName: 'Adjovi',
  profession: 'Ingénieur',
  mobile: '+33 6 00 00 00 01',
  email: 'koffi.adjovi@example.com',
  bankHolder: 'Koffi Adjovi',
  photoName: null,
};

describe('source de démonstration : cohérence des données', () => {
  it('toutes les lectures respectent leur schéma', async () => {
    const source = createDemoSource();
    z.array(installmentSchema).parse(await source.installments());
    leaseSchema.parse(await source.lease());
    chargesSchema.parse(await source.charges());
    mandateSchema.parse(await source.mandate());
    z.array(inspectionSchema).parse(await source.inspections());
    z.array(documentSchema).parse(await source.documents());
    z.array(interventionSchema).parse(await source.interventions());
    z.array(attestationSchema).parse(await source.attestations());
    profileSchema.parse(await source.profile());
    z.array(preferenceSchema).parse(await source.preferences());
    securitySchema.parse(await source.security());
    homeSchema.parse(await source.home());
    receiptSchema.parse(await source.receipt('QT-2026-0398'));
    paymentSchema.parse(await source.payment('PAY-2026-0930'));
  });

  it('renvoie null pour un paiement ou une quittance inconnus', async () => {
    const source = createDemoSource();
    expect(await source.payment('PAY-2000-0001')).toBeNull();
    expect(await source.receipt('QT-2000-0001')).toBeNull();
  });

  it('chaque lecture renvoie une copie : modifier le résultat ne change pas la source', async () => {
    const source = createDemoSource();
    const first = installmentSchema.array().parse(await source.installments());
    const target = first.find((item) => item.status === 'impaye');
    if (target) target.status = 'paye';
    const second = installmentSchema.array().parse(await source.installments());
    expect(second.find((item) => item.status === 'impaye')?.id).toBe('2026-11');
  });
});

describe('source de démonstration : paiement', () => {
  it('le paiement par carte réussi règle l’échéance et crée la quittance', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    expect(started).toMatchObject({ id: 'PAY-2026-0931', status: 'en_cours', amountCents: 85000 });

    const done = paymentSchema.parse(await source.resolvePayment({ paymentId: started.id, outcome: 'reussi' }));
    expect(done.status).toBe('reussi');
    expect(done.receiptId).toBe('QT-2026-0399');

    const november = installmentSchema.array().parse(await source.installments()).find((item) => item.id === '2026-11');
    expect(november).toMatchObject({ status: 'paye', paymentId: 'PAY-2026-0931', receiptId: 'QT-2026-0399' });
    expect(receiptSchema.parse(await source.receipt('QT-2026-0399')).installmentId).toBe('2026-11');
  });

  it('le virement passe en attente puis se règle à la réception des fonds', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'virement' }));
    const pending = paymentSchema.parse(await source.resolvePayment({ paymentId: started.id, outcome: 'reussi' }));
    expect(pending.status).toBe('en_attente');
    expect(installmentSchema.array().parse(await source.installments()).find((item) => item.id === '2026-11')?.status).toBe('en_attente');

    const settled = paymentSchema.parse(await source.settlePayment(started.id));
    expect(settled.status).toBe('reussi');
    expect(settled.receiptId).toBe('QT-2026-0399');
  });

  it('un échec laisse l’échéance impayée et indique la raison', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    const failed = paymentSchema.parse(await source.resolvePayment({ paymentId: started.id, outcome: 'echoue' }));
    expect(failed.status).toBe('echoue');
    expect(failed.failureReason).not.toBeNull();
    expect(installmentSchema.array().parse(await source.installments()).find((item) => item.id === '2026-11')?.status).toBe('impaye');
  });

  it('une annulation laisse l’échéance impayée', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    const cancelled = paymentSchema.parse(await source.resolvePayment({ paymentId: started.id, outcome: 'annule' }));
    expect(cancelled.status).toBe('annule');
    expect(installmentSchema.array().parse(await source.installments()).find((item) => item.id === '2026-11')?.status).toBe('impaye');
  });

  it('refuse de régler deux fois un paiement déjà résolu (idempotence)', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    await source.resolvePayment({ paymentId: started.id, outcome: 'reussi' });
    await expect(source.resolvePayment({ paymentId: started.id, outcome: 'reussi' })).rejects.toThrow('plus dans l’état attendu');
    await expect(source.settlePayment(started.id)).rejects.toThrow();
  });

  it('refuse de payer une échéance déjà payée ou à venir', async () => {
    const source = createDemoSource();
    await expect(source.startPayment({ installmentId: '2026-10', method: 'carte' })).rejects.toThrow('pas à régler');
    await expect(source.startPayment({ installmentId: '2026-12', method: 'carte' })).rejects.toThrow('pas à régler');
  });

  it('refuse le prélèvement sans mandat actif', async () => {
    const source = createDemoSource();
    await expect(source.startPayment({ installmentId: '2026-11', method: 'prelevement' })).rejects.toThrow('mandat');
  });

  it('un nouveau paiement annule le précédent encore en cours', async () => {
    const source = createDemoSource();
    const first = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    await source.startPayment({ installmentId: '2026-11', method: 'virement' });
    expect(paymentSchema.nullable().parse(await source.payment(first.id))?.status).toBe('annule');
  });

  it('ajoute une notification de paiement reçu', async () => {
    const source = createDemoSource();
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'carte' }));
    await source.resolvePayment({ paymentId: started.id, outcome: 'reussi' });
    const shell = shellSchema.parse(await source.shell());
    expect(shell.notifications[0]).toMatchObject({ title: 'Paiement reçu', unread: true, href: '/loyers/quittances/QT-2026-0399' });
    expect(shell.counts.loyers).toBe(0);
  });
});

describe('source de démonstration : mandat SEPA', () => {
  const input = { holder: 'Koffi Adjovi', iban: 'FR76 3000 6000 0112 3456 7890 189', authorize: true as const, confirmHolder: true as const };

  it('signe le mandat sans conserver l’IBAN complet', async () => {
    const source = createDemoSource();
    const mandate = mandateSchema.parse(await source.signMandate(input));
    expect(mandate.status).toBe('actif');
    expect(mandate.ibanLast4).toBe('0189');
    expect(JSON.stringify(mandate)).not.toContain('3000');
    expect(JSON.stringify(await source.profile())).not.toContain('3000');
  });

  it('refuse un IBAN à la clé invalide', async () => {
    const source = createDemoSource();
    await expect(source.signMandate({ ...input, iban: 'FR77 3000 6000 0112 3456 7890 189' })).rejects.toThrow();
    expect(mandateSchema.parse(await source.mandate()).status).not.toBe('actif');
  });

  it('autorise le prélèvement une fois le mandat actif, et le refuse après révocation', async () => {
    const source = createDemoSource();
    await source.signMandate(input);
    const started = paymentSchema.parse(await source.startPayment({ installmentId: '2026-11', method: 'prelevement' }));
    expect(started.method).toBe('prelevement');
    expect(mandateSchema.parse(await source.revokeMandate()).status).toBe('revoque');
    await expect(source.startPayment({ installmentId: '2026-11', method: 'prelevement' })).rejects.toThrow('mandat');
  });

  it('refuse de révoquer un mandat qui n’est pas actif', async () => {
    await expect(createDemoSource().revokeMandate()).rejects.toThrow('Aucun mandat actif');
  });
});

describe('source de démonstration : bail et logement', () => {
  const notice = { departureOn: '2027-01-31', reason: '', street: '22 avenue Jean Jaurès', postalCode: '69007', city: 'Lyon', confirm: true as const };

  it('enregistre le congé et propose l’état des lieux de sortie', async () => {
    const source = createDemoSource();
    const lease = leaseSchema.parse(await source.giveNotice(notice));
    expect(lease.status).toBe('conge_donne');
    expect(lease.notice).toMatchObject({ sentOn: '2026-11-13', departureOn: '2027-01-31' });
    const exit = z.array(inspectionSchema).parse(await source.inspections()).find((item) => item.kind === 'sortie');
    expect(exit?.status).toBe('propose');
  });

  it('refuse un départ avant la fin du préavis', async () => {
    await expect(createDemoSource().giveNotice({ ...notice, departureOn: '2026-12-01' })).rejects.toThrow('au plus tôt le 13/12/2026');
  });

  it('refuse un second congé', async () => {
    const source = createDemoSource();
    await source.giveNotice(notice);
    await expect(source.giveNotice(notice)).rejects.toThrow('déjà été envoyé');
  });

  it('crée un signalement en tête de liste avec un identifiant incrémenté', async () => {
    const source = createDemoSource();
    const created = interventionSchema.parse(
      await source.createIntervention({
        type: 'plomberie',
        room: 'Cuisine',
        title: 'Fuite sous l’évier',
        description: 'Le siphon goutte.',
        urgency: 'rapide',
        availability: 'Le matin',
        photos: ['fuite.jpg'],
      }),
    );
    expect(created).toMatchObject({ id: 'INT-2026-0148', status: 'signalee' });
    const list = z.array(interventionSchema).parse(await source.interventions());
    expect(list[0]?.id).toBe('INT-2026-0148');
    expect((shellSchema.parse(await source.shell())).counts.interventions).toBe(2);
  });

  it('refuse un signalement sans description', async () => {
    await expect(
      createDemoSource().createIntervention({ type: 'plomberie', room: 'Cuisine', title: 'Fuite', description: ' ', urgency: 'rapide', availability: '', photos: [] }),
    ).rejects.toThrow();
  });

  it('déplace un rendez-vous à une date future et refuse une date passée', async () => {
    const source = createDemoSource();
    const moved = interventionSchema.parse(await source.rescheduleIntervention({ id: 'INT-2026-0147', date: '2026-11-20', slot: '14 h à 17 h' }));
    expect(moved.appointment).toMatchObject({ date: '2026-11-20', slot: '14 h à 17 h' });
    await expect(source.rescheduleIntervention({ id: 'INT-2026-0147', date: '2026-11-13', slot: '9 h à 12 h' })).rejects.toThrow('à partir de demain');
    await expect(source.rescheduleIntervention({ id: 'INT-0000', date: '2026-11-20', slot: '9 h à 12 h' })).rejects.toThrow('Aucun rendez-vous');
  });

  it('dépose une attestation et l’ajoute aux documents', async () => {
    const source = createDemoSource();
    const before = z.array(documentSchema).parse(await source.documents()).length;
    const deposited = attestationSchema.parse(
      await source.depositAttestation({
        insurer: 'MAIF',
        contractNumber: 'hab-2027-884',
        startOn: '2027-04-01',
        endOn: '2028-03-31',
        fileName: 'attestation.pdf',
        fileSize: 120_000,
        fileType: 'application/pdf',
      }),
    );
    expect(deposited.contractNumber).toBe('HAB-2027-884');
    expect(z.array(attestationSchema).parse(await source.attestations())[0]?.id).toBe(deposited.id);
    expect(z.array(documentSchema).parse(await source.documents())).toHaveLength(before + 1);
  });

  it('refuse une attestation dont la fin précède le début ou au format non accepté', async () => {
    const source = createDemoSource();
    const base = { insurer: 'MAIF', contractNumber: 'HAB-1234', startOn: '2027-04-01', endOn: '2028-03-31', fileName: 'a.pdf', fileSize: 10, fileType: 'application/pdf' as const };
    await expect(source.depositAttestation({ ...base, endOn: '2027-03-31' })).rejects.toThrow();
    await expect(source.depositAttestation({ ...base, fileSize: 11 * 1024 * 1024 })).rejects.toThrow();
  });
});

describe('source de démonstration : compte', () => {
  it('enregistre le profil sans code quand ni l’e-mail ni le mobile ne changent', async () => {
    const source = createDemoSource();
    const profile = profileSchema.parse(await source.updateProfile({ values: { ...validProfile, profession: 'Architecte' } }));
    expect(profile.profession).toBe('Architecte');
  });

  it('exige le code de confirmation quand l’e-mail change', async () => {
    const source = createDemoSource();
    const values = { ...validProfile, email: 'nouvelle.adresse@example.com' };
    await expect(source.updateProfile({ values })).rejects.toThrow('code de confirmation');
    await expect(source.updateProfile({ values, code: '000000' })).rejects.toThrow('code de confirmation');
    const profile = profileSchema.parse(await source.updateProfile({ values, code: DEMO_CONFIRMATION_CODE }));
    expect(profile.email).toBe('nouvelle.adresse@example.com');
    expect((shellSchema.parse(await source.shell())).user.email).toBe('nouvelle.adresse@example.com');
  });

  it('refuse un profil invalide côté source', async () => {
    await expect(createDemoSource().updateProfile({ values: { ...validProfile, mobile: 'abc' } })).rejects.toThrow();
  });

  it('modifie une préférence et refuse une préférence inconnue', async () => {
    const source = createDemoSource();
    const first = z.array(preferenceSchema).parse(await source.preferences())[0];
    if (!first) throw new Error('aucune préférence');
    const updated = z.array(preferenceSchema).parse(await source.setPreference({ id: first.id, channel: 'push', enabled: !first.push }));
    expect(updated.find((item) => item.id === first.id)?.push).toBe(!first.push);
    await expect(source.setPreference({ id: 'inconnue', channel: 'email', enabled: true })).rejects.toThrow('inconnue');
  });

  it('enregistre la demande d’export et marque les notifications comme lues', async () => {
    const source = createDemoSource();
    expect(profileSchema.parse(await source.requestDataExport()).dataExportRequestedOn).toBe('2026-11-13');
    expect((shellSchema.parse(await source.shell())).notifications.some((item) => item.unread)).toBe(true);
    await source.markAllNotificationsRead();
    expect((shellSchema.parse(await source.shell())).notifications.every((item) => !item.unread)).toBe(true);
  });
});
