import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorEnvelope {
  success: false;
  error: {
    statusCode: number;
    message: string;
    path: string;
    timestamp: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception, statusCode);

    const envelope: ErrorEnvelope = {
      success: false,
      error: {
        statusCode,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}: ${message}`);
    }

    response.status(statusCode).json(envelope);
  }

  private extractMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        return body;
      }
      if (typeof body === "object" && body !== null && "message" in body) {
        const { message } = body as { message: string | string[] };
        return Array.isArray(message) ? message.join(", ") : message;
      }
      return exception.message;
    }
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }
    return exception instanceof Error ? exception.message : "Unknown error";
  }
}
