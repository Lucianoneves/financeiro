# Financeiro — Antecipação de Recebíveis

Aplicação web para **antecipação de recebíveis**: o usuário seleciona títulos a receber (vindos do ERP), define data, taxa mensal e tarifa, e o sistema calcula o desconto, registra a operação e lança os movimentos no ERP via API. Uma rotina agendada acompanha a liquidação dos títulos antecipados.

> **Status:** em desenvolvimento. O conector do ERP ainda não foi definido — hoje existe apenas um **mock** (bloqueado em produção).

## Funcionalidades

- Login com Supabase Auth; rotas protegidas por `proxy.ts`
- Listagem de **recebíveis** em aberto (ERP)
- Criação de **antecipações** com cálculo de juros pro rata, tarifa e valor líquido
- Histórico de antecipações e status (`draft`, `posted`, `partially_settled`, `settled`, `failed`)
- Proteção contra antecipar o mesmo título duas vezes (constraint única no banco)
- Log de sincronização com o ERP (`erp_sync_log`) com chave de idempotência
- Cron de verificação de liquidação (`/api/cron/settlements`), protegido por segredo

## Cálculo

Desconto simples pro rata, arredondado por título:

```
juros = valor × (taxa mensal % / 100 / 30) × dias até o vencimento
líquido = bruto − juros − tarifa
```

Valores são tratados em **centavos** (inteiros) para evitar erros de ponto flutuante.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, `cacheComponents`), React 19 |
| Linguagem | TypeScript |
| Estilo / UI | Tailwind CSS 4, shadcn/ui, Base UI, lucide-react |
| Formulários | React Hook Form + Zod |
| Backend / Auth / DB | Supabase (`@supabase/ssr`, Postgres com RLS) |
| Testes | Vitest |
| Lint | ESLint 9 |

## Estrutura

```
app/
  (app)/recebiveis/      # lista de títulos a receber
  (app)/antecipacoes/    # histórico de antecipações
  login/                 # autenticação
  api/cron/settlements/  # rotina de liquidação (Bearer CRON_SECRET)
actions/                 # Server Actions (mutações)
components/              # componentes de feature (+ ui/ do shadcn)
lib/
  anticipation/          # cálculo, serviço e repositórios (memória / Supabase)
  erp/                   # tipos, client e mock do ERP
  supabase/              # clients server e admin
types/                   # tipos e schemas Zod compartilhados
supabase/migrations/     # schema SQL
proxy.ts                 # proteção de rotas (antigo middleware)
```

Mutações passam sempre por Server Actions; escritas no banco usam o *service role* no servidor, enquanto usuários autenticados têm apenas leitura via RLS.

## Começando

### Pré-requisitos

- Node.js 20+
- Projeto no [Supabase](https://supabase.com)

### Instalação

```bash
git clone https://github.com/Lucianoneves/financeiro.git
cd financeiro
npm install
cp .env.example .env.local
```

Preencha o `.env.local` (veja abaixo), aplique a migration em `supabase/migrations/0001_anticipations.sql` no seu projeto Supabase e rode:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço — **somente servidor** |
| `ERP_BASE_URL` | URL base da API do ERP (a definir) |
| `ERP_API_TOKEN` | Token da API do ERP (a definir) |
| `ERP_TRANSITORY_ACCOUNT_REF` | Conta transitória usada nos lançamentos |
| `CRON_SECRET` | Segredo do cron, enviado como `Authorization: Bearer <valor>` |

Apenas variáveis `NEXT_PUBLIC_*` são expostas ao navegador; nunca coloque segredos nelas.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run type-check` | Checagem de tipos (`tsc --noEmit`) |
| `npm run test` | Testes com Vitest |

Para rodar um teste específico: `npm run test -- calc`.

## Cron de liquidação

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<seu-dominio>/api/cron/settlements
```

Consulta o ERP, marca os títulos liquidados e atualiza o status das antecipações.

## Integração com o ERP

O contrato está em `lib/erp/types.ts`. Em desenvolvimento, `lib/erp/client.ts` devolve um mock em memória; em produção ele **lança erro** até que o conector real seja implementado.

## Deploy

Pensado para Vercel (ou VPS/container). Configure as variáveis de ambiente, aplique as migrations no Supabase e agende uma chamada periódica ao endpoint de cron.
