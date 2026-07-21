# ReqAI – High-Level Design (HLD)

**Version:** 1.0.0  
**Status:** Approved  
**Author:** Enterprise Architecture  
**Last Updated:** 2025  
**Classification:** Internal – Confidential

---

## Table of Contents

1. [Application Architecture Overview](#1-application-architecture-overview)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Folder Structure](#4-folder-structure)
5. [Database Design](#5-database-design)
6. [Authentication & Authorization Flow](#6-authentication--authorization-flow)
7. [API Flow](#7-api-flow)
8. [Sequence Diagrams](#8-sequence-diagrams)
9. [Deployment Diagram](#9-deployment-diagram)
10. [Technology Selection](#10-technology-selection)

---

## 1. Application Architecture Overview

ReqAI follows a **layered, clean architecture** with a strict separation between the presentation, application, domain, and infrastructure layers. The system is designed as a **monorepo** containing a React SPA frontend, an Express/Node.js backend, and shared TypeScript types.

### 1.1 System Context Diagram

```mermaid
C4Context
    title ReqAI – System Context

    Person(ba, "Business Analyst", "Creates and submits requirements")
    Person(dev, "Developer", "Reviews structured artifacts")
    Person(qa, "QA Engineer", "Consumes test scenarios")
    Person(arch, "Architect", "Reviews NFRs and risks")
    Person(pm, "Project Manager", "Monitors project health")

    System(reqai, "ReqAI Platform", "AI-powered requirement analysis web application")

    System_Ext(ai, "AI Provider", "OpenAI / Azure OpenAI / Anthropic / Watsonx")
    System_Ext(email, "Email Service", "SMTP / AWS SES — notifications")
    System_Ext(storage, "Object Storage", "File uploads — S3 / local")

    Rel(ba, reqai, "Submits requirements, triggers analysis")
    Rel(dev, reqai, "Reads artifacts, acceptance criteria")
    Rel(qa, reqai, "Reads test scenarios")
    Rel(arch, reqai, "Reads NFRs and risk analysis")
    Rel(pm, reqai, "Views dashboard and complexity scores")
    Rel(reqai, ai, "Sends prompts, receives structured output", "HTTPS / REST")
    Rel(reqai, email, "Sends notifications", "SMTP / API")
    Rel(reqai, storage, "Stores uploaded documents", "SDK / API")
```

---

### 1.2 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client Layer — Browser"]
        SPA["React 19 SPA<br/>Vite + TypeScript"]
    end

    subgraph Gateway["API Gateway / Reverse Proxy"]
        NGINX["NGINX / API Gateway<br/>Rate Limiting · TLS Termination · CORS"]
    end

    subgraph Backend["Backend — Node.js + Express + TypeScript"]
        direction TB
        API["REST API Layer<br/>Controllers · Routes · Validators"]
        APP["Application Layer<br/>Services · Use Cases · DTOs"]
        DOMAIN["Domain Layer<br/>Entities · Interfaces · Business Rules"]
        INFRA["Infrastructure Layer<br/>Repositories · DB · AI Adapter · Email"]
    end

    subgraph DataLayer["Data Layer"]
        PG[("PostgreSQL 15<br/>Primary Database")]
        REDIS[("Redis<br/>Session · Cache · Job Queue")]
    end

    subgraph ExternalServices["External Services"]
        AI["AI Provider<br/>OpenAI · Azure OpenAI<br/>Anthropic · Watsonx"]
        S3["Object Storage<br/>S3 / MinIO"]
        MAIL["Email Service<br/>SMTP / SES"]
    end

    SPA -- "HTTPS REST / JSON" --> NGINX
    NGINX --> API
    API --> APP
    APP --> DOMAIN
    APP --> INFRA
    INFRA --> PG
    INFRA --> REDIS
    INFRA --> AI
    INFRA --> S3
    INFRA --> MAIL

    style Client fill:#e8f4fd,stroke:#3b82d4
    style Backend fill:#f0fdf4,stroke:#16a34a
    style DataLayer fill:#fef9c3,stroke:#ca8a04
    style ExternalServices fill:#fdf4ff,stroke:#7c5cd8
```

---

## 2. Frontend Architecture

### 2.1 Frontend Layered Architecture

```mermaid
graph TB
    subgraph Presentation["Presentation Layer"]
        PAGES["Pages / Views<br/>Route-bound components"]
        COMPONENTS["Shared Components<br/>Reusable UI primitives"]
        LAYOUTS["Layouts<br/>AuthLayout · AppLayout · PublicLayout"]
    end

    subgraph State["State Management — Redux Toolkit"]
        STORE["Redux Store"]
        SLICES["Feature Slices<br/>authSlice · projectSlice<br/>requirementSlice · analysisSlice · uiSlice"]
        THUNKS["Async Thunks<br/>API side effects"]
        SELECTORS["Selectors<br/>Memoized derived state"]
    end

    subgraph Services["Service Layer"]
        AXIOS["Axios Instance<br/>Interceptors · Auth header · Error normalization"]
        API_SVC["API Services<br/>authService · projectService<br/>requirementService · analysisService"]
    end

    subgraph Routing["Routing — React Router v6"]
        ROUTER["App Router"]
        GUARDS["Route Guards<br/>PrivateRoute · RoleGuard"]
    end

    subgraph Cross["Cross-Cutting"]
        HOOKS["Custom Hooks<br/>useAuth · useProject · useAnalysis"]
        THEME["MUI Theme Provider<br/>Light / Dark mode"]
        ERROR["Error Boundary<br/>Global error fallback"]
        TYPES["TypeScript Types<br/>Shared DTOs / Interfaces"]
    end

    PAGES --> COMPONENTS
    PAGES --> LAYOUTS
    PAGES --> HOOKS
    HOOKS --> STORE
    STORE --> SLICES
    SLICES --> THUNKS
    THUNKS --> API_SVC
    API_SVC --> AXIOS
    PAGES --> ROUTER
    ROUTER --> GUARDS

    style Presentation fill:#e8f4fd,stroke:#3b82d4
    style State fill:#f0fdf4,stroke:#16a34a
    style Services fill:#fef9c3,stroke:#ca8a04
    style Routing fill:#fdf4ff,stroke:#7c5cd8
```

### 2.2 Frontend Page Map

```mermaid
graph LR
    ROOT["/"] --> AUTH_LAYOUT["AuthLayout"]
    ROOT --> APP_LAYOUT["AppLayout (Protected)"]

    AUTH_LAYOUT --> LOGIN["/login<br/>LoginPage"]
    AUTH_LAYOUT --> REGISTER["/register<br/>RegisterPage"]
    AUTH_LAYOUT --> FORGOT["/forgot-password<br/>ForgotPasswordPage"]

    APP_LAYOUT --> DASH["/dashboard<br/>DashboardPage"]
    APP_LAYOUT --> PROJECTS["/projects<br/>ProjectsListPage"]
    APP_LAYOUT --> PROJ_DETAIL["/projects/:id<br/>ProjectDetailPage"]
    APP_LAYOUT --> REQ_LIST["/projects/:id/requirements<br/>RequirementsListPage"]
    APP_LAYOUT --> REQ_CREATE["/projects/:id/requirements/new<br/>CreateRequirementPage"]
    APP_LAYOUT --> REQ_DETAIL["/projects/:id/requirements/:reqId<br/>RequirementDetailPage"]
    APP_LAYOUT --> ANALYSIS["/projects/:id/requirements/:reqId/analysis<br/>AnalysisResultPage"]
    APP_LAYOUT --> SETTINGS["/settings<br/>SettingsPage"]
    APP_LAYOUT --> ADMIN["/admin<br/>AdminPage (Admin only)"]

    style AUTH_LAYOUT fill:#fef9c3,stroke:#ca8a04
    style APP_LAYOUT fill:#e8f4fd,stroke:#3b82d4
```

---

## 3. Backend Architecture

### 3.1 Clean Architecture Layers

```mermaid
graph TB
    subgraph Presentation["API / Presentation Layer"]
        ROUTES["Express Routes<br/>route definitions"]
        CONTROLLERS["Controllers<br/>HTTP in → DTO out"]
        VALIDATORS["Request Validators<br/>Zod / Joi schemas"]
        MIDDLEWARES["Middlewares<br/>auth · rbac · errorHandler · logger · rateLimiter"]
    end

    subgraph Application["Application Layer"]
        USE_CASES["Use Cases / Services<br/>AuthService · ProjectService<br/>RequirementService · AnalysisService<br/>ArtifactService · NotificationService"]
        DTOS["DTOs<br/>Request / Response contracts"]
        MAPPERS["Mappers<br/>Entity ↔ DTO"]
    end

    subgraph Domain["Domain Layer (Pure — no framework deps)"]
        ENTITIES["Entities<br/>User · Project · Requirement<br/>Analysis · Artifact · AuditLog"]
        INTERFACES["Repository Interfaces<br/>IUserRepo · IProjectRepo<br/>IRequirementRepo · IAnalysisRepo"]
        VALUE_OBJECTS["Value Objects<br/>RequirementStatus · ComplexityLevel<br/>RiskSeverity · UserRole"]
        DOMAIN_SERVICES["Domain Services<br/>Business rule validation"]
    end

    subgraph Infrastructure["Infrastructure Layer"]
        REPOS["Repository Implementations<br/>PostgresUserRepo · PostgresProjectRepo<br/>PostgresRequirementRepo · PostgresAnalysisRepo"]
        AI_ADAPTER["AI Provider Adapter<br/>OpenAIAdapter · AnthropicAdapter<br/>WatsonxAdapter (Strategy Pattern)"]
        EMAIL_ADAPTER["Email Adapter<br/>SMTPAdapter · SESAdapter"]
        FILE_ADAPTER["File Storage Adapter<br/>S3Adapter · LocalAdapter"]
        DB["Database<br/>pg / node-postgres + Migrations"]
        QUEUE["Job Queue<br/>Bull + Redis"]
    end

    ROUTES --> CONTROLLERS
    CONTROLLERS --> VALIDATORS
    CONTROLLERS --> USE_CASES
    USE_CASES --> DTOS
    USE_CASES --> MAPPERS
    USE_CASES --> INTERFACES
    USE_CASES --> DOMAIN_SERVICES
    INTERFACES --> REPOS
    USE_CASES --> AI_ADAPTER
    USE_CASES --> EMAIL_ADAPTER
    USE_CASES --> FILE_ADAPTER
    REPOS --> DB
    AI_ADAPTER --> QUEUE

    style Presentation fill:#fef9c3,stroke:#ca8a04
    style Application fill:#e8f4fd,stroke:#3b82d4
    style Domain fill:#f0fdf4,stroke:#16a34a
    style Infrastructure fill:#fdf4ff,stroke:#7c5cd8
```

### 3.2 AI Analysis Pipeline

```mermaid
flowchart TD
    TRIGGER["User triggers analysis\nPOST /api/analysis/:requirementId"] --> VALIDATE["Validate requirement\nexists & is in valid state"]
    VALIDATE --> ENQUEUE["Enqueue job\nBull Queue — Redis"]
    ENQUEUE --> RESPONSE["202 Accepted\n{ jobId, status: 'queued' }"]
    ENQUEUE --> WORKER["Background Worker\npicks up job"]
    WORKER --> FETCH["Fetch requirement text\nfrom PostgreSQL"]
    FETCH --> PROMPT["Build AI Prompt\nPromptBuilder service"]
    PROMPT --> AI_CALL["Call AI Provider\nvia AIProviderAdapter"]
    AI_CALL --> PARSE["Parse & Validate\nstructured JSON response"]
    PARSE --> PERSIST["Persist Analysis\n+ all Artifacts to DB"]
    PERSIST --> STATUS["Update requirement status\n→ Analyzed"]
    STATUS --> NOTIFY["Emit in-app notification\nWebSocket / SSE"]
    NOTIFY --> DONE["Analysis available\nto user"]

    AI_CALL -- "Provider error / timeout" --> RETRY["Retry (max 3)\nexponential backoff"]
    RETRY -- "All retries failed" --> FAIL["Mark job failed\nNotify user of failure"]

    style TRIGGER fill:#e8f4fd,stroke:#3b82d4
    style AI_CALL fill:#fdf4ff,stroke:#7c5cd8
    style DONE fill:#f0fdf4,stroke:#16a34a
    style FAIL fill:#fee2e2,stroke:#dc2626
```

---

## 4. Folder Structure

### 4.1 Monorepo Root

```
reqai/
├── frontend/                   # React 19 + Vite SPA
├── backend/                    # Node.js + Express API
├── shared/                     # Shared TypeScript types (DTOs, enums)
├── docs/                       # Architecture docs, PRD, HLD
├── .env.example                # Root env template
├── docker-compose.yml          # Local dev orchestration
├── docker-compose.prod.yml     # Production orchestration
└── package.json                # Monorepo workspace root
```

### 4.2 Frontend Folder Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── store.ts                    # Redux store configuration
│   │   ├── rootReducer.ts              # Combined reducers
│   │   └── router.tsx                  # React Router configuration
│   │
│   ├── features/                       # Feature-based slices
│   │   ├── auth/
│   │   │   ├── authSlice.ts
│   │   │   ├── authThunks.ts
│   │   │   ├── authSelectors.ts
│   │   │   └── types.ts
│   │   ├── projects/
│   │   │   ├── projectSlice.ts
│   │   │   ├── projectThunks.ts
│   │   │   ├── projectSelectors.ts
│   │   │   └── types.ts
│   │   ├── requirements/
│   │   │   ├── requirementSlice.ts
│   │   │   ├── requirementThunks.ts
│   │   │   ├── requirementSelectors.ts
│   │   │   └── types.ts
│   │   ├── analysis/
│   │   │   ├── analysisSlice.ts
│   │   │   ├── analysisThunks.ts
│   │   │   ├── analysisSelectors.ts
│   │   │   └── types.ts
│   │   └── ui/
│   │       ├── uiSlice.ts              # Notifications, modals, loading
│   │       └── types.ts
│   │
│   ├── pages/                          # Route-bound page components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── projects/
│   │   │   ├── ProjectsListPage.tsx
│   │   │   ├── ProjectDetailPage.tsx
│   │   │   └── CreateProjectPage.tsx
│   │   ├── requirements/
│   │   │   ├── RequirementsListPage.tsx
│   │   │   ├── RequirementDetailPage.tsx
│   │   │   └── CreateRequirementPage.tsx
│   │   ├── analysis/
│   │   │   └── AnalysisResultPage.tsx
│   │   ├── admin/
│   │   │   └── AdminPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   │
│   ├── components/                     # Shared reusable components
│   │   ├── common/
│   │   │   ├── AppButton.tsx
│   │   │   ├── AppCard.tsx
│   │   │   ├── AppChip.tsx
│   │   │   ├── AppDialog.tsx
│   │   │   ├── AppTable.tsx
│   │   │   ├── AppTextField.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── StatusChip.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── NotificationBell.tsx
│   │   ├── analysis/
│   │   │   ├── AnalysisTabs.tsx
│   │   │   ├── UserStoriesPanel.tsx
│   │   │   ├── AcceptanceCriteriaPanel.tsx
│   │   │   ├── TestScenariosPanel.tsx
│   │   │   ├── NFRPanel.tsx
│   │   │   ├── RisksPanel.tsx
│   │   │   ├── TechnicalNotesPanel.tsx
│   │   │   ├── ComplexityScoreCard.tsx
│   │   │   ├── MissingInfoPanel.tsx
│   │   │   └── ExportMenu.tsx
│   │   └── requirements/
│   │       ├── RequirementCard.tsx
│   │       ├── RequirementForm.tsx
│   │       ├── RequirementStatusBadge.tsx
│   │       └── FileUploadZone.tsx
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProject.ts
│   │   ├── useRequirement.ts
│   │   ├── useAnalysis.ts
│   │   ├── useNotifications.ts
│   │   ├── useDebounce.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── services/                       # Axios-based API services
│   │   ├── axios.instance.ts           # Base Axios config + interceptors
│   │   ├── auth.service.ts
│   │   ├── project.service.ts
│   │   ├── requirement.service.ts
│   │   ├── analysis.service.ts
│   │   └── notification.service.ts
│   │
│   ├── types/                          # TypeScript interfaces
│   │   ├── auth.types.ts
│   │   ├── project.types.ts
│   │   ├── requirement.types.ts
│   │   ├── analysis.types.ts
│   │   └── api.types.ts                # ApiResponse<T>, PaginatedResponse<T>
│   │
│   ├── theme/
│   │   ├── theme.ts                    # MUI theme configuration
│   │   ├── palette.ts
│   │   └── typography.ts
│   │
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── exportUtils.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── .env.local
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 4.3 Backend Folder Structure

```
backend/
├── src/
│   ├── api/                            # Presentation Layer
│   │   ├── routes/
│   │   │   ├── index.ts                # Route aggregator
│   │   │   ├── auth.routes.ts
│   │   │   ├── project.routes.ts
│   │   │   ├── requirement.routes.ts
│   │   │   ├── analysis.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── project.controller.ts
│   │   │   ├── requirement.controller.ts
│   │   │   ├── analysis.controller.ts
│   │   │   └── admin.controller.ts
│   │   ├── validators/
│   │   │   ├── auth.validator.ts
│   │   │   ├── project.validator.ts
│   │   │   ├── requirement.validator.ts
│   │   │   └── analysis.validator.ts
│   │   └── middlewares/
│   │       ├── authenticate.middleware.ts
│   │       ├── authorize.middleware.ts
│   │       ├── errorHandler.middleware.ts
│   │       ├── requestLogger.middleware.ts
│   │       ├── rateLimiter.middleware.ts
│   │       └── validate.middleware.ts
│   │
│   ├── application/                    # Application Layer
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── project.service.ts
│   │   │   ├── requirement.service.ts
│   │   │   ├── analysis.service.ts
│   │   │   ├── artifact.service.ts
│   │   │   └── notification.service.ts
│   │   ├── dtos/
│   │   │   ├── auth.dto.ts
│   │   │   ├── project.dto.ts
│   │   │   ├── requirement.dto.ts
│   │   │   └── analysis.dto.ts
│   │   └── mappers/
│   │       ├── project.mapper.ts
│   │       ├── requirement.mapper.ts
│   │       └── analysis.mapper.ts
│   │
│   ├── domain/                         # Domain Layer (framework-free)
│   │   ├── entities/
│   │   │   ├── User.entity.ts
│   │   │   ├── Project.entity.ts
│   │   │   ├── Requirement.entity.ts
│   │   │   ├── Analysis.entity.ts
│   │   │   ├── Artifact.entity.ts
│   │   │   └── AuditLog.entity.ts
│   │   ├── interfaces/
│   │   │   ├── repositories/
│   │   │   │   ├── IUserRepository.ts
│   │   │   │   ├── IProjectRepository.ts
│   │   │   │   ├── IRequirementRepository.ts
│   │   │   │   └── IAnalysisRepository.ts
│   │   │   └── services/
│   │   │       ├── IAIProvider.ts
│   │   │       ├── IEmailProvider.ts
│   │   │       └── IFileStorageProvider.ts
│   │   ├── value-objects/
│   │   │   ├── RequirementStatus.ts
│   │   │   ├── ComplexityLevel.ts
│   │   │   ├── RiskSeverity.ts
│   │   │   └── UserRole.ts
│   │   └── errors/
│   │       ├── AppError.ts
│   │       ├── NotFoundError.ts
│   │       ├── UnauthorizedError.ts
│   │       ├── ForbiddenError.ts
│   │       └── ValidationError.ts
│   │
│   ├── infrastructure/                 # Infrastructure Layer
│   │   ├── database/
│   │   │   ├── connection.ts           # pg Pool setup
│   │   │   ├── migrations/
│   │   │   │   ├── 001_create_users.sql
│   │   │   │   ├── 002_create_projects.sql
│   │   │   │   ├── 003_create_requirements.sql
│   │   │   │   ├── 004_create_analyses.sql
│   │   │   │   ├── 005_create_artifacts.sql
│   │   │   │   └── 006_create_audit_logs.sql
│   │   │   └── seeds/
│   │   │       └── seed.ts
│   │   ├── repositories/
│   │   │   ├── user.repository.ts
│   │   │   ├── project.repository.ts
│   │   │   ├── requirement.repository.ts
│   │   │   └── analysis.repository.ts
│   │   ├── ai/
│   │   │   ├── AIProviderFactory.ts    # Factory — selects provider
│   │   │   ├── OpenAIAdapter.ts
│   │   │   ├── AnthropicAdapter.ts
│   │   │   ├── AzureOpenAIAdapter.ts
│   │   │   └── WatsonxAdapter.ts
│   │   ├── queue/
│   │   │   ├── queue.ts                # Bull queue setup
│   │   │   └── analysis.worker.ts      # Worker process
│   │   ├── email/
│   │   │   ├── SMTPAdapter.ts
│   │   │   └── SESAdapter.ts
│   │   └── storage/
│   │       ├── S3Adapter.ts
│   │       └── LocalStorageAdapter.ts
│   │
│   ├── config/
│   │   ├── env.ts                      # Typed env validation (zod)
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── ai.config.ts
│   │
│   ├── shared/
│   │   ├── logger.ts                   # Winston structured logger
│   │   ├── constants.ts
│   │   └── utils.ts
│   │
│   ├── app.ts                          # Express app setup
│   └── server.ts                       # HTTP server entry point
│
├── .env
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json
└── package.json
```

### 4.4 Shared Package Structure

```
shared/
├── src/
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── project.types.ts
│   │   ├── requirement.types.ts
│   │   └── analysis.types.ts
│   ├── enums/
│   │   ├── UserRole.enum.ts
│   │   ├── RequirementStatus.enum.ts
│   │   ├── ComplexityLevel.enum.ts
│   │   └── RiskSeverity.enum.ts
│   └── index.ts
├── tsconfig.json
└── package.json
```

---

## 5. Database Design

### 5.1 Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        varchar role
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECTS {
        uuid id PK
        varchar name
        text description
        varchar status
        uuid owner_id FK
        boolean is_archived
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECT_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        varchar role
        timestamptz joined_at
    }

    REQUIREMENTS {
        uuid id PK
        uuid project_id FK
        uuid created_by FK
        varchar title
        text body
        varchar type
        varchar priority
        varchar status
        varchar source
        text[] tags
        integer version
        timestamptz created_at
        timestamptz updated_at
    }

    REQUIREMENT_VERSIONS {
        uuid id PK
        uuid requirement_id FK
        integer version
        text body
        uuid changed_by FK
        text change_note
        timestamptz created_at
    }

    ANALYSES {
        uuid id PK
        uuid requirement_id FK
        uuid triggered_by FK
        varchar status
        varchar ai_provider
        varchar ai_model
        integer tokens_used
        integer duration_ms
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    ARTIFACTS {
        uuid id PK
        uuid analysis_id FK
        varchar artifact_type
        jsonb content
        boolean is_edited
        uuid edited_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        varchar type
        varchar title
        text message
        jsonb payload
        boolean is_read
        timestamptz created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb before_state
        jsonb after_state
        varchar ip_address
        timestamptz created_at
    }

    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ PROJECT_MEMBERS : "member of"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has members"
    PROJECTS ||--o{ REQUIREMENTS : "contains"
    USERS ||--o{ REQUIREMENTS : "creates"
    REQUIREMENTS ||--o{ REQUIREMENT_VERSIONS : "versioned as"
    REQUIREMENTS ||--o{ ANALYSES : "analyzed by"
    ANALYSES ||--o{ ARTIFACTS : "produces"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "generates"
```

### 5.2 Artifact Content JSON Schema

The `artifacts.content` JSONB column stores structured AI output per artifact type:

```
Artifact Types:
├── USER_STORIES         → { stories: [{ id, role, goal, benefit, priority }] }
├── ACCEPTANCE_CRITERIA  → { criteria: [{ storyId, given, when, then }] }
├── TEST_SCENARIOS       → { scenarios: [{ id, title, type, steps, expected }] }
├── NON_FUNCTIONAL_REQS  → { nfrs: [{ category, description, priority }] }
├── RISKS                → { risks: [{ id, title, description, severity, mitigation }] }
├── TECHNICAL_NOTES      → { notes: string, dependencies: [], considerations: [] }
├── COMPLEXITY_SCORE     → { level, score, reasoning, breakdown: {} }
├── SUMMARY              → { executive: string, keyPoints: [] }
└── MISSING_INFO         → { items: [{ area, question, impact }] }
```

---

## 6. Authentication & Authorization Flow

### 6.1 Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant GW as API Gateway (NGINX)
    participant AUTH as Auth Controller
    participant SVC as Auth Service
    participant DB as PostgreSQL
    participant REDIS as Redis

    User->>FE: Submit login form (email, password)
    FE->>GW: POST /api/auth/login
    GW->>AUTH: Forward request (rate limit check passed)
    AUTH->>SVC: login(email, password)
    SVC->>DB: SELECT user WHERE email = $1
    DB-->>SVC: User record
    SVC->>SVC: bcrypt.compare(password, hash)
    alt Invalid credentials
        SVC-->>AUTH: UnauthorizedError
        AUTH-->>FE: 401 { message: "Invalid credentials" }
    else Valid credentials
        SVC->>SVC: jwt.sign({ userId, role }, secret, { expiresIn: '15m' })
        SVC->>SVC: generate refreshToken (UUID)
        SVC->>REDIS: SET refresh:{token} → userId (TTL: 7d)
        SVC-->>AUTH: { accessToken, refreshToken, user }
        AUTH-->>FE: 200 { accessToken, refreshToken, user }
        FE->>FE: Store accessToken in memory\nStore refreshToken in httpOnly cookie
    end
```

### 6.2 Token Refresh Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (Axios Interceptor)
    participant API as Backend API
    participant SVC as Auth Service
    participant REDIS as Redis

    User->>FE: Makes any authenticated request
    FE->>API: Request with expired accessToken
    API-->>FE: 401 Unauthorized
    FE->>FE: Axios response interceptor catches 401
    FE->>API: POST /api/auth/refresh (httpOnly cookie with refreshToken)
    API->>SVC: refresh(refreshToken)
    SVC->>REDIS: GET refresh:{token}
    alt Token not found / expired
        SVC-->>API: UnauthorizedError
        API-->>FE: 401 — session expired
        FE->>FE: Clear state, redirect to /login
    else Token valid
        SVC->>REDIS: DEL refresh:{token} (rotate)
        SVC->>SVC: Issue new accessToken + new refreshToken
        SVC->>REDIS: SET refresh:{newToken} → userId (TTL: 7d)
        SVC-->>API: { accessToken, refreshToken }
        API-->>FE: 200 { accessToken, refreshToken }
        FE->>FE: Update accessToken in memory\nUpdate refreshToken cookie
        FE->>API: Retry original request with new accessToken
    end
```

### 6.3 RBAC Authorization Model

```mermaid
graph TD
    REQUEST["Incoming Request"] --> AUTH_MW["authenticate.middleware\nVerify JWT → attach req.user"]
    AUTH_MW --> RBAC_MW["authorize.middleware\nauthorize(requiredRole[])"]
    RBAC_MW --> ROLE_CHECK{{"req.user.role\nin allowedRoles?"}}
    ROLE_CHECK -- "Yes" --> CONTROLLER["Controller Handler"]
    ROLE_CHECK -- "No" --> FORBIDDEN["403 Forbidden"]

    subgraph Roles["Role Hierarchy"]
        ADMIN["ADMIN\nFull access"]
        BA["BUSINESS_ANALYST\nProject + Requirements + Analysis"]
        DEV["DEVELOPER\nRead requirements + analysis"]
        QA["QA_ENGINEER\nRead requirements + analysis"]
        ARCH["ARCHITECT\nRead requirements + analysis"]
        PM["PROJECT_MANAGER\nProject management + read analysis"]
    end
```

---

## 7. API Flow

### 7.1 REST API Endpoints

```
BASE URL: /api/v1

──────────────────────────────────────────
AUTH
──────────────────────────────────────────
POST   /auth/register              Register new user
POST   /auth/login                 Login → JWT
POST   /auth/refresh               Refresh access token
POST   /auth/logout                Invalidate refresh token
POST   /auth/forgot-password       Request password reset email
POST   /auth/reset-password        Reset password with token

──────────────────────────────────────────
PROJECTS
──────────────────────────────────────────
GET    /projects                   List all projects (user's)
POST   /projects                   Create project
GET    /projects/:id               Get project by ID
PUT    /projects/:id               Update project
DELETE /projects/:id               Archive project (soft delete)
GET    /projects/:id/members       List project members
POST   /projects/:id/members       Add member to project
DELETE /projects/:id/members/:uid  Remove member from project
GET    /projects/:id/dashboard     Project dashboard metrics

──────────────────────────────────────────
REQUIREMENTS
──────────────────────────────────────────
GET    /projects/:id/requirements          List requirements
POST   /projects/:id/requirements          Create requirement
GET    /projects/:id/requirements/:reqId   Get requirement
PUT    /projects/:id/requirements/:reqId   Update requirement
DELETE /projects/:id/requirements/:reqId   Delete requirement
GET    /projects/:id/requirements/:reqId/versions  Version history
POST   /projects/:id/requirements/upload   Upload file

──────────────────────────────────────────
ANALYSIS
──────────────────────────────────────────
POST   /analysis/:requirementId    Trigger AI analysis
GET    /analysis/:requirementId    Get latest analysis
GET    /analysis/:requirementId/history  Analysis history
GET    /analysis/:analysisId/status Job status (polling)

──────────────────────────────────────────
ARTIFACTS
──────────────────────────────────────────
GET    /artifacts/:analysisId            Get all artifacts
GET    /artifacts/:analysisId/:type      Get artifact by type
PUT    /artifacts/:artifactId            Edit artifact content
GET    /artifacts/:analysisId/export/pdf  Export PDF
GET    /artifacts/:analysisId/export/md   Export Markdown
GET    /artifacts/:analysisId/export/json Export JSON

──────────────────────────────────────────
NOTIFICATIONS
──────────────────────────────────────────
GET    /notifications              Get user notifications
PUT    /notifications/:id/read     Mark as read
PUT    /notifications/read-all     Mark all as read

──────────────────────────────────────────
ADMIN
──────────────────────────────────────────
GET    /admin/users                List all users
PUT    /admin/users/:id/role       Update user role
DELETE /admin/users/:id            Deactivate user
GET    /admin/audit-logs           View audit logs
```

### 7.2 Standard API Response Envelope

```
Success Response:
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

Error Response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": [ ... ]   // field-level validation errors
  }
}
```

---

## 8. Sequence Diagrams

### 8.1 Create & Analyze Requirement (Full Flow)

```mermaid
sequenceDiagram
    actor BA as Business Analyst
    participant FE as React Frontend
    participant API as Express API
    participant REQ_SVC as RequirementService
    participant ANA_SVC as AnalysisService
    participant DB as PostgreSQL
    participant QUEUE as Bull Queue (Redis)
    participant WORKER as Analysis Worker
    participant AI as AI Provider

    BA->>FE: Fill requirement form & submit
    FE->>API: POST /api/v1/projects/:id/requirements
    API->>REQ_SVC: createRequirement(dto)
    REQ_SVC->>DB: INSERT INTO requirements
    DB-->>REQ_SVC: requirement record
    REQ_SVC-->>API: RequirementDTO
    API-->>FE: 201 { data: requirement }
    FE->>FE: Show requirement detail page

    BA->>FE: Click "Analyze with AI"
    FE->>API: POST /api/v1/analysis/:requirementId
    API->>ANA_SVC: triggerAnalysis(requirementId, userId)
    ANA_SVC->>DB: INSERT INTO analyses (status: 'queued')
    ANA_SVC->>QUEUE: enqueue({ analysisId, requirementId })
    ANA_SVC-->>API: { analysisId, status: 'queued' }
    API-->>FE: 202 { data: { analysisId, status: 'queued' } }
    FE->>FE: Show "Analysis in progress" state
    FE->>API: Poll GET /api/v1/analysis/:reqId/status

    WORKER->>QUEUE: Dequeue job
    WORKER->>DB: SELECT requirement WHERE id = $1
    DB-->>WORKER: requirement.body
    WORKER->>WORKER: PromptBuilder.build(requirement)
    WORKER->>AI: POST /v1/chat/completions (structured prompt)
    AI-->>WORKER: Structured JSON response
    WORKER->>WORKER: Parse + validate response schema
    WORKER->>DB: UPDATE analyses SET status = 'completed'
    WORKER->>DB: INSERT INTO artifacts (8 artifact types)
    WORKER->>DB: UPDATE requirements SET status = 'analyzed'
    WORKER->>DB: INSERT INTO notifications

    API-->>FE: GET status → { status: 'completed', analysisId }
    FE->>API: GET /api/v1/analysis/:requirementId
    API->>DB: SELECT analyses + artifacts JOIN
    DB-->>API: Full analysis with artifacts
    API-->>FE: 200 { data: analysis + artifacts }
    FE->>FE: Render AnalysisResultPage with all tabs
```

---

### 8.2 Export Artifacts as PDF

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as Backend API
    participant ART_SVC as ArtifactService
    participant DB as PostgreSQL
    participant PDF as PDF Generator

    User->>FE: Click "Export PDF"
    FE->>API: GET /api/v1/artifacts/:analysisId/export/pdf
    API->>ART_SVC: exportPDF(analysisId)
    ART_SVC->>DB: SELECT all artifacts WHERE analysis_id = $1
    DB-->>ART_SVC: All artifact records
    ART_SVC->>PDF: renderTemplate(artifacts)
    PDF-->>ART_SVC: PDF Buffer
    ART_SVC-->>API: PDF Buffer + metadata
    API-->>FE: 200 Content-Type: application/pdf (stream)
    FE->>FE: Trigger browser file download
```

---

### 8.3 User Registration

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as Backend
    participant SVC as AuthService
    participant DB as PostgreSQL
    participant EMAIL as Email Service

    User->>FE: Submit registration form
    FE->>FE: Client-side validation (Zod)
    FE->>API: POST /api/v1/auth/register
    API->>API: Validate request body (Zod schema)
    API->>SVC: register(dto)
    SVC->>DB: SELECT user WHERE email = $1
    alt Email already registered
        SVC-->>API: ConflictError
        API-->>FE: 409 { error: "Email already in use" }
    else New email
        SVC->>SVC: bcrypt.hash(password, 12)
        SVC->>DB: INSERT INTO users
        DB-->>SVC: User record
        SVC->>EMAIL: sendWelcomeEmail(user.email)
        SVC-->>API: UserDTO
        API-->>FE: 201 { data: user }
        FE->>FE: Redirect to /login with success toast
    end
```

---

## 9. Deployment Diagram

### 9.1 Docker Compose — Local Development

```mermaid
graph TB
    subgraph Developer["Developer Machine"]
        subgraph Compose["Docker Compose"]
            FE_DEV["frontend container\nVite dev server :5173\nHot Module Replacement"]
            BE_DEV["backend container\nExpress :3000\nts-node-dev watch"]
            PG_DEV[("postgres container\nPostgreSQL 15 :5432")]
            REDIS_DEV[("redis container\nRedis 7 :6379")]
        end
        BROWSER["Browser\nlocalhost:5173"]
    end

    BROWSER --> FE_DEV
    FE_DEV -- "API calls :3000" --> BE_DEV
    BE_DEV --> PG_DEV
    BE_DEV --> REDIS_DEV
```

### 9.2 Production Deployment Architecture

```mermaid
graph TB
    subgraph Internet["Internet / CDN"]
        CDN["CDN\nCloudFront / Cloudflare\nStatic assets · Edge cache"]
        DNS["DNS\nRoute 53 / Cloudflare"]
    end

    subgraph DMZ["DMZ / Ingress Layer"]
        LB["Load Balancer\nALB / NGINX\nTLS Termination"]
    end

    subgraph AppTier["Application Tier — Kubernetes / ECS"]
        subgraph FrontendPod["Frontend Service"]
            FE_1["Frontend Pod 1\nNGINX serving static build"]
            FE_2["Frontend Pod 2"]
        end
        subgraph BackendPod["Backend Service"]
            BE_1["Backend Pod 1\nExpress API"]
            BE_2["Backend Pod 2\nExpress API"]
        end
        subgraph WorkerPod["Worker Service"]
            WK_1["Analysis Worker 1\nBull worker process"]
            WK_2["Analysis Worker 2"]
        end
    end

    subgraph DataTier["Data Tier — Managed Services"]
        PG_PRIMARY[("PostgreSQL Primary\nRDS / Cloud SQL")]
        PG_REPLICA[("PostgreSQL Read Replica")]
        REDIS_CLUSTER[("Redis Cluster\nElastiCache\nSessions · Cache · Queue")]
        S3_STORE["Object Storage\nS3 / GCS\nUploaded documents"]
    end

    subgraph ExternalAPIs["External Services"]
        AI_API["AI Provider API\nOpenAI / Azure / Watsonx"]
        EMAIL_SVC["Email Service\nSES / SendGrid"]
        SECRETS["Secrets Manager\nAWS Secrets / Vault"]
    end

    subgraph Observability["Observability"]
        LOGS["Log Aggregation\nCloudWatch / ELK Stack"]
        METRICS["Metrics\nPrometheus + Grafana"]
        TRACES["Tracing\nDatadog / Jaeger"]
    end

    DNS --> CDN
    CDN --> LB
    LB --> FE_1
    LB --> FE_2
    FE_1 -- "API requests" --> LB
    LB --> BE_1
    LB --> BE_2
    BE_1 --> PG_PRIMARY
    BE_2 --> PG_REPLICA
    BE_1 --> REDIS_CLUSTER
    BE_2 --> REDIS_CLUSTER
    WK_1 --> REDIS_CLUSTER
    WK_2 --> REDIS_CLUSTER
    WK_1 --> PG_PRIMARY
    WK_2 --> PG_PRIMARY
    WK_1 --> AI_API
    WK_2 --> AI_API
    BE_1 --> S3_STORE
    BE_1 --> EMAIL_SVC
    BE_1 --> SECRETS
    BE_1 --> LOGS
    BE_2 --> LOGS
    WK_1 --> LOGS

    style AppTier fill:#e8f4fd,stroke:#3b82d4
    style DataTier fill:#fef9c3,stroke:#ca8a04
    style ExternalAPIs fill:#fdf4ff,stroke:#7c5cd8
    style Observability fill:#f0fdf4,stroke:#16a34a
```

---

## 10. Technology Selection

### 10.1 Frontend Stack

| Technology | Version | Justification |
|---|---|---|
| **React** | 19 | Industry-standard; concurrent rendering, Server Components ready |
| **TypeScript** | 5.x | Type safety, enterprise-grade maintainability |
| **Vite** | 5.x | Blazing fast dev server; ESM-native bundling |
| **Material UI (MUI)** | 6.x | Enterprise design system; accessibility built-in; theme system |
| **Redux Toolkit** | 2.x | Predictable state; DevTools; minimal boilerplate vs vanilla Redux |
| **React Router** | 6.x | Nested routing; data router; route-level code splitting |
| **Axios** | 1.x | Interceptor support; request/response transformation; cancellation |
| **React Hook Form** | 7.x | Performant forms; Zod resolver integration |
| **Zod** | 3.x | Schema validation; shared with backend |
| **date-fns** | 3.x | Lightweight date utilities |

### 10.2 Backend Stack

| Technology | Version | Justification |
|---|---|---|
| **Node.js** | 20 LTS | Event-loop model suits I/O-bound AI API calls; large ecosystem |
| **Express** | 4.x | Minimal, flexible; well-understood in enterprise teams |
| **TypeScript** | 5.x | Type safety across the full stack |
| **pg (node-postgres)** | 8.x | Native PostgreSQL driver; fine-grained SQL control; pooling |
| **Bull** | 4.x | Redis-backed job queue; retries, backoff, concurrency control |
| **bcrypt** | 5.x | Industry-standard password hashing |
| **jsonwebtoken** | 9.x | JWT sign/verify; asymmetric key support |
| **Zod** | 3.x | Request validation; shared schemas with frontend |
| **Winston** | 3.x | Structured JSON logging; multiple transports |
| **express-rate-limit** | 7.x | DDoS and abuse protection |

### 10.3 Database & Caching

| Technology | Version | Justification |
|---|---|---|
| **PostgreSQL** | 15 | ACID compliance; JSONB for artifact content; full-text search |
| **Redis** | 7 | Job queue (Bull), refresh token store, rate limit counters, cache |

### 10.4 AI Integration Strategy

```mermaid
graph TD
    SVC["AnalysisService"] --> FACTORY["AIProviderFactory\nReads AI_PROVIDER env var"]
    FACTORY --> OPENAI["OpenAIAdapter\ngpt-4o"]
    FACTORY --> AZURE["AzureOpenAIAdapter\nAzure-hosted GPT-4o"]
    FACTORY --> ANTHROPIC["AnthropicAdapter\nClaude 3.5 Sonnet"]
    FACTORY --> WATSONX["WatsonxAdapter\nIBM Watsonx.ai"]

    OPENAI & AZURE & ANTHROPIC & WATSONX --> INTERFACE["IAIProvider interface\nanalyze(prompt): Promise<AnalysisResult>"]

    style FACTORY fill:#fef9c3,stroke:#ca8a04
    style INTERFACE fill:#f0fdf4,stroke:#16a34a
```

**AI Provider Interface Contract:**
```typescript
interface IAIProvider {
  analyze(prompt: string, options: AIAnalysisOptions): Promise<AIAnalysisResult>;
  getModelInfo(): AIModelInfo;
}
```

### 10.5 Security Architecture

```mermaid
graph LR
    subgraph Perimeter["Perimeter Security"]
        TLS["TLS 1.2+ Termination"]
        RATE["Rate Limiting\n100 req/min per IP"]
        CORS["CORS Policy\nWhitelist origins"]
    end

    subgraph AppSecurity["Application Security"]
        JWT["JWT Authentication\nHS256 / RS256\n15min expiry"]
        RBAC["RBAC Authorization\nRole-based endpoint guards"]
        VALID["Input Validation\nZod schemas — all inputs"]
        SANITIZE["Input Sanitization\nStrip XSS before AI calls"]
        AUDIT["Audit Logging\nAll mutations logged"]
    end

    subgraph DataSecurity["Data Security"]
        BCRYPT["Password Hashing\nbcrypt rounds=12"]
        SECRETS["Secrets Manager\nNo env vars in code"]
        BACKUP["DB Backups\nDaily automated"]
    end

    Perimeter --> AppSecurity --> DataSecurity
```

### 10.6 Observability Stack

| Concern | Tool | Detail |
|---------|------|--------|
| **Structured Logging** | Winston | JSON format; levels: error, warn, info, debug; request IDs |
| **Error Tracking** | Sentry | Real-time error capture; stack traces; release tracking |
| **Metrics** | Prometheus + Grafana | API latency, queue depth, analysis success rate |
| **Distributed Tracing** | OpenTelemetry | Trace request → service → DB → AI provider |
| **Health Checks** | `/api/health` endpoint | DB ping, Redis ping, version info |

### 10.7 Development Toolchain

| Tool | Purpose |
|------|---------|
| **ESLint** | Code quality — custom enterprise ruleset |
| **Prettier** | Code formatting — enforced in CI |
| **Husky + lint-staged** | Pre-commit hooks — lint + format on staged files |
| **Vitest** | Frontend unit testing |
| **Jest** | Backend unit + integration testing |
| **Docker + Docker Compose** | Local development environment |
| **GitHub Actions** | CI/CD pipeline — lint → test → build → deploy |

---

## Appendix A: Architecture Decision Records (ADRs)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | PostgreSQL JSONB for artifact content | Flexible schema for 8+ artifact types; queryable; ACID guarantees |
| ADR-002 | Bull + Redis for async AI jobs | AI calls are slow; async processing prevents API timeouts |
| ADR-003 | JWT access token in memory, refresh in httpOnly cookie | Prevents XSS theft of access tokens; CSRF mitigated via SameSite |
| ADR-004 | AI provider as Strategy pattern | Swap providers without changing application code; testable |
| ADR-005 | Monorepo with shared types package | Single source of truth for DTOs; prevents frontend/backend drift |
| ADR-006 | Clean Architecture layers | Testable domain logic; infrastructure swappable; framework-independent core |
| ADR-007 | Express over NestJS | Simpler mental model; less magic; easier to onboard enterprise teams |
| ADR-008 | Raw SQL (pg) over ORM | Full control over queries; no N+1 surprises; migrations as plain SQL |

---

*Document End — ReqAI HLD v1.0.0*
