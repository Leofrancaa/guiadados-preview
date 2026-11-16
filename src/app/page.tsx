import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/auth";
import { segmentoEscolhido } from "@/lib/demo/segmento-server";
import { resumoSegmento } from "@/lib/demo/segmentos";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const seg = await segmentoEscolhido();
  if (!seg) redirect("/segmento");
  return (
    <Dashboard
      role={session.role}
      userName={session.nome}
      segmento={resumoSegmento(seg)}
    />
  );
}
