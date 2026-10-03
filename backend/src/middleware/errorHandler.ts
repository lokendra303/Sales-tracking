import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, extra: err.extra },
    });
    return;
  }

  if (err instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "Invalid request." },
    });
    return;
  }

  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? "Invalid input.";
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: first },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: "SERVER_ERROR", message: "Something went wrong." },
  });
}
