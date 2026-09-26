package worker

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestRetryPolicyBoundsBackoffAndStoredErrors(t *testing.T) {
	for _, example := range []struct {
		attempt int
		want    time.Duration
	}{
		{0, time.Second}, {1, time.Second}, {2, 2 * time.Second}, {9, 256 * time.Second}, {20, 256 * time.Second},
	} {
		if got := retryDelay(example.attempt); got != example.want {
			t.Errorf("attempt %d: delay %v, want %v", example.attempt, got, example.want)
		}
	}
	if truncateError(nil) != "" {
		t.Fatal("nil error should not be stored")
	}
	if len(truncateError(errors.New(strings.Repeat("x", 3000)))) != 2000 {
		t.Fatal("provider error exceeded storage bound")
	}
	if !isContextError(context.Canceled) || !isContextError(context.DeadlineExceeded) || isContextError(errors.New("different failure")) {
		t.Fatal("context cancellation classification changed")
	}
}
