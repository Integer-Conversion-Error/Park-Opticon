package notifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExpoClientRejectsUnsupportedToken(t *testing.T) {
	client := NewExpoClient("")
	if err := client.Send(context.Background(), "not-an-expo-token", "Title", "Body", nil); err == nil {
		t.Fatal("expected unsupported token to be rejected")
	}
}

func TestExpoClientBatchesMessagesAndPreservesProviderResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", request.Method)
		}
		var payload []expoMessage
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(payload) != 2 || payload[0].To != "ExpoPushToken[first]" || payload[1].To != "ExpoPushToken[second]" {
			t.Fatalf("unexpected payload: %#v", payload)
		}
		_ = json.NewEncoder(writer).Encode(map[string]any{
			"data": []map[string]any{
				{"status": "ok", "id": "ticket-one"},
				{"status": "error", "details": map[string]any{"error": "DeviceNotRegistered"}},
			},
		})
	}))
	defer server.Close()

	client := NewExpoClient("")
	client.endpoint = server.URL
	results, err := client.SendBatch(context.Background(), []Message{
		{Token: "ExpoPushToken[first]", Title: "One", Body: "First"},
		{Token: "ExpoPushToken[second]", Title: "Two", Body: "Second"},
	})
	if err != nil {
		t.Fatalf("SendBatch returned request error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].Err != nil || results[0].TicketID != "ticket-one" {
		t.Fatalf("unexpected successful result: %#v", results[0])
	}
	if results[1].Err == nil || !results[1].Permanent {
		t.Fatalf("expected permanent provider rejection, got %#v", results[1])
	}
}
