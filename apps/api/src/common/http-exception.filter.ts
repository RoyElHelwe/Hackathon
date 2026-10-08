import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { InvalidTransitionError } from '@tajriba/shared';
import type { Response } from 'express';

/** Friendly JSON errors; never leak stack traces to clients. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res.status(exception.getStatus()).json(typeof body === 'string' ? { message: body } : body);
      return;
    }
    if (exception instanceof InvalidTransitionError) {
      res.status(409).json({ statusCode: 409, message: 'This step is not possible right now.', detail: exception.message });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.message : String(exception), exception instanceof Error ? exception.stack : undefined);
    res.status(500).json({ statusCode: 500, message: 'Something went wrong. Please try again.' });
  }
}
