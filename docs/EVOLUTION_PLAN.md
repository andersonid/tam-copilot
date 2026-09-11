# TAM Copilot — Plano de Evolução

Documento de referência para retomar o desenvolvimento do TAM Copilot como substituto do TAM Toolkit v8 (AppImage Electron). Gerado a partir da engenharia reversa completa do TTK v8 e da construção do `tam-toolkit-mcp` (56 tools MCP).

**Última atualização:** 2026-09-10

---

## 0. Princípio de ouro: fidelidade ao Electron

> **Toda implementação no MCP e no TAM Copilot DEVE replicar exatamente o comportamento do AppImage Electron.**

Estamos fazendo engenharia reversa completa do TTK v8. O objetivo é uma transição suave com **dupla convivência**: o TTK continua funcionando normalmente enquanto o TAM Copilot cresce ao lado, lendo e escrevendo nos mesmos Google Sheets. Quando for apresentado à liderança, ambos precisam produzir resultados idênticos para os mesmos dados.

Regras práticas:

1. **Primeiro replicar, depois melhorar.** A prioridade é funcionar igual ao Electron. Melhorias são bem-vindas, mas só depois de garantir paridade funcional — e nunca quebrando compatibilidade com os dados existentes.
2. **Nunca assumir** como um campo é resolvido — sempre verificar no código do Electron (`@tam-toolkit/core` + frontend minificado).
3. **Se o Electron lê o `customerName` da Administration `list`, nós também.** Se lê da tab `config`, idem. Sem atalhos.
4. **Placeholders, anchors de tabelas, nomes de colunas** — copiar exatamente do template e do código. Um `{{tableCustomerTeam}}` errado é um report vazio.
5. **Ordem das operações importa.** Se o Electron faz `fillMultipleTables` com `extraFinalRequests` para aplicar traduções no mesmo batchUpdate, nós fazemos igual — não separamos em duas chamadas.
6. **Lookup maps, filtros, formatação de dados** — usar as funções do `@tam-toolkit/core` (domain/) diretamente. Não reimplementar.
7. **Testar sempre contra o mesmo template e dados** que o Electron usaria. O resultado final (documento gerado, dados no sheet) deve ser indistinguível.
8. **Se existir uma abordagem melhor**, pode ser usada — desde que o resultado final seja igual ou superior e não quebre a dupla convivência com o TTK.

Erros já encontrados por violar este princípio:
- `customerName` buscado da tab `config` (inexistente) em vez da Administration `list` → aparecia account number no report
- Table anchors inventados (`{{customerTeam}}`) em vez dos reais (`{{tableCustomerTeam}}`) → tabelas não preenchidas
- Traduções aplicadas em chamada separada em vez de como `extraFinalRequests` → placeholders ficavam no documento

---

## 1. Contexto: como o TAM Toolkit v8 funciona hoje

### 1.1. Arquitetura geral

O TTK v8 é um **Electron AppImage** que usa **Google Sheets como banco de dados**. Não existe backend real — o app roda no desktop do TAM e chama APIs do Google diretamente.

```
┌─────────────────┐      ┌───────────────────┐
│  Electron App   │─────▶│  Google Sheets API │
│  (AppImage)     │      │  (Sheets como BD)  │
└────────┬────────┘      └───────────────────┘
         │
         │ POST (id_token + access_token)
         ▼
┌─────────────────┐      ┌───────────────────┐
│  GAS Proxy      │─────▶│  APIs Red Hat      │
│  (Apps Script)  │      │  (Hydra, OCM, Jira)│
└─────────────────┘      └───────────────────┘
```

### 1.2. Camada de dados — 3 spreadsheets

#### Administration (centralizadora)

- **ID:** `1G25S044fjWjAfAuQeFnKTY4Njc-aY0zVSC0dznd2MGE`
- **Link:** https://docs.google.com/spreadsheets/d/1G25S044fjWjAfAuQeFnKTY4Njc-aY0zVSC0dznd2MGE/edit
- Tabs:
  - `list` — registro de todos os toolkits v8 (customer name, account number, region, `TAM_TOOLKIT_SHEET_ID`, status)
  - `admin_users` — emails com acesso admin + status
  - `templates` — IDs dos Google Docs/Slides templates (TAM Report, One Page, Service Review)
  - `translate` — traduções EN/PT-BR/ES dos placeholders de reports
  - `cache` — TTLs de cache configuráveis por tab
  - `requests` — ponteiro para spreadsheet de requests de migração v7→v8
  - **Lookup tabs** (enums/dropdowns): `action_plan_status`, `action_plan_impact`, `action_plan_initiative_type`, `risks_probability`, `risks_impact`, `job_title`, `summary_goals_status`, `summary_priority_status`, `summary_painpoints_status`, `summary_projects_status`, `summary_purchased_products_status`, `summary_main_apps_impact`, etc.

#### Unified (v7 — legado)

- **ID:** `1PNJtkNQdyygF_BHMYd6_HA_6OSc9d6HA4NdxrQvf0TM`
- **Link:** https://docs.google.com/spreadsheets/d/1PNJtkNQdyygF_BHMYd6_HA_6OSc9d6HA4NdxrQvf0TM/edit
- Tab: `tam_toolkit_list` — lista dos toolkits v7 (formato antigo, para migração)

#### Client Toolkit (uma por cliente)

