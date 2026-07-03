export interface AdminAccessPayload {
  sub: number;
  tokenType: 'access';
}

export interface AdminRefreshPayload {
  sub: number;
  tokenType: 'refresh';
}

export interface AdminTwoFactorPendingPayload {
  sub: number;
  tokenType: 'two_factor_pending';
}

export interface CustomerAccessPayload {
  sub: number;
  tokenType: 'access';
}

export interface CustomerRefreshPayload {
  sub: number;
  tokenType: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
