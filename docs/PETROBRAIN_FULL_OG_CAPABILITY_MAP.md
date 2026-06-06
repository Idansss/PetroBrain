# PetroBrain Full Oil and Gas Capability Map

## Purpose

This document maps the oil-and-gas-relevant capabilities described in the
provided Claude/ChatGPT feature inventory into PetroBrain's actual architecture.
It is the implementation control document for expanding PetroBrain without
turning it into a generic consumer chatbot.

The two named benchmark PDFs were not present in the supplied attachment. This
map therefore uses the attached 30-phase inventory as the comparison baseline.
The map should be reconciled against those PDFs when they are available.

## Product Boundary

PetroBrain is:

- oil-and-gas only;
- decision support only;
- safety-first and tenant-isolated;
- grounded in operator documents and governed public sources;
- deterministic for engineering and emissions calculations;
- explicit about assumptions, stale sources, missing evidence, and uncertainty;
- auditable across chat, tools, research, documents, exports, and admin actions;
- deployable as hosted Tier A or self-hosted/on-prem Tier B.

PetroBrain is not:

- a public GPT/agent marketplace;
- a social, lifestyle, entertainment, education, medical, tax, or legal chatbot;
- an autonomous operator of live equipment;
- a filing, payment, trading, signing, or permit-approval authority;
- an uncontrolled browser, connector, or code-execution agent.

## Status Vocabulary

| Status | Meaning |
|---|---|
| already implemented | Usable end-to-end in the current repository |
| partially implemented | Important pieces exist, but the capability is incomplete |
| implement now | Included in the current Research Mode vertical slice |
| design only | Architecture and safety boundary documented; runtime remains disabled |
| future phase | Valid product capability scheduled after the current slice |
| avoid | Intentionally excluded from PetroBrain |

## Capability Matrix

### 1. Domain Chat and Tool Use

1. **Capability name:** Domain-locked conversational assistant and tool use
2. **Claude/ChatGPT equivalent:** Chat, projects chat, tool calling, structured answers
3. **PetroBrain equivalent:** Streaming `/chat`, `Orchestrator`, specialist module tools,
   guardrails, evidence packs, citations, canvas panel, feedback
4. **O&G use cases:** well control explanations, MRV support, PTW drafts, operator and
   project questions, SOP-grounded assistance
5. **Safety/compliance:** no safety bypass; deterministic numbers; human verification;
   no fabricated clauses; tenant and asset scoping
6. **Status:** already implemented
7. **Backend:** `app/api/routes_chat.py`, `app/core/orchestrator.py`,
   `app/core/guardrails.py`, `app/core/evidence.py`, `app/core/llm_service.py`
8. **Frontend:** `frontend/apps/web/app/chat/**`, `frontend/apps/web/lib/chat/**`
9. **Tests:** chat streaming, citations, tools, refusals, tenant memory, feedback
10. **Risks/guardrails:** provider tool-call variance, stale web snippets, prompt
    injection, and accidental safety authority

### 2. Oil and Gas Deep Research

1. **Capability name:** Research Mode
2. **Claude/ChatGPT equivalent:** Claude Research and ChatGPT Deep Research
3. **PetroBrain equivalent:** planned research run, source-governed execution, internal
   RAG plus approved web search, source ledger, evidence report, persistent run history
4. **O&G use cases:** company, field, basin, block, regulator, licensing, policy,
   market, project, counterparty, risk, technology, and Nigeria-specific research
5. **Safety/compliance:** domain pre-check, asset access, approved sources, no invented
   citations or numbers, legal/regulatory caveats, audit events
6. **Status:** implement now
7. **Backend:** new `app/research/**`, `app/api/routes_research.py`,
   `app/db/research_repository.py`, `app/db/migrations/015_research_runs.sql`
8. **Frontend:** new `frontend/apps/web/app/research/**`,
   `frontend/apps/web/lib/research/**`, home and chat navigation
9. **Tests:** plan lifecycle, tenant isolation, RBAC, asset access, disabled web,
   source dedupe, evidence, audit, SSE, frontend behavior
10. **Risks/guardrails:** long-running provider calls, weak snippets, source poisoning,
    hidden contradictions, date ambiguity, cost and token growth

### 3. Document Intelligence

1. **Capability name:** O&G document analysis and extraction
2. **Claude/ChatGPT equivalent:** file upload, PDF analysis, document comparison,
   extraction, summarization
