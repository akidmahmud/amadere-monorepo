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

export interface BlogPreviewPayload {
  postId: number;
  tokenType: 'blog_preview';
}

export interface ProductPreviewPayload {
  productId: number;
  tokenType: 'product_preview';
}

export class TokenPair {
  accessToken!: string;
  refreshToken!: string;
}

/** Short-lived link that lets the admin see an UNPUBLISHED page layout on the
 *  real storefront. Scoped to one page id, so a token for one page cannot be
 *  reused to read another's draft. */
export interface PagePreviewPayload {
  pageId: number;
  tokenType: 'page_preview';
}
