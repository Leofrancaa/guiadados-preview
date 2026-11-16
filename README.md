# GuIA Dados · Demonstração

Versão de demonstração do painel GuIA Dados, para mostrar a ferramenta a
quem ainda não é cliente. **Todos os dados são fictícios** e gerados no
servidor: não há banco de dados.

- Login com usuário e senha padrão (variáveis `DEMO_USUARIO` / `DEMO_SENHA`;
  sem definir: `convidado` / `guiadados2026`).
- Depois do login, a pessoa escolhe o tipo de negócio: padaria, mercado,
  restaurante, loja de roupas, farmácia, açaiteria, pet shop ou salão de
  beleza. Cada um tem uma empresa de exemplo em Salvador (2 lojas), catálogo,
  horários, sazonalidade, datas especiais, formas de pagamento, combos e
  custos próprios. Dá para trocar pelo menu lateral.
- Todos os módulos do painel: visão geral, produtos (curva ABC, ficha do
  produto, linha do tempo), financeiro (contas, lançamentos, equipe, DRE e
  exportação), retrospectiva (recordes e datas especiais), insights e chat da
  GuIA.
- Histórico de 1º/01/2025 até hoje, com o dia de hoje “ao vivo” até a última
  coleta de 30 em 30 minutos.

## Como os dados são gerados

`src/lib/demo/motor.ts` calcula, de forma determinística (mesma data = mesmos
números), os pedidos de cada dia a partir do perfil do segmento em
`src/lib/demo/segmentos.ts`: dia da semana, mês, crescimento, feriados e festas
de Salvador (`src/lib/datas-comemorativas.ts`), curva de horário, participação
de cada produto, reajustes de preço, lançamentos e produtos descontinuados, e
pares comprados juntos. O motor devolve os mesmos formatos das funções do
banco do painel real (`painel_vendas`, `painel_produtos`, `produto_detalhe`,
`produto_historico`, `cestas_compras`), então as telas são as mesmas.

A padaria usa como referência o perfil agregado de uma padaria real
(horários, dias da semana, sazonalidade e ticket), com volume de duas lojas.

O financeiro começa com contas e equipe de exemplo do segmento. Edições ficam
só na memória do servidor (somem quando ele reinicia).

## Rodar

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Sem chave de IA, o painel funciona e só o chat,
os insights e o resumo da GuIA avisam que a IA não está configurada. Para
ligar a IA, defina `OPENROUTER_API_KEY` (ou `GROQ_API_KEY`) no servidor.

## Publicar (Netlify ou Vercel)

Importe o repositório como projeto Next.js (build `npm run build`). Defina
`DEMO_SENHA`, `AUTH_SECRET` e, se quiser a IA, `OPENROUTER_API_KEY`.

## Verificar

```sh
npm run typecheck
npm run lint
npm run build
```
