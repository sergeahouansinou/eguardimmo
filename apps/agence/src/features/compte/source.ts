export interface CompteSource {
  profile: () => Promise<unknown>;
  saveProfile: (input: unknown) => Promise<unknown>;
  exportData: () => Promise<unknown>;
  security: () => Promise<unknown>;
  saveSecurityRules: (input: unknown) => Promise<unknown>;
  changePassword: (input: unknown) => Promise<unknown>;
  signOutDevice: (deviceId: string) => Promise<unknown>;
  notifications: () => Promise<unknown>;
  saveNotifications: (input: unknown) => Promise<unknown>;
  subscription: () => Promise<unknown>;
  changePlan: (input: unknown) => Promise<unknown>;
  addPaymentMethod: (input: unknown) => Promise<unknown>;
  removePaymentMethod: (methodId: string) => Promise<unknown>;
  saveBilling: (input: unknown) => Promise<unknown>;
}
