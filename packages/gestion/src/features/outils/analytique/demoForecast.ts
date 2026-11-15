import { euros } from '../kit/demoClock';
import type { Forecast } from './schemas';

export const REFERENCE_IRL_BP = 326;

export const FORECAST: Forecast = {
  startMonth: '2026-12',
  referenceIrlBp: REFERENCE_IRL_BP,
  irlBp: REFERENCE_IRL_BP,
  growthBp: 200,
  oneOff: [700, 760, 670, 820, 690, 740, 660, 790, 680, 3020, 700, 720].map(euros),
  buildings: [
    {
      buildingId: 'les-tilleuls',
      baseRent: euros(2400),
      recurring: euros(200),
      loan: euros(300),
      openingCash: euros(4000),
      oneOffWeight: 50,
      irl: [
        { index: 5, delta: euros(10) },
        { index: 6, delta: euros(20) },
        { index: 11, delta: euros(30) },
      ],
      vacancies: [{ lotId: 'lot-b3', fromIndex: 0, toIndex: 1, rent: euros(390) }],
      other: [{ index: 1, amount: euros(120) }],
      reference: { inflows: euros(27400), outflows: euros(11100), balance: euros(15900) },
    },
    {
      buildingId: 'maison-riviere',
      baseRent: euros(1340),
      recurring: euros(130),
      loan: euros(200),
      openingCash: euros(2400),
      oneOffWeight: 30,
      irl: [
        { index: 5, delta: euros(20) },
        { index: 6, delta: euros(20) },
        { index: 11, delta: euros(20) },
      ],
      vacancies: [],
      other: [],
      reference: { inflows: euros(15600), outflows: euros(7000), balance: euros(9000) },
    },
    {
      buildingId: 'residence-du-parc',
      baseRent: euros(1210),
      recurring: euros(90),
      loan: euros(140),
      openingCash: euros(1800),
      oneOffWeight: 20,
      irl: [],
      vacancies: [],
      other: [],
      reference: { inflows: euros(14017), outflows: euros(5015), balance: euros(8625) },
    },
  ],
};
