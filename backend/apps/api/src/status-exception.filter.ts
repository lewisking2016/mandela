import { type ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

/**
 * Errors thrown with a numeric `status` property become that HTTP status
 * (parseInput throws 400s from zod failures); everything else stays 500.
 * Without this, a bad login payload surfaced as an unhandled 500.
 */
@Catch()
export class StatusExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      typeof exception === "object" && exception !== null && "status" in exception &&
      typeof (exception as { status?: unknown }).status === "number"
        ? (exception as { status: number }).status
        : 500;
    const message =
      exception instanceof Error ? exception.message : "Internal server error";
    res.status(status).json({ statusCode: status, message });
  }
}