3. **PetroBrain equivalent:** ingestion, extraction workers, tenant RAG, metadata,
   page/clause citations, admin document status; add analysis jobs and comparison schema
4. **O&G use cases:** FDPs, PSCs, JV agreements, SOPs, HSE plans, EIAs, drilling and
   production reports, tenders, incident reports, spreadsheets, P&IDs
5. **Safety/compliance:** every extraction cites source/page/chunk when available;
   ungrounded outputs marked unverified; malware scan; tenant/asset isolation
6. **Status:** partially implemented
7. **Backend:** `app/api/routes_documents.py`, `app/api/routes_admin_documents.py`,
   `app/workers/extractors.py`, `app/rag/**`, future `app/document_intelligence/**`
8. **Frontend:** `frontend/apps/web/app/admin/documents/**`, future
   `frontend/apps/web/app/documents/**`
9. **Tests:** extraction, page citations, comparison, contradiction handling, file
   limits, tenant isolation, malformed and malicious files
10. **Risks/guardrails:** OCR errors, table loss, document injection, obsolete revisions,
    copyrighted or confidential data handling

### 4. Canvas, Artifacts, and Drafting

1. **Capability name:** O&G drafting workspace
2. **Claude/ChatGPT equivalent:** Claude Artifacts and ChatGPT Canvas
3. **PetroBrain equivalent:** existing answer canvas and exports; add persistent drafts,
   versions, reviewer notes, approval state, citation preservation, and change log
4. **O&G use cases:** PTW, JSA/JHA, SOP, ERP, incident/RCA, regulatory letter, board
   memo, tender response, ESG narrative, technical proposal
5. **Safety/compliance:** draft-only labels; no signing/submission; preserve evidence and
   verification banners; human approval required
6. **Status:** partially implemented
7. **Backend:** future `app/db/artifact_repository.py`, `app/api/routes_artifacts.py`
8. **Frontend:** `frontend/apps/web/app/chat/components/CanvasPanel.tsx`, future
   `frontend/apps/web/app/artifacts/**`
9. **Tests:** versioning, restore, tenant isolation, citation retention, export audit
10. **Risks/guardrails:** users mistaking drafts for approved controlled documents

### 5. Projects and Workspaces

1. **Capability name:** O&G project/workspace organization
2. **Claude/ChatGPT equivalent:** Projects and shared workspaces
3. **PetroBrain equivalent:** local project store with conversations and instructions;
   migrate to tenant backend and attach files, research, artifacts, evidence, activity
4. **O&G use cases:** asset, field, basin, HSE, emissions, drilling, tender, incident,
   audit, compliance, board, and research workspaces
5. **Safety/compliance:** tenant/RBAC/project membership; archive and retention controls
6. **Status:** partially implemented
7. **Backend:** future `app/db/project_repository.py`, `app/api/routes_projects.py`
8. **Frontend:** `frontend/apps/web/app/projects/**`, `frontend/apps/web/lib/chat/projects.ts`
9. **Tests:** ownership, sharing, archive, search, instruction injection resistance
10. **Risks/guardrails:** browser-local data loss and cross-user device exposure

### 6. Memory and Company Knowledge

1. **Capability name:** Governed O&G memory
2. **Claude/ChatGPT equivalent:** Memory and company knowledge
3. **PetroBrain equivalent:** tenant memory repository, admin approval/edit/archive,
   injection guard, glossary candidates; add project/asset/user scopes and provenance
4. **O&G use cases:** units, terminology, regulator/report preferences, approved factors,
   templates, source lists, asset assumptions
5. **Safety/compliance:** memory never overrides safety, evidence, regulations, or tools;
   source/reason and approval required for sensitive memories
6. **Status:** partially implemented
7. **Backend:** `app/api/routes_admin_memory.py`, `app/db/tenant_memory_repository.py`,
   `app/core/memory_guard.py`
8. **Frontend:** `frontend/apps/web/app/admin/AdminLearningClient.tsx`, future scoped
   memory settings
9. **Tests:** tenant isolation, injection resistance, ordering, caps, approval lifecycle
10. **Risks/guardrails:** stale assumptions becoming invisible policy

### 7. Web Search and Source Governance

1. **Capability name:** Governed O&G web search
2. **Claude/ChatGPT equivalent:** web search, browsing, citations
3. **PetroBrain equivalent:** Tavily tool and citation chips; add allow/block lists,
   regulator priority, reliability/freshness scores, and approved-domain controls
