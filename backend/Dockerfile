# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the HTTP API and the independent alert worker.
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server cmd/server/main.go \
    && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o worker cmd/worker/main.go

# Final stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata

RUN addgroup -S parkopticon && adduser -S -G parkopticon -u 10001 parkopticon

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/server /app/server
COPY --from=builder /app/worker /app/worker

USER parkopticon

EXPOSE 8080

CMD ["/app/server"]
