import type { Invoice, Profile, Subscription } from './schemas';

export const demoProfile: Profile = {
  form: {
    landlordType: 'particulier',
    civility: 'mme',
    firstName: 'Awa',
    lastName: 'Diallo',
    birthDate: '02/06/1979',
    birthPlace: '',
    companyName: '',
    siren: '',
    vatNumber: '',
    phone: '+33 6 00 00 00 09',
    address: '12 rue des Lilas, 75011 Paris',
  },
  email: 'awa.diallo@example.com',
  security: { passwordChangedAt: '2026-09-02', twoFactorMethod: 'Code par application', twoFactorEnabled: true, sessions: 2 },
};

export const demoSubscription: Subscription = {
  planId: 'essentiel',
  billing: 'mensuel',
  nextChargeDate: '2026-12-01',
  cancelAt: null,
  paymentMethod: { brand: 'Visa', last4: '4242' },
  usage: { lots: 11, users: 2, signatures: 8, storageMb: 1_200 },
};

export const demoInvoices: Invoice[] = Array.from({ length: 11 }, (_, index) => {
  const number = 11 - index;
  return {
    id: `FA-2026-${String(number).padStart(4, '0')}`,
    date: `2026-${String(number).padStart(2, '0')}-01`,
    amount: 990,
    status: 'payee' as const,
    planId: 'essentiel' as const,
    billing: 'mensuel' as const,
  };
});
