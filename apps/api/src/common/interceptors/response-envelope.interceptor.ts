import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { map, type Observable } from "rxjs";

export interface ResponseEnvelope<T> {
  success: true;
  data: T;
}

const UNWRAPPED_PATH_PREFIXES = ["/health"];

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, T | ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T | ResponseEnvelope<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const skip = UNWRAPPED_PATH_PREFIXES.some((prefix) => request.url.startsWith(prefix));

    return next.handle().pipe(map((data) => (skip ? data : { success: true, data })));
  }
}