- Cada toolkit é uma **spreadsheet separada** no Google Drive
- O ID está na coluna `TAM_TOOLKIT_SHEET_ID` da tab `list` da Administration
- Tabs por cliente:
  - `config` — CUSTOMER_NAME, ACCOUNT_NUMBER, REGION, etc.
  - `touchpoints` — registro de interações
  - `action_plan` — iniciativas estratégicas
  - `risks` — riscos mapeados
  - `lifecycle` — produtos + versões + fases de suporte
  - `engagement` — tracking trimestral por área
  - `customer_team` — contatos do cliente
  - `redhat_team` — equipe Red Hat
  - `customer_area` — áreas/departamentos do cliente
  - `summary_scenario`, `summary_goals`, `summary_priorities`, `summary_painpoints`, `summary_projects`, `summary_purchased_products`, `summary_main_apps`, `competitive` — cards de resumo
  - `cases` (cache local do GAS Proxy)

### 1.3. GAS Proxy (Google Apps Script)

**URL:** `https://script.google.com/a/macros/redhat.com/s/AKfycbwzrM5FEyDq-DOxUeYByMamx9KKzGBmjElwd9Mi199xHjv0QTqmBYmWnE7jsRXA9P99/exec`

Intermediário server-side entre o Electron (browser) e APIs Red Hat. Necessário porque o browser não pode fazer CORS para `api.access.redhat.com`.

| Action | API real por trás | Autenticação |
|---|---|---|
| `cases` | Hydra `/support/v1/cases/filter` | id_token + access_token Google |
| `account` | Hydra `/support/v1/accounts/{id}` | idem |
| `contacts` | Hydra `/support/v1/accounts/{id}/contacts` | idem |
| `entitlements` | Hydra ou OCM subscriptions | idem |
| `ocm` | OCM `api.openshift.com/api/accounts_mgmt/v1/subscriptions` | idem |
| `issues` | **Jira on-prem Red Hat** (issues.redhat.com) | Token Jira armazenado no GAS ScriptProperty |
| `issues_watch` | Jira on-prem (busca por key) | idem |
| `ai_summarize` | Backend LLM (provavelmente Vertex/Gemini) | idem |
| `sync_admin_users` | Interno do GAS | Admin only |
| `get/set_allowed_users` | Interno do GAS | Admin only |
| `update_jira_token` | Interno do GAS | Admin only |

### 1.4. Autenticação

- Google OAuth 2.0 com PKCE
- Client ID registrado no projeto Google do TTK
- Scope: Sheets, Docs, Slides, Drive, Gmail
- Tokens encriptados com AES-256-CBC (CACHE_KEY estático)
- id_token enviado ao GAS Proxy para validação de domínio @redhat.com

### 1.5. Limitações do modelo atual

- **Google Sheets como banco:** sem índices, sem foreign keys, sem transações, quota de 60 req/min por usuário
- **Sem RBAC real:** qualquer TAM com OAuth vê/edita qualquer toolkit (controle apenas pela lista `admin_users`)
- **Sem analytics cross-account:** cada toolkit é um silo; aggregar dados exige ler N spreadsheets
- **GAS Proxy como gargalo:** ponto único de falha, sem logging, sem rate limiting, token Jira compartilhado
- **AppImage Electron:** pesado (~250MB), sem auto-update, deploy manual, UI datada
- **Sem busca:** não existe full-text search nem busca semântica nos dados
- **Sem versionamento:** alterações em cells sobrescrevem sem histórico

---

## 2. O que já temos construído

### 2.1. tam-toolkit-mcp (56 tools MCP)

Servidor MCP que reusa o `@tam-toolkit/core` extraído do AppImage. Permite acesso programático a todos os dados e operações do TTK via Cursor.

**Repositório:** `/home/anobre/Development/projects/tam-toolkit-mcp/`

**Categorias de tools:**

| Categoria | Tools | Tipo |
|---|---|---|
| Toolkits | `ttk_list_toolkits`, `ttk_get_toolkit_summary` | RO |
| Cases/External | `ttk_get_cases`, `ttk_get_entitlements`, `ttk_get_ocm_clusters`, `ttk_get_issues` | RO |
| Action Plan | `ttk_get_action_plan`, `ttk_add_action_plan_item`, `ttk_update_action_plan_item`, `ttk_delete_action_plan_item` | CRUD |
| Touchpoints | `ttk_get_touchpoints`, `ttk_add_touchpoint`, `ttk_update_touchpoint`, `ttk_delete_touchpoint` | CRUD |
| Customer Team | `ttk_get_customer_team`, `ttk_add_customer_team`, `ttk_update_customer_team`, `ttk_delete_customer_team`, `ttk_sync_customer_team` | CRUD+Sync |
| Red Hat Team | `ttk_get_redhat_team`, `ttk_add_redhat_team`, `ttk_update_redhat_team`, `ttk_delete_redhat_team` | CRUD |
| Risks | `ttk_get_risks`, `ttk_add_risk`, `ttk_update_risk`, `ttk_delete_risk` | CRUD |
| Engagement | `ttk_get_engagement`, `ttk_update_engagement` | RO+Update |
| Lifecycle | `ttk_get_lifecycle`, `ttk_add_lifecycle_item`, `ttk_update_lifecycle_item`, `ttk_delete_lifecycle_item` | CRUD |
| Customer Areas | `ttk_get_customer_areas`, `ttk_add_customer_area`, `ttk_update_customer_area`, `ttk_delete_customer_area` | CRUD |
| Summary Cards | `ttk_get_summary_cards`, `ttk_add_summary_item`, `ttk_update_summary_item`, `ttk_delete_summary_item` | CRUD |
| Alerts/CVEs | `ttk_get_alerts`, `ttk_get_cves` | RO |
| Dashboard | `ttk_get_dashboard` | RO |
| Lookups | `ttk_get_lookups` | RO |
| Case Notes | `ttk_get_case_notes`, `ttk_upsert_case_note` | CRUD |
| Reports | `ttk_generate_tam_report`, `ttk_generate_one_page`, `ttk_generate_service_review` | Write |
| Utilities | `ttk_healthcheck`, `ttk_scan_products`, `ttk_replace_product`, `ttk_list_backups`, `ttk_create_backup`, `ttk_delete_case_note` | Mixed |

