import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { merchantForApiKey } from "@/lib/services/merchants";
import { rateLimit, LIMITS } from "@/lib/auth/rateLimit";
import type { schema } from "@/lib/db";

export type ApiError = { error: { type: string; code: string; message: string } };

export function apiError(status: number, code: string, message: string, type = "invalid_request_error") {
  return NextResponse.json<ApiError>({ error: { type, code, message } }, { status });
}

/**
 * API keys travel as a bearer token. Rate limited per key, so one merchant's
 * runaway loop cannot take the API down for the rest.
 */
export function authenticate(
  request: NextRequest
): { merchant: schema.Merchant; key: schema.ApiKey } | NextResponse {
  const header = request.headers.get("authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!secret) {
    return apiError(401, "missing_api_key", "Send your API key as `Authorization: Bearer pk_test_…`.", "authentication_error");
  }
  const found = merchantForApiKey(secret);
  if (!found) {
    return apiError(401, "invalid_api_key", "That API key is not valid or was revoked.", "authentication_error");
  }
  if (!rateLimit(`api:${found.key.id}`, LIMITS.api.limit, LIMITS.api.windowMs).ok) {
    return apiError(429, "rate_limited", "Too many requests. Slow down and retry.", "rate_limit_error");
  }
  return found;
}

/** Read and cap the JSON body, so a huge payload cannot be used to exhaust memory. */
export async function readJson(request: NextRequest): Promise<unknown | NextResponse> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 64 * 1024) return apiError(413, "payload_too_large", "Request bodies are limited to 64 KB.");
  try {
    return await request.json();
  } catch {
    return apiError(400, "invalid_json", "The request body is not valid JSON.");
  }
}