4. **O&G use cases:** regulators, operators, projects, licensing, markets, M&A, policy
5. **Safety/compliance:** official sources first; never fabricate URLs; mark date and
   reliability; no unrestricted browsing or unsafe actions
6. **Status:** partially implemented; governance controls implement now for research
7. **Backend:** `app/core/web_search.py`, new `app/research/source_governance.py`
8. **Frontend:** chat source chips and new Research source controls
9. **Tests:** allowlist, blocklist, disabled provider, dedupe, stale source, malicious URL
10. **Risks/guardrails:** SEO spam, prompt injection in snippets, sanctions/legal currency

### 8. Data and Spreadsheet Analysis

1. **Capability name:** Governed O&G data analysis
2. **Claude/ChatGPT equivalent:** Advanced Data Analysis and spreadsheet analysis
3. **PetroBrain equivalent:** deterministic calc catalog and MRV inventory screens; add
   sandboxed tabular analysis jobs and reproducible analysis manifests
4. **O&G use cases:** production trends, downtime, emissions, decline curves, well tests,
   maintenance, procurement, budgets, reconciliation
5. **Safety/compliance:** no untrusted arbitrary execution; show transformations,
   assumptions, units, source rows, and reproducibility metadata
6. **Status:** partially implemented; future phase
7. **Backend:** `app/calc/**`, `app/modules/emissions_mrv/**`, future `app/analysis/**`
8. **Frontend:** emissions screens, future `frontend/apps/web/app/analysis/**`
9. **Tests:** unit handling, malformed files, formula injection, deterministic outputs
10. **Risks/guardrails:** spreadsheet formula attacks and unit/column ambiguity

### 9. Upstream Intelligence

1. **Capability name:** upstream exploration, asset, field, basin, and development support
2. **Claude/ChatGPT equivalent:** general analysis plus research and document tools
3. **PetroBrain equivalent:** domain chat/RAG/research with future structured upstream tools
4. **O&G use cases:** acreage, licensing, FDP, reserves context, field development,
   subsurface summaries, opportunity screening
5. **Safety/compliance:** no reserves certification; distinguish public, operator, and
   inferred data
6. **Status:** future phase
7. **Backend:** future `app/modules/upstream/**`
8. **Frontend:** future upstream workspace
9. **Tests:** source grounding, reserves terminology, jurisdiction and date handling
10. **Risks/guardrails:** speculative reserves and commercial claims

### 10. Drilling and Well Engineering

1. **Capability name:** drilling and well engineering support
2. **Claude/ChatGPT equivalent:** technical chat, tools, document/data analysis
3. **PetroBrain equivalent:** kill-sheet and drilling calculations; extend to hydraulics,
   casing, cementing, trajectory, DDR, NPT, barrier and program review
4. **O&G use cases:** well planning, kill sheets, pressure schedules, drilling reports
5. **Safety/compliance:** deterministic calculations; competent-person verification;
   no live command authority
6. **Status:** partially implemented
7. **Backend:** `app/modules/well_control/**`, `app/calc/drilling.py`
8. **Frontend:** chat and field calculation screens
9. **Tests:** golden engineering cases, units, limits, live-event red team
10. **Risks/guardrails:** wrong inputs and operational context omissions

### 11. Production Engineering

1. **Capability name:** production engineering support
2. **Claude/ChatGPT equivalent:** analysis, tools, reports
3. **PetroBrain equivalent:** existing Vogel/Arps calculations; add nodal analysis,
   surveillance, allocation, downtime, optimization, artificial lift workflows
4. **O&G use cases:** production review, decline, constraints, well performance
5. **Safety/compliance:** deterministic math and source data provenance
6. **Status:** partially implemented
7. **Backend:** `app/calc/production.py`, future `app/modules/production/**`
8. **Frontend:** future production workspace
9. **Tests:** engineering benchmarks, missing data, units, uncertainty
10. **Risks/guardrails:** optimization recommendations treated as control commands

### 12. Reservoir Engineering

1. **Capability name:** reservoir engineering decision support
2. **Claude/ChatGPT equivalent:** document/data analysis and technical reasoning
3. **PetroBrain equivalent:** future deterministic material balance, decline, PVT and
   reserves-support tools with explicit non-certification
