"use server";

import { apiSendContactMessage, ApiError } from "@/lib/api/client";

type Result = { ok: true } | { ok: false; error: string };

export async function sendContactMessage(input: {
  name: string;
  email: string;
  message: string;
}): Promise<Result> {
  try {
    await apiSendContactMessage(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : "unknown_error" };
  }
}
