# Release Notes — InterruptIQ v1.0.0 (General Availability)

We are proud to announce the stable v1.0.0 release of InterruptIQ, the cognitive context intelligence gateway.

---

## 🌟 New Features
1. **Context Tracker:** Real-time state signal management for mobile and system activity indicators.
2. **Decision Engine:** Fully custom pipeline rules classifying delivery actions dynamically.
3. **Episodic Memory Retrieval:** Vector embeddings indexing (BGE-small) with local shingle hashes fallback and hybrid relevance sorting.
4. **LLM Critic Engine:** Automated review agent checking decisions and issuing rule recommendations.
5. **Interactive Dashboard:** Complete developer simulation dashboard with tabular analytics.

---

## 🛠️ Tech Stack & Key Dependencies
* **Core Runtime:** Node.js v20.x, TypeScript v5.3.
* **APIs & Web:** Fastify v4.26, React v19.0, Vite v8.0.
* **Database & ORM:** PostgreSQL v15, Prisma v4.16.
* **Local Embeddings:** ONNX Runtime Web v1.14, Transformers.js v2.14.

---

## ⚠️ Known Limitations
* Hybrid semantic queries require database indexes to be pre-synchronized via db push migrations before running queries.
* Critic provider defaults to `Mock` unless `OPENAI_API_KEY` environment variables are supplied.

---

## 🔮 Future Improvements
* Adding native Slack and Email messaging API ingestion connectors.
* Native on-device telemetry gathering daemons for iOS and Android environments.
