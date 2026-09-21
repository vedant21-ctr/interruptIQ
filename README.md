# InterruptIQ — Attention Gateway & Focus Intelligence Platform

InterruptIQ is an intelligent attention gateway for engineering teams. Rather than acting as a static notification blocker or LLM summarizer, InterruptIQ operates in a read-only shadow mode (Focus Report v0) to measure interruption overhead, infer focus state boundaries, and evaluate counterfactual notification delivery policies.

---

## 🚀 Key Features

* **Focus Report (Shadow Mode v0):** Read-only evaluation mode analyzing Slack and Google Calendar metadata over a 2-week period without blocking, delaying, or modifying live messages.
* **Pure Shadow Policy Engine:** Deterministic counterfactual policy evaluating whether incoming events should be delivered immediately, delayed to meeting boundaries, or batched.
* **Sampled Review & Label Queue:** Solves ground-truth collection by enabling engineers to review sampled counterfactual delays and provide feedback.
* **Deterministic Rules & Focus Inference:** Infers user focus states (`ooo`, `meeting`, `focus_block`, `quiet_window`, `available`) based on calendar boundaries and activity patterns.
* **LLM Critic Review (Offline):** Asynchronous evaluation of historical decision episodes against user feedback overrides.
* **Interactive Simulator Dashboard:** Developer control panel to simulate context, test event policies, and inspect metric rollups.

---

## 🏛️ Architecture Overview

The system consists of the following packages:
1. **API Backend (`apps/api`):** Fastify TypeScript service hosting context snapshots, event ingestion, decision history, and shadow metrics.
2. **Web Simulator (`apps/web`):** React, Vite, and Tailwind CSS operator dashboard.
3. **Embedding Engine (`packages/embedding-engine`):** Local vector embedding generator (ONNX / Transformer.js fallback).
4. **Shared Domain (`packages/shared`):** Pure TypeScript domain models, Focus Report metrics, and pure shadow policy functions.

---

## 📂 Folder Structure

```
├── apps/
│   ├── api/          # Fastify TypeScript service
│   └── web/          # React simulator application
├── packages/
│   ├── embedding-engine/ # Local vector embedding generator (ONNX)
│   ├── ai-core/      # Heuristic fallback rules
│   ├── shared/       # Domain types, focus state inference, and pure shadow policy
│   └── ui/           # Shared UI stubs
├── docs/             # Technical specifications & Focus Report plans
└── docker-compose.yml
```

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Fastify, TypeScript, Prisma, Vitest.
* **Database:** PostgreSQL, Redis.
* **Frontend:** React, Vite, Tailwind CSS, Framer Motion.
* **Domain Engine:** Pure functional TypeScript policies.

---

## ⚙️ Environment Setup & Installation

Clone the repository and install all workspace dependencies:
```bash
pnpm install
```

Configure environment variables by copying `.env.example` to `.env`:
```bash
cp .env.example .env
```

---

## 💻 Running Locally

### Development Mode
```bash
pnpm run dev
```

### Type Checking
```bash
pnpm exec tsc --noEmit
```

### Running Test Suites
```bash
pnpm run test
```

---

## 🐳 Docker Setup

Build and launch Postgres, Redis, API, and Web client:
```bash
docker-compose up --build
```

---

## 📖 System Documentation

- [Focus Report Spec (v0)](file:///d:/interuptiq/docs/product/focus-report-spec.md)
- [Focus Report Implementation Plan](file:///d:/interuptiq/docs/product/focus-report-implementation-plan.md)
- [Slack Feasibility Analysis](file:///d:/interuptiq/docs/integrations/slack-feasibility.md)
- [Google Calendar Feasibility Analysis](file:///d:/interuptiq/docs/integrations/google-calendar-feasibility.md)
- [Attention Engine Long-Term Spec](file:///d:/interuptiq/docs/architecture/attention-engine.md)

