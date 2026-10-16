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

  // Surface common Prisma / DB issues so desk and mobile show a useful message.
  const prismaCode =
    err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  const raw = err instanceof Error ? err.message : "";
  if (prismaCode.startsWith("P") || /Unknown column|doesn't exist|Unknown arg|Table .* doesn't exist/i.test(raw)) {
    const hint = raw.split("\n")[0]?.slice(0, 240) || "Database schema is out of date.";
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: `Database error: ${hint}. Run the beat/lead SQL migration scripts and restart the API.`,
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: { code: "SERVER_ERROR", message: "Something went wrong." },
  });
}
