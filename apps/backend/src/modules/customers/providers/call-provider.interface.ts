export const CALL_PROVIDER = Symbol('CALL_PROVIDER');

export interface CallProvider {
  dial(phoneNumber: string, customerId: number): Promise<{ providerCallId: string }>;
}
