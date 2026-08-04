# InterruptIQ REST API Interface

All endpoint routes are prefixed with `/api/v1` and require authenticated Bearer tokens.

## Endpoints List

### 1. Authentication
* **`POST /auth/register`:** Create operator user.
* **`POST /auth/login`:** Authenticate user and receive JWT.

### 2. Context Tracker
* **`GET /context/current`:** Get active context variables.
* **`PATCH /context/current`:** Update focus, battery, and working mode.

### 3. Event Ingest
* **`POST /events`:** Ingest notification.
* **`GET /events/:id`:** Fetch ingested notification attributes.

### 4. Decision Pipeline
* **`POST /decision/evaluate`:** Run decision engine on an event.
* **`GET /decision/history`:** Fetch historical decisions.

### 5. Memory Engine
* **`POST /memory`:** Index episode.
* **`POST /memory/retrieve`:** Query similar episodes using hybrid retrieval parameters.
* **`POST /memory/embed`:** Calculate embedding for an episode.
* **`POST /memory/reindex`:** Batch reindex missing embeddings.

### 6. LLM Critic
* **`POST /critic/evaluate`:** Evaluates a memory episode using Critic models.
* **`GET /critic/history`:** Returns paginated critic reports.
* **`GET /critic/:id`:** Returns details of a specific report.