4. **O&G use cases:** reservoir review, uncertainty, surveillance, development scenarios
5. **Safety/compliance:** no reserves certification or final investment authority
6. **Status:** future phase
7. **Backend:** future `app/modules/reservoir/**`
8. **Frontend:** future reservoir workspace
9. **Tests:** SPE terminology, unit systems, benchmark datasets
10. **Risks/guardrails:** false precision and unverified PVT inputs

### 13. Facilities Engineering and Operations

1. **Capability name:** facilities and integrity support
2. **Claude/ChatGPT equivalent:** image/document analysis, tools, workflow generation
3. **PetroBrain equivalent:** future equipment, process, maintenance, integrity and
   conceptual diagram modules
4. **O&G use cases:** process review, equipment troubleshooting support, maintenance,
   corrosion, inspection, operating procedures
5. **Safety/compliance:** conceptual/draft only; no final P&ID or operating authority
6. **Status:** future phase
7. **Backend:** future `app/modules/facilities/**`
8. **Frontend:** future facilities workspace
9. **Tests:** safety boundaries, asset context, evidence, image uncertainty
10. **Risks/guardrails:** visual misread and unsafe troubleshooting

### 14. HSE and Safety

1. **Capability name:** HSE workflow support
2. **Claude/ChatGPT equivalent:** drafting, analysis, tasks, document intelligence
3. **PetroBrain equivalent:** PTW template agent, safety guardrails, field PTW flow;
   extend to JSA/JHA, incident/RCA, audits, ERP and toolbox talks
4. **O&G use cases:** permits, risk assessments, incident evidence, training, checklists
5. **Safety/compliance:** no approval/signing/isolation authority; refuse concealment and
   bypass; mandatory human verification
6. **Status:** partially implemented
7. **Backend:** `app/modules/ptw/**`, `app/core/guardrails.py`
8. **Frontend:** `frontend/apps/field/app/ptw/**`, chat
9. **Tests:** red-team refusals, permit lifecycle, audit, field offline sync
10. **Risks/guardrails:** generated paperwork mistaken for authorization

### 15. Emissions, ESG, Carbon, and Environment

1. **Capability name:** emissions/MRV/ESG intelligence
2. **Claude/ChatGPT equivalent:** tools, analysis, reports, research
3. **PetroBrain equivalent:** Tier 2/3 engines, inventories, GHGEMP/OGMP/ISO/CSRD report
   generation, satellite reconciliation, abatement
4. **O&G use cases:** NUPRC MRV, methane, flaring, venting, fugitive and combustion,
   inventories, assurance readiness
5. **Safety/compliance:** deterministic factors and GWP sets; no falsification; source and
   tier disclosure
6. **Status:** already implemented for core MRV; future ESG breadth
7. **Backend:** `app/modules/emissions_mrv/**`, `app/api/routes_emissions.py`
8. **Frontend:** `frontend/apps/web/app/emissions/**`
9. **Tests:** factors, per-line CO2e, persistence, reports, reconciliation
10. **Risks/guardrails:** factor applicability and regulatory version drift

### 16. Regulatory and Compliance

1. **Capability name:** regulatory research and draft compliance support
2. **Claude/ChatGPT equivalent:** research, citations, company knowledge, drafting
3. **PetroBrain equivalent:** Research Mode plus document intelligence and governed memory
4. **O&G use cases:** NUPRC, NMDPRA, NCDMB, PIA, licensing, permits, compliance matrices
5. **Safety/compliance:** non-legal advice; official sources prioritized; clause
   verification; draft-only correspondence
6. **Status:** implement now through research foundation; broader workflows future
7. **Backend:** research service, document RAG, source governance
8. **Frontend:** Research workspace and future compliance workspace
9. **Tests:** official-source priority, stale law, fabricated clause, jurisdiction
10. **Risks/guardrails:** legal interpretation and outdated regulations

### 17. Commercial, Trading, and Market Analysis

1. **Capability name:** O&G commercial and market intelligence
2. **Claude/ChatGPT equivalent:** web research, analysis, memos
3. **PetroBrain equivalent:** Research Mode reports with future governed market datasets
4. **O&G use cases:** crude/gas/LNG markets, OPEC+, contracts, pricing summaries, M&A
5. **Safety/compliance:** not trading or investment advice; timestamp all market facts;
   cite data and assumptions
6. **Status:** implement now for research; structured analytics future
7. **Backend:** research and future commercial data providers
8. **Frontend:** Research workspace
9. **Tests:** freshness, financial disclaimer, source reliability
10. **Risks/guardrails:** time-sensitive prices and investment reliance

