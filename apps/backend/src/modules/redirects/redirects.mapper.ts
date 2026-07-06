import { Redirect } from '@amader/db';

export class RedirectDto {
  id!: number;
  fromPath!: string;
  toPath!: string;
  statusCode!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toRedirectDto(redirect: Redirect): RedirectDto {
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

export class RedirectNotFoundDto {
  redirect!: boolean;
}

export class RedirectFoundDto {
  redirect!: boolean;
  toPath!: string;
  statusCode!: number;
}

export type RedirectResolveResult = RedirectNotFoundDto | RedirectFoundDto;
