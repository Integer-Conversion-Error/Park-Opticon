#!/usr/bin/env python3
"""Enforce statement coverage for the driver API and alert delivery boundary."""

from collections import defaultdict
from pathlib import Path
import sys

TARGETS = (
    "internal/auth/jwt.go",
    "internal/auth/oidc.go",
    "internal/handlers/auth.go",
    "internal/handlers/oauth.go",
    "internal/handlers/parking_sessions.go",
    "internal/handlers/parking.go",
    "internal/handlers/enforcement.go",
    "internal/handlers/verifications.go",
    "internal/handlers/feed.go",
    "internal/handlers/preferences.go",
    "internal/handlers/notifications.go",
    "internal/middleware/auth.go",
    "internal/middleware/security.go",
    "internal/notifications/expo.go",
    "internal/worker/alert_dispatcher.go",
    "internal/worker/expiry_checker.go",
)
MINIMUM_PERCENT = 70.0


def main(profile: Path) -> int:
    blocks = {}
    for line in profile.read_text().splitlines()[1:]:
        location, statements, count = line.split()
        path = location.split(":", 1)[0]
        target = next((name for name in TARGETS if path.endswith(name)), None)
        if target is None:
            continue
        key = (target, location)
        old_count = blocks.get(key, (0, 0))[1]
        blocks[key] = (int(statements), max(int(count), old_count))

    totals = defaultdict(lambda: [0, 0])
    for (target, _), (statements, count) in blocks.items():
        totals[target][0] += statements
        totals[target][1] += statements if count else 0

    missing = set(TARGETS) - set(totals)
    if missing:
        print("Missing coverage instrumentation:", ", ".join(sorted(missing)), file=sys.stderr)
        return 1

    for target in TARGETS:
        total, covered = totals[target]
        print(f"{target} — {covered}/{total} statements ({covered / total:.1%})")
    total = sum(value[0] for value in totals.values())
    covered = sum(value[1] for value in totals.values())
    percent = 100 * covered / total
    print(f"Driver API and worker: {covered}/{total} statements ({percent:.1f}%)")
    if percent < MINIMUM_PERCENT:
        print(f"Coverage is below {MINIMUM_PERCENT:.0f}%", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: check-driver-coverage.py COVERPROFILE")
    raise SystemExit(main(Path(sys.argv[1])))
