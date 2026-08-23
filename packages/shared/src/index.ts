export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export * from './permission-catalog';
export * from './url-paths';
export * from './courier-status';
export * from './bd-geo';
// image-derivatives is NOT re-exported here on purpose — it pulls in
// `sharp` (a native Node binary), and this barrel is imported by client
// components too (e.g. RichTextEditor's font picker uses ckeditor-fonts.ts
// from this same file). Bundling sharp into a browser build fails outright
// (its detect-libc dependency needs Node's `child_process`). Server-only
// consumers import `@amader/shared/image-derivatives` directly instead.
export * from './bd-thanas';
export * from './phone';
export * from './ckeditor-fonts';
export * from './footer';
export * from './shipping-zones';
export * from './digital-products';
export * from './authors';
export * from './accounts-math';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