**Infraestrutura:**
- Rate limiter: 40 req/min para Google APIs (sliding window + 429 retry)
- Security boundaries: `my-accounts.json` + `assertWriteAllowed()` por account_number
- Redirect de `console.log` → `stderr` (previne corrupção do JSON-RPC stdio)

### 2.2. hydra-mcp (Red Hat Hydra API)

Servidor MCP para a API pública de suporte Red Hat (`api.access.redhat.com/support`).

**Repositório:** `/home/anobre/Development/projects/hydra-mcp/`

**Acesso direto (sem GAS Proxy) a:**
- Cases: busca SOLR, listagem com filtros, CRUD, comments, SBRs, escalations
- Accounts: dados da conta, contacts, case groups
- OCM: organizations, subscriptions, clusters, versions
- KCS: busca de artigos, recomendações
- Product Lifecycle: fases de suporte de todos os produtos Red Hat
- Attachments: listagem, download, metadata

### 2.3. TAM Copilot (estado atual)

**Repositório:** `/home/anobre/Development/projects/TAM-Copilot/`
**GitHub:** `git@github.com:andersonid/tam-copilot.git`
**URL (k3s):** https://tam-copilot.nobre.ninja

**Stack:**
- Frontend: React 18 + Vite + TypeScript + PatternFly v6
- Backend: FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2
- Database: PostgreSQL 17 + pgvector + Alembic migrations
- LLM: OpenAI SDK (LiteMaaS) + Anthropic + Gemini
- Deploy: Tekton CI/CD + ArgoCD + k3s (nobre.ninja)

**Data model existente (models.py):**
- `AdminUser` — roles: admin, manager, tam, viewer
- `Account` — entidade central (account_number, name, region, vertical, segment)
- `AccountAssignment` — N:N entre Account e User (tam, team_lead, cs, sa, backup)
- `AccountCluster` — cache OCM
- `AccountEntitlement` — cache subscriptions
- `AccountContact` — customer team + Red Hat team
- `SupportCase` — cache Hydra
- `AccountIssue` — Jira issues
- `ActionPlan`, `Touchpoint`, `Risk`, `Engagement` — operacionais
- `NpsSurvey`, `ProductLifecycle` — tracking
- `Guide`, `Tag`, `Product`, `Customer`, `DocumentType`, `LlmProvider` — content generation

**Pages React existentes (36):**
- Dashboard, Accounts, Cases, Clusters, Contacts, Entitlements
- ActionPlan, Touchpoints, Risks, Engagement, Lifecycle, Issues
- NPS, KCS Article, Assessment, Schedule
- Guides (create, detail, import, list), Search, Settings, Providers
- Manager portfolio (dashboard, action plans, engagement, reports, team)
- Admin users, Login

---

## 3. APIs Red Hat — acesso direto vs GAS Proxy

### 3.1. Substituição completa

| Dado | GAS Proxy | Hydra MCP (direto) | Status |
|---|---|---|---|
| Cases | `action: cases` | `search_cases`, `list_cases`, `get_case` | **Disponível** — mais flexível |
| Account info | `action: account` | `get_account` | **Disponível** |
| Contacts | `action: contacts` | `get_account_contacts` | **Disponível** |
| OCM subscriptions | `action: ocm` | `ocm_list_subscriptions`, `ocm_list_clusters` | **Disponível** |
| Entitlements | `action: entitlements` | OCM subscriptions (parcial) | **Parcial** — adicionar tool dedicada |

### 3.2. Não substituível (sem GAS)

| Dado | Motivo | Alternativa para o TAM Copilot |
|---|---|---|
| **Jira issues** | Token Jira on-prem armazenado no GAS | Token Jira pessoal por usuário (PAT) ou service account |
| **AI Summarize** | Backend LLM interno | Irrelevante — TAM Copilot tem LLMs próprios (LiteMaaS, etc.) |

### 3.3. Autenticação direta

Para chamar APIs Red Hat do backend FastAPI (server-side), sem browser nem GAS:

- **Hydra API:** HYDRA_OFFLINE_TOKEN (gerado em https://access.redhat.com/management/api) → troca por access_token SSO Red Hat (~15 min, auto-refresh)
- **OCM API:** mesmo token SSO funciona para `api.openshift.com`
- **Jira on-prem:** Personal Access Token (PAT) gerado em issues.redhat.com + VPN

---

## 4. Mapeamento TTK → TAM Copilot

### 4.1. Entidades

| TTK (Google Sheets tab) | TAM Copilot (model) | Status | Notas |
|---|---|---|---|
| Administration `list` | `Account` | **Existe** | Sync Hydra já implementado |
| `config` | Campos de `Account` | **Existe** | |
| `customer_team` | `AccountContact` (team=customer) | **Existe** | |
| `redhat_team` | `AccountContact` (team=redhat) | **Existe** | |
| `touchpoints` | `Touchpoint` | **Existe** | |
| `action_plan` | `ActionPlan` | **Existe** | Campos mais ricos no Copilot |
| `risks` | `Risk` | **Existe** | |
| `engagement` | `Engagement` | **Existe** | |
| `lifecycle` | `ProductLifecycle` | **Existe** | |
| `customer_area` | Campo `area` em `AccountContact` / `Engagement` | **Parcial** | Considerar tabela dedicada |
| `summary_*` (9 seções) | **Não existe** | **Gap** | Criar models ou JSON fields |
| `cases` (cache GAS) | `SupportCase` | **Existe** | Sync direto Hydra |
| `issues` (Jira) | `AccountIssue` | **Existe** | Precisa auth Jira |
| `competitive` | **Não existe** | **Gap** | Análise competitiva |
| Administration `admin_users` | `AdminUser` | **Existe** | RBAC mais rico |
| Administration lookups | Enum fields / reference tables | **Parcial** | Alguns hardcoded, outros faltam |
| Administration `templates` | Jinja2 templates | **Diferente** | Templates locais, não Google Docs |
| Administration `translate` | i18n (a implementar) | **Gap** | |

### 4.2. Funcionalidades

| Feature TTK | TAM Copilot | Status |
|---|---|---|
| CRUD touchpoints, action plan, risks, etc. | Routers + pages | **Existe** (parcial) |
| Sync cases Hydra | `routers/sync.py` + `routers/cases.py` | **Existe** |
| Sync OCM clusters | `routers/clusters.py` | **Existe** (estrutura) |
| Sync contacts Hydra | `routers/contacts.py` | **Existe** (estrutura) |
| TAM Report (Google Docs) | `TamReportPage.tsx` | **Estrutura existe** |
| One Page (Google Slides) | **Não existe** | **Gap** |
| Service Review (Google Slides) | **Não existe** | **Gap** |
| Dashboard (conta individual) | `DashboardPage.tsx` | **Existe** |
| Manager portfolio (cross-account) | `ManagerPortfolioDashboard.tsx` | **Existe** |
| CVE tracking | **Não existe** | **Gap** |
| Healthcheck | **Não existe** | **Gap** — mas backend tem `/api/health` |
| Backup/restore | **Não necessário** | N/A — PostgreSQL tem backup nativo |
| Replace product (cross-tabs) | **Não necessário** | N/A — é workaround de Sheets |
| Guide generation (LLM) | **Existe** | Feature exclusiva do Copilot |
| Semantic search | **Existe** | Feature exclusiva do Copilot |
| KCS article generation | `KcsArticlePage.tsx` | Feature exclusiva do Copilot |

---

## 5. Diferencial estratégico (para apresentação)

### 5.1. TTK v8 vs TAM Copilot

| Aspecto | TTK v8 (atual) | TAM Copilot (proposta) |
|---|---|---|
| **Armazenamento** | Google Sheets (1 planilha/cliente) | PostgreSQL + pgvector |
| **Backend** | GAS Proxy (Apps Script) | FastAPI (Python, real) |
| **Frontend** | Electron AppImage (~250MB) | React SPA PatternFly (web, ~5MB) |
| **Acesso** | Desktop only (instalar AppImage) | Browser (qualquer dispositivo) |
| **Autenticação** | Google OAuth (sem RBAC) | SSO Red Hat / OIDC + RBAC |
| **RBAC** | Nenhum (todo TAM vê tudo) | admin / manager / tam / viewer |
| **Paradigma** | Centrado no TTK (planilha) | Centrado na Account (entidade) |
| **Analytics** | Nenhum cross-account | Dashboard + Manager portfolio |
| **Busca** | Nenhuma | Full-text + semântica (embeddings) |
| **LLM/IA** | `ai_summarize` via GAS (limitado) | Multi-LLM (LiteMaaS, Anthropic, Gemini) |
| **Reports** | Google Docs/Slides via API | Jinja2 HTML + PDF export |
| **Deploy** | Manual (compartilhar .AppImage) | CI/CD (Tekton + ArgoCD + k3s) |
| **Escalabilidade** | 60 req/min Google Sheets | PostgreSQL (sem limite prático) |
| **Versionamento** | Nenhum (overwrite em cells) | Alembic migrations + git |
| **Integração** | GAS Proxy (frágil) | APIs diretas + MCP servers |

### 5.2. Argumentos-chave

1. **Dados enterprise em Google Sheets é um risco** — sem backup automático, sem audit trail, sem recovery granular, qualquer TAM pode sobrescrever dados de outro
2. **RBAC é obrigatório** — managers precisam ver portfolio sem editar; admins precisam gerenciar acessos; TAMs só devem ver suas contas
3. **O AppImage não escala** — cada TAM instala localmente, sem auto-update, incompatível com Mac/Windows sem workarounds
4. **Analytics cross-account** — hoje impossível sem script manual; com PostgreSQL, é um `SELECT ... GROUP BY`
5. **O paradigma muda** — de "abrir o TTK do cliente" para "trabalhar na conta do cliente com todas as ferramentas integradas"

---

## 6. Plano de evolução (fases)

### Fase 0 — Reidratação e diagnóstico (1-2 dias)

- [ ] Verificar estado atual do backend (migrations, DB, dependencies)
- [ ] Rodar o projeto localmente (podman-compose + frontend dev)
- [ ] Inventariar o que funciona vs o que é estrutura vazia
- [ ] Verificar o deploy no k3s (https://tam-copilot.nobre.ninja)

### Fase 1 — Integração APIs Red Hat (3-5 dias)

- [ ] Implementar client Hydra no backend (reusar patterns do hydra-mcp)
- [ ] Sync completo: cases, account info, contacts, entitlements
- [ ] Sync OCM: clusters, subscriptions (direto, sem GAS)
- [ ] Implementar client Jira (PAT por usuário, via VPN)
- [ ] Cron/scheduler para syncs periódicos (ou on-demand)
- [ ] **Solicitar RBAC Insights aos clientes** para acesso cross-org às recomendações
- [ ] **Integrar Insights Advisor API v2** (`/cluster/{uuid}/reports`) para recomendações de cluster
- [ ] **Integrar OCM `metric_queries/alerts`** para alertas detalhados (após resolver cross-org)

### Fase 2 — Completar data model (2-3 dias)

- [ ] Adicionar models para: customer areas (tabela dedicada), summary cards (9 seções), competitive analysis
- [ ] Migrations Alembic para novos models
- [ ] CRUD routers + schemas para tudo novo
- [ ] Reference tables para lookups (substituir tabs da Administration)

### Fase 3 — Import do TTK (2-3 dias)

- [ ] Script de import: ler TTK Google Sheets → popular PostgreSQL
- [ ] Mapear UUIDs do TTK para IDs do Copilot
- [ ] Validar integridade dos dados importados
- [ ] Suportar import incremental (delta sync)

### Fase 4 — Reports (3-5 dias)

- [ ] TAM Report: Jinja2 template → HTML → PDF (wkhtmltopdf ou weasyprint)
- [ ] One Page: layout single-page com dados formatados
- [ ] Service Review: multi-page com tabelas e gráficos (matplotlib/plotly)
- [ ] Internacionalização (EN/PT-BR/ES) usando as traduções existentes

### Fase 5 — Autenticação SSO Red Hat (2-3 dias)

- [ ] Integrar Red Hat SSO (Keycloak OIDC) ou manter Google OAuth @redhat.com
- [ ] Middleware RBAC no FastAPI (roles → permissions)
- [ ] UI: login SSO, perfil, gerenciamento de equipe

### Fase 6 — UI e UX (3-5 dias)

- [ ] Revisar e completar pages existentes
- [ ] Implementar summary cards (9 seções) na UI
- [ ] Melhorar dashboard com métricas cross-account
- [ ] Implementar page de CVEs
- [ ] Mobile responsive

### Fase 7 — Deploy e apresentação (1-2 dias)

- [ ] CI/CD pipeline atualizado
- [ ] Deploy no k3s com dados reais (import do TTK)
- [ ] Demo com dados de 2-3 contas
- [ ] Preparar pitch deck / one-pager para liderança

---

## 7. ALERTA: Migração CRM Red Hat (21/set/2026)

### Timeline

| Quando | O que acontece |
|---|---|
| **19/set 22:30 EDT** | Início do outage (~4.5h) — Portal read-only |
| **20/set 03:00 EDT** | Fim do outage — novo CRM live |
| **21/set** | Go-live oficial — **APIs v1 REST (Hydra) deixam de funcionar** |

### O que muda

- **Hydra REST API** (`api.access.redhat.com/support/v1/`) → **descontinuada**
- **Nova API**: GraphQL em `https://graphql.redhat.com` (mesma auth SSO)
- **Artigo oficial**: https://access.redhat.com/articles/7146073

### Impacto no projeto

- O `hydra-mcp` (nosso, 46 tools) **vai parar de funcionar** após 21/set
- O `tam-toolkit-mcp` usa o GAS Proxy que por sua vez usa Hydra → **também quebra**
- **4 novos MCP servers oficiais da Red Hat** já estão instalados e substituem o Hydra

---

## 8. Arsenal de MCP servers (estado atual)

### 8.1. Novos MCPs oficiais Red Hat (pós-migração CRM)

Todos usam o mesmo `REDHAT_TOKEN` (offline token SSO). Pacotes npm oficiais.

#### `user-rh-support` — Case Management (16 tools)

| Tool | Tipo | O que faz |
|---|---|---|
| `listCases` | RO | Listar cases com filtros (conta, severity, status, texto) |
| `getCase` | RO | Detalhes completos de um case |
| `getCaseComments` | RO | Todos os comentários |
| `getCaseComment` | RO | Um comentário específico |
| `getExternalTrackerUpdates` | RO | Jira/Bugzilla linkados ao case |
| `getCaseAttachments` | RO | Listar attachments |
| `downloadAttachment` | RO | Baixar attachment para disco |
| `getBusinessHours` | RO | Horário comercial do suporte |
| `createCase` | **WRITE** | Criar case |
| `updateCase` | **WRITE** | Atualizar campos |
| `closeCase` | **WRITE** | Fechar case |
| `addCaseComment` | **WRITE** | Adicionar comentário |
| `addNotifiedUsers` | **WRITE** | Adicionar notificados |
| `removeNotifiedUser` | **WRITE** | Remover notificado |
| `uploadAttachment` | **WRITE** | Upload de arquivo |
| `deleteAttachment` | **WRITE** | Deletar attachment |

**Substitui:** `hydra-mcp` (search_cases, get_case, list_cases, etc.) + GAS Proxy action `cases`

#### `user-rh-account` — Account & User Management (12 tools)

| Tool | Tipo | O que faz |
|---|---|---|
| `listAccounts` | RO | Contas do usuário autenticado |
| `getCurrentUser` | RO | Dados do usuário autenticado |
| `listUsers` | RO | Listar usuários de uma conta (Org Admin) |
| `getUserDetails` | RO | Detalhes de um usuário |
| `getUserStatus` | RO | Status do usuário |
| `getUserRoles` | RO | Roles atribuídas |
| `createUser` | **WRITE** | Criar usuário (Org Admin) |
| `updateUser` | **WRITE** | Atualizar usuário |
| `updateUserStatus` | **WRITE** | Enable/disable |
| `assignUserRole` | **WRITE** | Atribuir role |
| `removeUserRole` | **WRITE** | Remover role |
| `inviteUsers` | **WRITE** | Convidar por email |

**Substitui:** `hydra-mcp` (get_account, get_account_contacts) + GAS Proxy actions `account`, `contacts`

#### `user-rh-knowledge` — KCS & Documentation (4 tools)

| Tool | O que faz |
|---|---|
| `searchKnowledgeBase` | Buscar artigos KCS (solutions, articles) |
| `getSolution` | Conteúdo completo de um artigo |
| `searchDocumentation` | Buscar docs oficiais Red Hat |
| `getErrata` | Detalhes de errata/advisory (RHSA, RHBA, RHEA) |

**Substitui:** `hydra-mcp` (search_kcs, get_recommendations)

#### `user-rh-subscription` — Subscriptions & Content (35 tools)

Gerenciamento de subscriptions, allocations (Satellite manifests), cloud access, errata, packages, images, systems.

**Destaques:**
- `listSubscriptions` / `getSubscription` — substituem entitlements do Hydra/GAS
- `listSystems` / `getSystem` — sistemas registrados no RHSM
- `listErrata` / `getErratum` — errata por sistema/advisory
- `listAllocations` — Satellite manifests
- `listCloudAccessProviders` — cloud access (AWS, Azure, GCP)

**Substitui:** `hydra-mcp` (OCM subscriptions parcial) + GAS Proxy action `entitlements`

### 8.2. Outros MCPs relevantes

| MCP | Tools | Propósito |
|---|---|---|
| `user-hydra` | 46 | **LEGADO** — para de funcionar 21/set. Manter até migração completa |
| `user-tam-toolkit` | 56 | TTK v8 via Google Sheets (nosso, independente da migração) |
| `user-redhat-docs` | ? | Red Hat Docs MCP (infralab) |
| `user-dataverse` | 5 | Red Hat Dataverse (Salesforce data, RLS limitado) |

### 8.3. Mapa de migração: Hydra → Novos MCPs

| Hydra tool (legado) | Novo MCP | Nova tool |
|---|---|---|
| `search_cases` | `rh-support` | `listCases` |
| `get_case` | `rh-support` | `getCase` |
| `get_case_comments` | `rh-support` | `getCaseComments` |
| `add_case_comment` | `rh-support` | `addCaseComment` |
| `create_case` | `rh-support` | `createCase` |
| `update_case` | `rh-support` | `updateCase` |
| `close_case` | `rh-support` | `closeCase` |
| `get_account` | `rh-account` | `listAccounts` + `getCurrentUser` |
| `get_account_contacts` | `rh-account` | `listUsers` |
| `search_kcs` | `rh-knowledge` | `searchKnowledgeBase` |
| `get_recommendations` | `rh-knowledge` | `searchKnowledgeBase` (com filtros) |
| `ocm_list_subscriptions` | `rh-subscription` | `listSubscriptions` |
| `ocm_list_clusters` | — | OCM API (`api.openshift.com`) permanece |
| `list_escalations` | — | Sem substituto direto (verificar GraphQL) |
| `lifecycle_get_product` | — | API pública permanece (`product-life-cycles/api/v1/`) |

### 8.4. Telemetria de clusters e Insights Advisor — mapa de acesso

Investigação completa realizada em 2026-09-10. Validada com testes reais contra a conta Energisa (1303232).

#### 8.4.1. Três camadas de dados de cluster

| Camada | O que traz | API | Cross-org com token pessoal? |
|---|---|---|---|
| **OCM Subscriptions** | health_state, critical_alerts_firing, versão, nodes, CPU/mem | `api.openshift.com/api/accounts_mgmt/v1/subscriptions` | Não (org-scoped) |
| **OCM Cluster Details** | alertas detalhados (quais estão firing) | `api.openshift.com/api/clusters_mgmt/v1/clusters/{id}/metric_queries/alerts` | Não (org-scoped) |
| **Insights Advisor** | recomendações CCX (regras, severidade, resolução, risk) | `console.redhat.com/api/insights-results-aggregator/v2/cluster/{uuid}/reports` | Não (org-scoped) |

**Resultado do teste direto (token pessoal SSO → Energisa):**
- OCM subscriptions: `404 Forbidden access` para clusters da Energisa
- Insights Aggregator v2: `404 Item not found` (org_id 11009103 ≠ org da Energisa)
- OCM metric_queries/alerts: funciona para clusters próprios (`{ "alerts": [] }`), mas `Forbidden` para clusters de clientes

#### 8.4.2. Como o GAS Proxy resolve o cross-org

O GAS Proxy **bypassa a limitação de org** porque não usa o token pessoal do TAM para chamar APIs Red Hat:

```
Electron TTK → Google OAuth (id_token + access_token)
                      ↓
               GAS Proxy (script.google.com/redhat.com)
                      ↓
               1. Valida id_token: é @redhat.com? ✓
               2. Usa CREDENCIAIS INTERNAS Red Hat
                  (armazenadas em GAS ScriptProperties)
                      ↓
               APIs Red Hat (qualquer org) → sucesso
```

**Teste real:** `ttk_get_ocm_clusters(account_number="1303232")` via GAS Proxy retornou **8 clusters** da Energisa com telemetria em tempo real, incluindo:
- ocpp1 (PRD): **UNHEALTHY**, 1 critical alert, 4.20.24, 42 nodes
- ocph2 (HMG-OCI): **UNHEALTHY**, 3 critical alerts, 4.21.31, 15 nodes
- ocpd1, ocph1, ocpd2, ocpdr, ocphub: healthy

#### 8.4.3. O que o GAS Proxy NÃO cobre

| Dado | GAS Proxy action | Status |
|---|---|---|
| Lista de clusters + health resumido | `ocm` | **Funciona** |
| Alertas detalhados (quais estão firing) | — | **Não existe** |
| Recomendações Insights (regras, resolução) | — | **Não existe** |
| Jira issues | `issues` / `issues_watch` | **Funciona** |

#### 8.4.4. Insights Advisor for OpenShift API (v2) — referência

**Base URL:** `https://console.redhat.com/api/insights-results-aggregator/v2`

| Endpoint | O que retorna |
|---|---|
| `GET /clusters` | Lista de clusters da org com hit_count e risk breakdown |
| `GET /cluster/{uuid}/reports` | Recomendações detalhadas para um cluster |
| `GET /cluster/{uuid}/upgrade-risks-prediction` | Riscos de upgrade (ML-based) |
| `GET /cluster/{uuid}/info` | Info do cluster |
| `GET /content` | Todas as regras CCX com descrição, resolução, severity |
| `GET /rule` | Regras aplicáveis |
| `GET /namespaces/dvo` | Recomendações DVO (workloads) |
| `GET /namespaces/dvo/{ns}/cluster/{id}` | DVO por namespace+cluster |

**Auth:** mesmo offline token SSO Red Hat (`client_id=rhsm-api`).
**OpenAPI:** https://developers.redhat.com/api-catalog → "Red Hat Lightspeed Advisor for OpenShift V2"

**Estrutura da resposta de `/cluster/{uuid}/reports`:**
```json
{
  "report": {
    "meta": {
      "cluster_name": "...",
      "count": 4,
      "last_checked_at": "2026-09-10T17:25:48Z",
      "gathered_at": "2026-09-10T17:25:00Z"
    },
    "data": [
      {
        "rule_id": "ccx_rules_ocp.external.rules.haproxy_exporter_server_threshold_exceeded",
        "total_risk": 3,
        "description": "HAProxy route configuration has exceeded connection limits",
        "resolution": "...",
        "tags": ["service_availability"]
      }
    ]
  }
}
```

#### 8.4.5. Soluções para acesso cross-org ao Insights

| Solução | Esforço | Requisito externo | Acesso cross-org? |
|---|---|---|---|
| **RBAC Insights** (cliente concede acesso ao TAM) | Nenhum dev | Cliente aprovar no console.redhat.com (até 365 dias) | Sim — token pessoal funciona |
| **Adicionar actions no GAS Proxy** (`ocm_alerts`, `insights_reports`) | Médio — requer acesso ao código GAS | Manutenção do GAS | Sim — credenciais internas do GAS |
| **Backend TAM Copilot com service account** | Alto — solicitar SA interno | Aprovação Red Hat IT | Sim — acesso total |
| **Supportshell + insights run** (fallback) | Nenhum dev | SSH manual | Sim — mas offline, não integrado |

**Recomendação:** Solicitar acesso RBAC a cada cliente via `console.redhat.com` → avatar → Internal → Access Requests → Create request. O Org Admin do cliente aprova, e o TAM passa a ter visibilidade da org do cliente no Hybrid Cloud Console (context switcher). Duração: até 12 meses. Ref: [How to enable Red Hat account team access (doc oficial)](https://docs.redhat.com/en/documentation/red_hat_hybrid_cloud_console/1-latest/html/user_access_configuration_guide_for_role-based_access_control_rbac/assembly-tam-procedures_user-access-configuration)

#### 8.4.6. Análise offline via supportshell (referência)

Para análise profunda quando APIs não estão disponíveis:

```bash
# No supportshell (SSH), apontar para o cluster:
cd /home/support_insights/ocp/<case_number>/<external_cluster_id>/

# Rodar insights-core com regras CCX (direto no arquivo comprimido):
insights run -p ccx_rules_ocp <arquivo_insights>

# Alternativa com ocp_insights.py (se instalado):
ocp_insights.py --id <external_cluster_id> --alerts

# omc funciona APENAS com must-gather (não com insights archives):
omc use <path-to-must-gather>
omc prometheus alertrule --state firing
```

**Insights archives ≠ must-gather:** O supportshell armazena insights-operator archives (coletados a cada ~2h). O `omc` funciona com must-gather archives (coletados manualmente com `oc adm must-gather`).

### 8.5. GraphQL API — substituta do Hydra REST

**Artigo de referência:** [Using Red Hat GraphQL API for Support Case Management](https://access.redhat.com/articles/7146073) (atualizado 2026-07-31)

A Red Hat publicou uma API GraphQL em `https://graphql.redhat.com` que substitui a API REST Hydra (`api.access.redhat.com/support`) para operações de support case management. É baseada em Salesforce (schema objects com sufixo `__c`).

#### Endpoint e autenticação

- **URL:** `https://graphql.redhat.com`
- **Método:** POST (corpo JSON com `query` + `variables`)
- **Auth:** Bearer token SSO (mesmo fluxo de offline token → access token via `sso.redhat.com`)
- **Headers obrigatórios:** `Content-Type: application/json`, `Authorization: Bearer <TOKEN>`, `apollographql-client-name`, `apollographql-client-version`

#### Schema Objects disponíveis

| Object | Equivalente REST (Hydra) | O que contém |
|---|---|---|
| `RedHatSupportCase` | `/v1/cases` | Cases com todos os campos + nested Account, Contact, Product, Owner, Comments |
| `RedHatSupportCaseComment__c` | `/v1/cases/{id}/comments` | Comentários com Body, IsAssociate, IsCustomer |
| `RedHatSupportAccount` | `/v1/accounts` | Id, Name, AccountNumber |
| `RedHatSupportContact` | `/v1/contacts` (não existia!) | Id, Name, Email, Phone, SSOUserName, Account vinculado |
| `RedHatSupportProduct2` | **NÃO EXISTIA** no REST | Produtos ativos com hierarquia parent/child (Name, VersionName, Family, ParentProduct) |
| `RedHatSupportBusinessHours` | `/v1/businessHours` | Horários de suporte por timezone |
| `RedHatSupportRecordType` | -- | Tipos de registro (Technical Support, etc.) — usado em mutations |

#### Vantagens sobre REST Hydra

1. **Nested queries** — Case + Comments + Account + Contact + Product em 1 round-trip (hoje fazemos 3-5 chamadas separadas)
2. **Endpoint de Produtos** — Lista hierárquica de produtos ativos com parent/child e versão. Não existia no REST.
3. **Filtros avançados** — operadores `eq`, `ne`, `like` (wildcard `%`), `in`/`nin` + booleanos `and`/`or`/`not`
4. **Resolve Lookup Data** — Query única para resolver ContactId + AccountId + RecordTypeId + ProductId antes de criar case
5. **DateTime tipado** — Datas em filtros usam wrapper: `{ "gt": { "value": "2026-01-01T00:00:00Z" } }`
6. **Paginação cursor-based** — `first`/`after` com `pageInfo { hasNextPage, endCursor }`. Max 200 records/request.

#### Operações disponíveis (queries + mutations)

**Queries (leitura):**
- Get cases (com filtros por status, priority, date range)
- Get case + comments (nested, 1 request)
- Get contact + account (por SSOUserName)
- Get account by number
- Get contacts for account (paginado)
- Get active products (hierárquico, paginado)
- Get business hours
- Get case comment (individual)
- Resolve lookup data (ContactId, AccountId, RecordTypeId, ProductId em 1 query)

**Mutations (escrita):**
- Create case (`CaseCreate`)
- Update case (`CaseUpdate`)
- Create comment (`CaseComment__cCreate`)

#### Exemplo: case com comentários em 1 request

```graphql
query GetCaseAndComments($caseNumber: String, $first: Int) {
  redhat_support_uiapi {
    query {
      RedHatSupportCase(where: { CaseNumber__c: { eq: $caseNumber } }) {
        edges { node {
          Id
          CaseNumber__c { value }
          Subject { value }
          Status { value }
          Priority { value }
          Product { Name { value } ParentProduct__r { Name { value } } }
          RedHatSupportAccount { Name { value } AccountNumber { value } }
          CaseComments__r(first: $first, orderBy: { CreatedDate: { order: DESC } }) {
            edges { node {
              Body__c { value }
              LastModifiedByName__c { value }
              IsAssociate__c { value }
              CreatedDate { value }
            } cursor }
            pageInfo { hasNextPage endCursor }
          }
        } }
      }
    }
  }
}
```

#### Impacto no projeto

| Componente | Ação |
|---|---|
| **hydra-mcp** | Após deprecação Hydra REST (21/set/2026): migrar handlers de cases/accounts/contacts para GraphQL. Adicionar tool de produtos. Manter OCM/Lifecycle/Search SOLR (não dependem do Hydra). |
| **user-rh-support MCP** | Já cobre as mesmas operações via REST. Verificar se internamente já usa GraphQL. |
| **TAM Copilot** | Adotar GraphQL para backend — menos round-trips, nested queries, endpoint de produtos. |
| **Rules/Skills** | Documentar GraphQL nas rules quando migrarmos. |

---

## 9. Referências e links

| Recurso | Link |
|---|---|
| TAM Copilot repo | `/home/anobre/Development/projects/TAM-Copilot/` |
| tam-toolkit-mcp repo | `/home/anobre/Development/projects/tam-toolkit-mcp/` |
| hydra-mcp repo | `/home/anobre/Development/projects/hydra-mcp/` |
| TTK Administration sheet | https://docs.google.com/spreadsheets/d/1G25S044fjWjAfAuQeFnKTY4Njc-aY0zVSC0dznd2MGE/edit |
| TTK Unified (v7) sheet | https://docs.google.com/spreadsheets/d/1PNJtkNQdyygF_BHMYd6_HA_6OSc9d6HA4NdxrQvf0TM/edit |
| **GraphQL API (nova)** | https://graphql.redhat.com |
| **Artigo migração CRM** | https://access.redhat.com/articles/7146073 |
| **Artigo transição CRM** | https://access.redhat.com/articles/7146730 |
| Hydra API base (legado) | https://api.access.redhat.com/support |
| OCM API base | https://api.openshift.com |
| Red Hat SSO token | https://access.redhat.com/management/api |
| Product Lifecycle API | https://access.redhat.com/product-life-cycles/api/v1/products |
| TAM Copilot (deploy) | https://tam-copilot.nobre.ninja |
| TAM Copilot (local) | http://localhost:8000 (backend) / http://localhost:5174 (frontend) |
| Chat TTK MCP | `e4dce39e-346d-42c3-9870-a4a61ec7fcfd` |
| Chat TAM Copilot | `5776d03a-b4d3-4eba-8a3e-676063dd3180` |
| Chat Hydra/novos MCPs | `500736bf-202d-4c90-9435-192e3ea2b4a8` |
| **Insights Advisor API (OpenShift v2)** | https://console.redhat.com/api/insights-results-aggregator/v2 |
| **Insights API OpenAPI** | https://developers.redhat.com/api-catalog → "Advisor for OpenShift V2" |
| **Insights RBAC para TAMs (doc oficial)** | https://docs.redhat.com/en/documentation/red_hat_hybrid_cloud_console/1-latest/html/user_access_configuration_guide_for_role-based_access_control_rbac/assembly-tam-procedures_user-access-configuration |
| **API Auth (offline token)** | https://access.redhat.com/articles/3626371 |
| **ocp_insights.py (supportshell)** | https://github.com/cptmorgan-rh/ocp_insights |
| **omc (must-gather client)** | https://github.com/gmeghnag/omc |
| **omc alertas KCS** | https://access.redhat.com/solutions/7067757 |