### 18. Midstream and Downstream

1. **Capability name:** midstream/downstream intelligence and planning support
2. **Claude/ChatGPT equivalent:** research, document/data analysis, workflow drafting
3. **PetroBrain equivalent:** Research Mode now; future pipeline, terminal, refinery,
   logistics, metering and inventory modules
4. **O&G use cases:** pipelines, LNG, terminals, refineries, depots, CNG/LPG, custody
   transfer, loss control
5. **Safety/compliance:** no operating commands or certified engineering drawings
6. **Status:** implement now for research; future engineering modules
7. **Backend:** research; future `app/modules/midstream/**`, `downstream/**`
8. **Frontend:** Research workspace; future operations workspaces
9. **Tests:** source/date grounding, calculations, operational refusals
10. **Risks/guardrails:** facility-specific constraints and unsafe generalization

### 19. Finance and Investment

1. **Capability name:** O&G finance and investment support
2. **Claude/ChatGPT equivalent:** data analysis, memos, research
3. **PetroBrain equivalent:** Research Mode reports; future deterministic economics engine
4. **O&G use cases:** CAPEX/OPEX, NPV/IRR, sensitivities, investment and board memos,
   project finance, acquisition screening
5. **Safety/compliance:** no final financial advice; show assumptions and sensitivity;
   flag unverified numbers
6. **Status:** future phase, with research memo support now
7. **Backend:** future `app/modules/economics/**`
8. **Frontend:** future economics workspace
9. **Tests:** formulas, currencies, dates, scenarios, disclaimers
10. **Risks/guardrails:** false precision and stale price decks

### 20. Procurement, Contracts, and Supply Chain

1. **Capability name:** procurement and contract support
2. **Claude/ChatGPT equivalent:** document comparison, drafting, analysis
3. **PetroBrain equivalent:** future document intelligence and artifact workflows
4. **O&G use cases:** RFP/RFQ, SOW, bid matrices, vendor due diligence, HSE requirements,
   critical spares, claims and audit checklists
5. **Safety/compliance:** draft-only; no purchase, payment, award, or contract execution
6. **Status:** future phase
7. **Backend:** future procurement/document modules
8. **Frontend:** future procurement workspace
9. **Tests:** document grounding, commercial redaction, approval gates
10. **Risks/guardrails:** commercially sensitive information and unauthorized commitments

### 21. HR, Training, and Workforce

1. **Capability name:** O&G workforce and training content
2. **Claude/ChatGPT equivalent:** document drafting, projects, tasks
3. **PetroBrain equivalent:** future governed training artifact templates
4. **O&G use cases:** competency matrices, induction, technical onboarding, PTW and
   emergency training, quizzes, local content plans
5. **Safety/compliance:** training does not replace competency assessment or certification
6. **Status:** future phase
7. **Backend:** future training artifact templates
8. **Frontend:** future training workspace
9. **Tests:** safety wording, role suitability, versioning
10. **Risks/guardrails:** generated training treated as approved curriculum

### 22. Communications, Reporting, and Presentations

1. **Capability name:** O&G communications and reporting
2. **Claude/ChatGPT equivalent:** document and presentation creation
3. **PetroBrain equivalent:** existing answer exports; future governed artifact and deck
   generation
4. **O&G use cases:** board, investor, HSE, ESG, regulator and training decks; weekly and
   monthly reports; stakeholder and crisis drafts
5. **Safety/compliance:** factual; incidents cannot be concealed; regulatory/crisis output
   is draft-only
6. **Status:** partially implemented for text/PDF/Word export; future phase
7. **Backend:** future artifact/export services
8. **Frontend:** chat export and future artifact workspace
9. **Tests:** citation retention, draft labels, export audit
10. **Risks/guardrails:** polished output masking weak evidence

### 23. O&G Software and Coding Assistant

1. **Capability name:** PetroBrain/O&G software engineering assistant
2. **Claude/ChatGPT equivalent:** Claude Code and Codex
3. **PetroBrain equivalent:** design a repository-scoped coding workflow with read-only
   analysis first, reviewed patches, tests, secret protection, and no arbitrary execution
4. **O&G use cases:** emissions, HSE, asset, maintenance, compliance, RAG and field apps
5. **Safety/compliance:** no secret exposure, security bypass, uncontrolled execution, or
   tenant-data access
