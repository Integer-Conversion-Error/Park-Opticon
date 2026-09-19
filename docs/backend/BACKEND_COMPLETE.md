# Historical backend milestone

> **Historical reference — not current operating guidance.** This file used to
> describe an earlier backend milestone, including a periodic alert checker,
> Firebase plans, and production-readiness claims that no longer match the
> repository.

The maintained backend references are [the runtime README](../../backend/README.md),
[architecture](ARCHITECTURE.md), and [API testing](API_TESTING.md).

Current alert delivery is a durable PostgreSQL outbox plus a separate Expo
worker process; it does not scan all active sessions every 30 seconds.
