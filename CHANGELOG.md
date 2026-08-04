# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-08-03
### Added
- **Event Ingestion Engine:** Complete events module storing sender, message payload, custom metadata with Swagger specs.
- **Decision Pipeline v1:** Rules engine calculating priorities and delivery verdicts (IMMEDIATE, BATCH, IGNORE).
- **Feedback Engine:** Captured user feedback statuses (ACCEPTED, OVERRIDDEN, DISMISSED, RESTORED).
- **Episodic Memory & Embedding Engine:** Integrated MiniLM / BGE local embeddings generator on top of ONNX runtime with cached retrieval and hybrid relevance scoring.
- **LLM Critic review**: Built headless Critic provider wrapper (Mock, OpenAI, Ollama) generating recommendations and rule adjustments.
- **AI Simulator Dashboard**: React developer control panel.
- **Dockerization:** Added service Dockerfiles and Docker Compose profiles.
- **CI/CD Actions:** Setup typechecking, lint checks, and testing pipelines.

## [1.0.0-alpha.0] - 2026-08-01
### Added
- Monorepo layout using `pnpm-workspace`.
- Scaffolding for `apps/web` and `apps/api`.
- Initial package designs for `packages/ai-core`, `packages/shared`, and `packages/ui`.