6. **Status:** design only
7. **Backend:** future isolated coding service, not the production API process
8. **Frontend:** future developer workspace
9. **Tests:** sandbox escape, secret scans, patch validation, dependency policy
10. **Risks/guardrails:** remote code execution and supply-chain compromise

### 24. Agents and Workflow Automation

1. **Capability name:** safe O&G agents and workflows
2. **Claude/ChatGPT equivalent:** agents, tasks, background jobs, computer use
3. **PetroBrain equivalent:** explicit durable workflow states, read-only tools first,
   approval gates, audit and feature flags
4. **O&G use cases:** research, reporting, permit drafting, evidence collection,
   compliance reminders, incident triage, vendor evaluation
5. **Safety/compliance:** no payments, filings, signing, permit approval, live control, or
   bypass; human confirmation for sensitive actions
6. **Status:** design only beyond Research Mode
7. **Backend:** future `app/workflows/**`
8. **Frontend:** future workflow monitor and approvals
9. **Tests:** approval gates, idempotency, retry, audit, tenant isolation
10. **Risks/guardrails:** unintended side effects and over-broad tool permissions

### 25. Connectors, MCP, and Enterprise Search

1. **Capability name:** governed company connectors and MCP
2. **Claude/ChatGPT equivalent:** connectors, MCP, enterprise search, company knowledge
3. **PetroBrain equivalent:** tenant-scoped connector registry with admin approval,
   read-only default, citation adapters, RBAC and audit
4. **O&G use cases:** SharePoint/Drive/EDMS, SAP, Maximo, PI historian, HSE, procurement,
   engineering repositories and data warehouses
5. **Safety/compliance:** read-only default; per-connector scopes; no write without explicit
   approval; historian access remains design-only
6. **Status:** design only; connector flag remains off
7. **Backend:** future `app/connectors/**`
8. **Frontend:** future admin connector registry and Research source selector
9. **Tests:** tenant isolation, permission narrowing, source provenance, write denial
10. **Risks/guardrails:** enterprise data leakage and prompt injection from connected data

### 26. Images, Diagrams, and Visual Explanation

1. **Capability name:** O&G visual explanation
2. **Claude/ChatGPT equivalent:** image analysis/generation and canvas diagrams
3. **PetroBrain equivalent:** current image attachments; future draft process diagrams,
   workflows, matrices, architecture and safety visuals
4. **O&G use cases:** PTW flows, emissions flows, HSE posters, training, asset hierarchies
5. **Safety/compliance:** conceptual/draft markings; no final P&IDs or construction drawings
6. **Status:** partially implemented for image input; future phase for generation
7. **Backend:** attachment handling and future visual artifact service
8. **Frontend:** chat attachments and future visual canvas
9. **Tests:** image uncertainty, domain lock, draft watermark
10. **Risks/guardrails:** users acting on plausible but incorrect diagrams

### 27. Nigeria-Specific Support

1. **Capability name:** Nigeria O&G regulatory and market intelligence
2. **Claude/ChatGPT equivalent:** research and company knowledge
3. **PetroBrain equivalent:** NUPRC-focused MRV plus Research Mode source priority and
   Nigeria report templates
4. **O&G use cases:** NUPRC, NMDPRA, NCDMB, PIA, HCDT, OML/OPL, bid rounds, gas policy,
   local content, regulator drafts
5. **Safety/compliance:** official sources first; non-legal advice; no fabricated clauses
6. **Status:** partially implemented; Research Mode implements the intelligence foundation
7. **Backend:** emissions module, research source governance
8. **Frontend:** emissions and Research workspaces
9. **Tests:** Nigeria source priority, law/date handling, clause validation
10. **Risks/guardrails:** regulatory changes and unofficial summaries

### 28. Tasks, Schedules, and Recurring Reports

1. **Capability name:** tenant-scoped scheduled O&G tasks
2. **Claude/ChatGPT equivalent:** Tasks and scheduled workflows
3. **PetroBrain equivalent:** Celery exists for ingestion; add safe schedule definitions,
   draft outputs, reminders, run history, and feature flag
4. **O&G use cases:** production/HSE/emissions summaries, permit/license reminders,
   regulator/news monitoring, maintenance and audit follow-up
5. **Safety/compliance:** no unsafe action; draft-only reports; owner/admin controls
6. **Status:** design only
7. **Backend:** `app/workers/**`, future schedule repository/routes
8. **Frontend:** future tasks workspace
9. **Tests:** tenant isolation, recurrence, retries, disabled flag, audit
10. **Risks/guardrails:** missed or duplicated tasks and stale reports

