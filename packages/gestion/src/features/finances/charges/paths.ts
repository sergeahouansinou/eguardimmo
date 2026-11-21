export const chargesPaths = {
  expenses: '/finances/depenses',
  expenseNew: '/finances/depenses/nouvelle',
  expense: (id: string) => `/finances/depenses/${encodeURIComponent(id)}`,
  exercises: '/finances/charges',
  exerciseNew: '/finances/charges/nouveau',
  exercise: (id: string) => `/finances/charges/${encodeURIComponent(id)}`,
  statement: (id: string) => `/finances/charges/decomptes/${encodeURIComponent(id)}`,
  keys: '/finances/charges/cles',
  keysOf: (propertyId: string) => `/finances/charges/cles?bien=${encodeURIComponent(propertyId)}`,
  lease: (id: string) => `/baux/${encodeURIComponent(id)}`,
  security: '/compte/securite',
};
