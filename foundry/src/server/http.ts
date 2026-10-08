import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodSchema } from "zod";
import { HttpError } from "./auth";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

export function fail(status: number, error: string) {
  return json({ error }, { status });
}

/** Wrap a handler so thrown HttpErrors become JSON responses. */
export function handler<T extends unknown[]>(fn: (req: NextRequest, ...rest: T) => Promise<Response>) {
  return async (req: NextRequest, ...rest: T): Promise<Response> => {
    try {
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof z.ZodError) return fail(400, e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      if ((e as Error).message === "busy") return fail(429, "Too many simultaneous requests");
      console.error("[api]", e);
      return fail(500, "Internal error");
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(raw);
}
