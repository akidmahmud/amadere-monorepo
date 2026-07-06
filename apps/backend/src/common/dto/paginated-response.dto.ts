import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

// Every list endpoint returns PaginatedResult<T> ({ items, total, page,
// pageSize } — common/pagination.util.ts). Swagger can't express a generic
// at runtime, so this builds the { items: T[], total, page, pageSize }
// schema by hand from whatever item DTO class is passed in.
export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              pageSize: { type: 'number' },
            },
          },
        ],
      },
    }),
  );
}
