#!/bin/bash

# Start the event-driven alert and expiry worker locally.
set -e

export PATH=$PATH:/usr/local/go/bin
cd "$(dirname "$0")"

go run cmd/worker/main.go
