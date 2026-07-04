import { Redirect } from '@amader/db';

export function toRedirectDto(redirect: Redirect) {
  return {
    id: redirect.id,
    fromPath: redirect.fromPath,
    toPath: redirect.toPath,
    statusCode: redirect.statusCode,
    isActive: redirect.isActive,
    createdAt: redirect.createdAt,
    updatedAt: redirect.updatedAt,
  };
}
