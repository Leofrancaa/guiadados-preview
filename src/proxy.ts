// Renova o cookie de sessão de quem está usando o painel (prazo deslizante).
// A autorização continua sendo feita em cada página/rota.
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  renovarSessao,
  sessionCookieOptions,
} from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const renewed = await renovarSessao(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const response = NextResponse.next();
  if (renewed)
    response.cookies.set(SESSION_COOKIE, renewed, sessionCookieOptions);
  return response;
}

export const config = {
  // Só as páginas e a API; arquivos estáticos e ícones ficam de fora.
  matcher: ["/", "/segmento", "/api/:path*"],
};
