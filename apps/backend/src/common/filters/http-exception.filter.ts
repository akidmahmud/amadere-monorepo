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
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const httpResponse = isHttp ? exception.getResponse() : undefined;

    const message =
      isHttp &&
      typeof httpResponse === 'object' &&
      httpResponse &&
      'message' in httpResponse
        ? (httpResponse as { message: string | string[] }).message
        : isHttp
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

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: HttpStatus[status] ?? String(status),
        message: Array.isArray(message) ? message.join(', ') : message,
        ...(details !== undefined ? { details } : {}),
      },
    };

    response.status(status).json(body);
  }
}
