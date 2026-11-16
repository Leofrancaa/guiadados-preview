// Autenticação da DEMONSTRAÇÃO: um único acesso (usuário e senha padrão,
// configuráveis por variável de ambiente) e sessão em cookie assinado
// (HMAC-SHA256). Sem banco de dados. Só roda no servidor.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isRole, type Role } from "@/lib/roles";

export const SESSION_COOKIE = "gd_session";
// 30 dias, renovados enquanto a pessoa usa (ver sessionToRenew): quem abre o
// painel toda semana não precisa logar de novo.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const RENEW_AFTER = 60 * 60 * 24; // renova no máximo 1x por dia

export type Identity = { sub?: string; nome?: string };
export type Session = { role: Role; exp: number } & Identity;

const isProduction = process.env.NODE_ENV === "production";

/** Acesso padrão enviado aos convidados (troque nas variáveis de ambiente). */
export const DEMO_USUARIO = (process.env.DEMO_USUARIO ?? "convidado")
  .trim()
  .toLowerCase();
const DEMO_SENHA = process.env.DEMO_SENHA ?? "guiadados2026";

// Sem AUTH_SECRET definido, usa um segredo fixo: aceitável só porque os
// dados são fictícios. Defina AUTH_SECRET na hospedagem para sessões únicas.
function secret() {
  const value = process.env.AUTH_SECRET;
  return value && value.length >= 32
    ? value
    : "guia-dados-preview-segredo-padrao-troque-em-producao";
}

export function authConfigured() {
  return Boolean(DEMO_USUARIO && DEMO_SENHA);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

// Compara em tempo constante (hash antes para igualar o tamanho).
function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

/** Confere o acesso da demonstração. */
export async function authenticate(
  username: string,
  password: string,
): Promise<({ role: Role } & Identity) | null> {
  const login = username.trim().toLowerCase();
  const ok = safeEqual(login, DEMO_USUARIO) && safeEqual(password, DEMO_SENHA);
  return ok ? { role: "admin", nome: "Convidado" } : null;
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createToken(
  role: Role,
  now = Date.now(),
  identity: Identity = {},
) {
  const key = secret();
  if (!key)
    throw new Error("AUTH_SECRET ausente ou curto (mín. 32 caracteres).");
  const session: Session = {
    role,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE,
    ...(identity.sub ? { sub: identity.sub.slice(0, 64) } : {}),
    ...(identity.nome ? { nome: identity.nome.slice(0, 80) } : {}),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function verifyToken(
  token: string | undefined,
  now = Date.now(),
): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign(payload, key))) return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<Session>;
    if (!isRole(session.role) || typeof session.exp !== "number") return null;
    if (session.exp * 1000 <= now) return null;
    return {
      role: session.role,
      exp: session.exp,
      ...(typeof session.sub === "string" ? { sub: session.sub } : {}),
      ...(typeof session.nome === "string" ? { nome: session.nome } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Sessão válida emitida há mais de um dia → novo token com prazo cheio.
 * Retorna null quando não precisa renovar.
 */
export function sessionToRenew(
  token: string | undefined,
  now = Date.now(),
): string | null {
  const session = verifyToken(token, now);
  if (!session) return null;
  const issuedAt = session.exp - SESSION_MAX_AGE;
  if (Math.floor(now / 1000) - issuedAt < RENEW_AFTER) return null;
  return createToken(session.role, now, {
    sub: session.sub,
    nome: session.nome,
  });
}

/** Renovação diária do cookie (prazo deslizante), sem consulta a banco. */
export async function renovarSessao(
  token: string | undefined,
  now = Date.now(),
): Promise<string | null> {
  return sessionToRenew(token, now);
}

// Lê a sessão direto do cabeçalho Cookie (usado nas rotas de API).
export function sessionFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifyToken(token);
}

export async function getSession() {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