### 29. Enterprise Admin, Audit, Compliance, and Governance

1. **Capability name:** enterprise controls
2. **Claude/ChatGPT equivalent:** enterprise admin, audit, compliance APIs, analytics
3. **PetroBrain equivalent:** tenant/user/asset admin, audit events and hash chain,
   learning/feedback, errors, usage metrics, production validation
4. **O&G use cases:** access control, investigation, evidence history, calculation and
   model usage governance
5. **Safety/compliance:** least privilege, raw prompt/output minimization, immutable logs,
   retention and compliance exports
6. **Status:** partially implemented
7. **Backend:** `app/api/routes_admin_*`, `app/core/audit.py`,
   `app/db/audit_events_repository.py`, `app/core/observability.py`
8. **Frontend:** `frontend/apps/admin/**`, web admin learning/documents
9. **Tests:** RBAC, cross-tenant access, RLS, hash chain, redaction
10. **Risks/guardrails:** platform-admin overreach and sensitive log payloads

### 30. Evals and Observability

1. **Capability name:** trust evaluation and telemetry
2. **Claude/ChatGPT equivalent:** evals, analytics, observability and safety monitoring
3. **PetroBrain equivalent:** engineering tests, safety eval harness, structured logs,
   OpenTelemetry, Prometheus, token/cost metrics, audit and errors
4. **O&G use cases:** well control, MRV, PTW, citations, research, documents, memory,
   connectors and domain refusals
5. **Safety/compliance:** zero tolerance for bypass advice, fabricated citations, tenant
   leaks, and unverified safety-critical numbers
6. **Status:** partially implemented; Research evals implement now
7. **Backend:** `tests/eval_harness.py`, `app/core/observability.py`, new research tests
8. **Frontend:** admin analytics future
9. **Tests:** CI gates for tests, type checks, build, safety, citations and isolation
10. **Risks/guardrails:** test sets drifting away from real operator failure modes

### 31. Privacy and Deployment Controls

1. **Capability name:** privacy, retention, cloud/on-prem and workspace controls
2. **Claude/ChatGPT equivalent:** enterprise privacy and data controls
3. **PetroBrain equivalent:** Tier A/Tier B provider abstraction, tenant RLS, local or
   Postgres persistence, secure config validation, revocation, malware scanning
4. **O&G use cases:** confidential operator knowledge, sovereign deployments, OT-adjacent
   read-only use
5. **Safety/compliance:** no cross-tier silent fallback; production-safe stores and TLS;
   explicit retention policy remains required
6. **Status:** partially implemented
7. **Backend:** `app/config.py`, `app/core/llm_service.py`, `app/db/pg.py`, `infra/**`
8. **Frontend:** session-scoped auth storage and demo warnings
9. **Tests:** production config, RLS role, revocation, CORS, hardening
10. **Risks/guardrails:** local JSON in production and misconfigured privileged DB roles

### 32. Intentionally Avoided Generic Features

1. **Capability name:** consumer and unsafe frontier-platform features
2. **Claude/ChatGPT equivalent:** public bot marketplace, broad lifestyle assistant,
   unrestricted browser/computer use, autonomous transactions
3. **PetroBrain equivalent:** none
4. **O&G use cases:** none that justify the risk or product dilution
5. **Safety/compliance:** domain lock and explicit refusal
6. **Status:** avoid
7. **Backend:** `app/core/guardrails.py`
8. **Frontend:** no marketplace or generic discovery UI
9. **Tests:** out-of-domain refusal and unavailable unsafe actions
10. **Risks/guardrails:** scope creep, unsafe autonomy, and weakened engineering trust

## Current Implementation Priority

The current vertical slice is Research Mode because it unlocks the broadest safe
set of requested capabilities without introducing write automation:

1. persistent tenant-scoped research plans and runs;
2. plan approval/edit/rejection;
3. asset/RBAC enforcement;
4. internal document and governed web source collection;
5. source dedupe, reliability, freshness, contradiction and gap analysis;
6. structured report with citations, checked/unverified sections, confidence,
   safety notices and next actions;
7. streaming events and auditable lifecycle;
8. a dedicated analyst workstation in the web app;
9. feature flags and safe limits for sources and steps.

Later phases should build on this source ledger and workflow lifecycle instead of
creating independent agents with different provenance or approval behavior.
