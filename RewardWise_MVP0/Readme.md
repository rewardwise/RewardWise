
# RewardWise — Complete System Documentation Structure

> Repository: RewardWise
> Architecture: Next.js + FastAPI + Supabase
> Purpose: AI-powered travel rewards optimization engine

---

# 1. System Architecture Overview

## 1.1 Product Overview

RewardWise is an AI-powered travel decision engine that determines:

> Should the user pay cash or use points — and which program gives the best value?

Core capabilities:

* Multi-program portfolio modeling
* Transfer partner evaluation
* Seat availability lookup
* Real-time cash price comparison
* Single-verdict recommendation
* Valuation + optimization engine

---

## 1.2 High-Level Architecture

```mermaid
graph TB
    subgraph Client Layer
        WEB[Next.js Frontend]
    end
    
    subgraph Backend Layer
        API[FastAPI Backend]
        RE[Recommendation Engine]
        VAL[Valuation Engine]
    end
    
    subgraph Data Layer
        DB[(Supabase PostgreSQL)]
        CACHE[(Redis)]
    end
    
    subgraph External APIs
        SEATS[seats.aero API]
        FLIGHTS[Google Flights / Cash API]
        PLAID[Plaid (optional future)]
    end
    
    WEB --> API
    API --> RE
    RE --> VAL
    RE --> DB
    RE --> CACHE
    RE --> SEATS
    RE --> FLIGHTS
    API --> DB
```

---

## 1.3 Core Architectural Principles

RewardWise is built around:

1. **Deterministic Verdict System**

   * One clear output
   * No ambiguity
   * Explainable logic

2. **Program-Normalized Data Model**

   * Unified schema for all loyalty programs
   * Transferable vs airline vs hotel programs separated

3. **Multi-layer Decision Engine**

   * Availability
   * Cash comparison
   * Transfer path cost
   * Point valuation
   * Optimization heuristics

4. **Future ML-ready Architecture**

   * Availability prediction
   * Dynamic valuation models
   * Transfer success probability

---

# 2. Backend — FastAPI Application

## 2.1 Entry Point

`main.py` initializes:

* Wallet routes
* Search routes
* Recommendation routes
* Admin routes
* Health endpoints

---

## 2.2 Core Modules

| Module           | Responsibility                  |
| ---------------- | ------------------------------- |
| wallet/          | User portfolio management       |
| search/          | Flight search orchestration     |
| recommendation/  | Core decision logic             |
| valuation/       | Point valuation engine          |
| transfer_engine/ | Transfer partner graph modeling |
| availability/    | seats.aero integration          |
| pricing/         | Cash price API integration      |
| cache/           | Redis caching                   |
| models/          | Pydantic schemas                |
| database/        | Supabase ORM layer              |

---

# 3. Recommendation Engine

This is RewardWise’s brain.

## 3.1 Decision Pipeline

```mermaid
flowchart TD
    A[User Search Request]
    B[Fetch Seat Availability]
    C[Fetch Cash Price]
    D[Compute Point Value]
    E[Evaluate Transfer Paths]
    F[Apply Optimization Heuristics]
    G[Generate Single Verdict]
    
    A --> B --> C --> D --> E --> F --> G
```

---

## 3.2 Decision Formula

Core evaluation:

```
Point Value = Cash Price / Points Required
```

Enhanced evaluation:

```
Effective Value = (Cash Price - Taxes) / (Points + Transfer Cost)
```

Optimization rules:

* Reject options below user threshold (e.g., 1.2 cpp)
* Penalize long transfer chains
* Penalize low availability confidence
* Reward direct transfer partners

---

## 3.3 Transfer Graph Modeling

Programs modeled as directed graph:

```
Chase → United
Amex → Air Canada
Capital One → British Airways
```

Graph supports:

* Direct transfer
* Multi-hop transfer
* Transfer bonuses (future)
* Transfer timing constraints

---

# 4. Database Schema

## 4.1 Core Tables

```mermaid
erDiagram
    users ||--o{ user_wallets : owns
    issuers ||--o{ cards : issues
    programs ||--o{ transfer_paths : maps
    
    users {
        uuid id PK
        text email
        timestamptz created_at
    }
    
    issuers {
        uuid id PK
        text name
        text logo_url
    }
    
    programs {
        uuid id PK
        text name
        text type
    }
    
    cards {
        uuid id PK
        uuid issuer_id FK
        text name
        text earning_type
    }
    
    user_wallets {
        uuid id PK
        uuid user_id FK
        uuid program_id FK
        int points_balance
    }
    
    transfer_paths {
        uuid id PK
        uuid from_program FK
        uuid to_program FK
        float transfer_ratio
    }
```

---

# 5. Frontend — Next.js

## 5.1 Route Map

| Route           | Purpose         |
| --------------- | --------------- |
| /               | Landing page    |
| /search         | Flight search   |
| /wallet         | Manage wallet   |
| /recommendation | Verdict display |
| /profile        | Settings        |

---

## 5.2 Core Components

| Component         | Purpose                       |
| ----------------- | ----------------------------- |
| SearchWizard      | Multi-step flight search      |
| WalletManager     | Program + balance selection   |
| VerdictCard       | Single recommendation display |
| TransferBreakdown | Transfer explanation          |
| ValueMeter        | CPP visualization             |

---

# 6. EPIC Breakdown

## EPIC-0: DB & Canonical Dataset

* issuers
* programs
* transfer_paths
* cards

## EPIC-1: UI ↔ Backend Integration

* Wallet API
* Search API
* Basic verdict

## EPIC-2: Recommendation Engine

* Full decision pipeline
* Transfer graph
* Value computation

## EPIC-3: ML Layer (Future)

* Seat availability prediction
* Dynamic valuation model
* User preference learning

---

# 7. Deployment

| Layer      | Platform          |
| ---------- | ----------------- |
| Frontend   | Vercel            |
| Backend    | Railway / Render  |
| DB         | Supabase          |
| Cache      | Redis             |
| Domain     | rewardwise.ai     |
| Monitoring | Sentry (optional) |

---

# 8. Environment Variables

Backend:

* SUPABASE_URL
* SUPABASE_SERVICE_ROLE_KEY
* SEATS_AERO_API_KEY
* CASH_PRICE_API_KEY
* REDIS_URL

Frontend:

* NEXT_PUBLIC_API_URL
* NEXT_PUBLIC_SUPABASE_URL
* NEXT_PUBLIC_SUPABASE_ANON_KEY

---
