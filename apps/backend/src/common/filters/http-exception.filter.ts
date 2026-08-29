import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '@amader/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    // Some framework-level errors carry a real HTTP status without being an
    // HttpException instance — body-parser's PayloadTooLargeError (413) is
    // the one that's actually bitten us (see main.ts's body size limit
    // comment): it has a numeric `.status`, but isn't `instanceof
    // HttpException`, so without this check it fell into the generic 500
    // branch below and reported "Internal server error" for what was really
    // a 413 with a perfectly clear cause.
    const frameworkStatus =
      !isHttp &&
      exception &&
      typeof exception === 'object' &&
      'status' in exception &&
      typeof (exception as { status: unknown }).status === 'number'
        ? (exception as { status: number }).status
        : undefined;
    const status = isHttp
      ? exception.getStatus()
      : (frameworkStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const httpResponse = isHttp ? exception.getResponse() : undefined;

    const message =
      isHttp &&
      typeof httpResponse === 'object' &&
      httpResponse &&
      'message' in httpResponse
        ? (httpResponse as { message: string | string[] }).message
        : isHttp
          ? exception.message
          : frameworkStatus !== undefined && exception instanceof Error
            ? exception.message
            : 'Internal server error';

    // Carries structured, non-secret extras (e.g. the Blocker Manager's
    // popup heading/sub/contacts) through to the client alongside the flat
    // message — every existing caller that only reads `.message` keeps
    // working unchanged.
    const details =
      isHttp && typeof httpResponse === 'object' && httpResponse && 'details' in httpResponse
        ? (httpResponse as { details?: unknown }).details
        : undefined;

    if (!isHttp) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const flatMessage = Array.isArray(message) ? message.join(', ') : message;

    // Nest's built-in route-not-found handler throws a NotFoundException whose
    // message echoes the method and full path ("Cannot POST /api/v1/customers/
    // login"), leaking the internal /api/v1 route layout to anyone probing.
    // Only that framework-generated echo is replaced — real application 404s
    // (e.g. "Product not found") carry a custom message and are left intact.
    const safeMessage =
      status === HttpStatus.NOT_FOUND &&
      typeof flatMessage === 'string' &&
      /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(flatMessage)
        ? 'Not Found'
        : flatMessage;

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: HttpStatus[status] ?? String(status),
        message: safeMessage,
        ...(details !== undefined ? { details } : {}),
      },
    };

    response.status(status).json(body);
  }
}
