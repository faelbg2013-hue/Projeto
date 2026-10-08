import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@ravion/types';
import { readRequestId } from '../http/request-id';
import { redactSensitiveText } from '../logger/redact';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const body = this.toErrorBody(exception);

    const internalMessage = exception instanceof Error ? exception.message : 'Unknown error';
    const requestId = readRequestId(response);
    this.logger.error(
      `${requestId} ${request.method} ${request.path} ${body.statusCode} ${redactSensitiveText(internalMessage)}`,
    );

    if (!(exception instanceof HttpException) && exception instanceof Error && exception.stack) {
      this.logger.error(redactSensitiveText(exception.stack));
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
      error: 'Internal Server Error',
    };
  }

  private fromHttpException(exception: HttpException): ApiErrorBody {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    let message = exception.message;
    let error = statusText(statusCode);

    if (typeof response === 'string') {
      message = response;
    } else if (typeof response === 'object' && response !== null) {
      const payload = response as { message?: unknown; error?: unknown };
      if (Array.isArray(payload.message)) {
        message = payload.message.map((item) => String(item)).join('; ');
      } else if (typeof payload.message === 'string') {
        message = payload.message;
      }
      if (typeof payload.error === 'string') {
        error = payload.error;
      }
    }

    if (statusCode === HttpStatus.NOT_FOUND && message.startsWith('Cannot ')) {
      message = 'Rota não encontrada';
    }

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'Muitas requisições. Tente novamente em instantes.';
    }

    if (this.isProduction && statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Erro interno do servidor';
    }

    return {
      statusCode,
      message: redactSensitiveText(message),
      error,
    };
  }
}

function statusText(statusCode: number): string {
  const raw = HttpStatus[statusCode];
  if (typeof raw !== 'string') {
    return 'Error';
  }

  return raw
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
