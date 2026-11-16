"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, sessionCookieOptions } from "@/lib/auth";
import { SEGMENTO_COOKIE } from "@/lib/demo/segmento-server";
import { segmentoPorId } from "@/lib/demo/segmentos";

export async function escolherSegmento(form: FormData) {
  if (!(await getSession())) redirect("/login");
  const seg = segmentoPorId(String(form.get("segmento") ?? ""));
  if (!seg) redirect("/segmento");
  (await cookies()).set(SEGMENTO_COOKIE, seg.id, {
    ...sessionCookieOptions,
    httpOnly: false,
  });
  redirect("/");
}
