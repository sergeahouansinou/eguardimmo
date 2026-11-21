export const recoveryPaths = {
  unpaid: '/finances/impayes',
  cases: '/finances/recouvrement',
  case: (id: string) => `/finances/recouvrement/${id}`,
};
