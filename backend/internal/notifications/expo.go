package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// Message is an individual push payload. Delivery workers submit messages in
// provider-sized batches while preserving one result per device.
type Message struct {
	Token string
	Title string
	Body  string
	Data  map[string]string
}

// SendResult describes Expo's acceptance result for one Message. Accepted
// means Expo accepted the request; it is not a claim that the OS displayed it.
type SendResult struct {
	TicketID  string
	Err       error
	Permanent bool
}

type ExpoClient struct {
	accessToken string
	client      *http.Client
	endpoint    string
}

type expoMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Sound string            `json:"sound"`
	Data  map[string]string `json:"data,omitempty"`
}

type expoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

func NewExpoClient(accessToken string) *ExpoClient {
	return &ExpoClient{
		accessToken: strings.TrimSpace(accessToken),
		client:      &http.Client{Timeout: 10 * time.Second},
		endpoint:    expoPushURL,
	}
}

func (c *ExpoClient) Send(ctx context.Context, token, title, body string, data map[string]string) error {
	results, err := c.SendBatch(ctx, []Message{{
		Token: token,
		Title: title,
		Body:  body,
		Data:  data,
	}})
	if err != nil {
		return err
	}
	if len(results) != 1 {
		return fmt.Errorf("push provider returned an unexpected result count")
	}
	return results[0].Err
}

// SendBatch submits up to 100 Expo push payloads in one HTTP request. A
// request-level error applies to the whole batch; per-message rejections are
// returned in their corresponding SendResult so callers can retry only the
// transient failures.
func (c *ExpoClient) SendBatch(ctx context.Context, messages []Message) ([]SendResult, error) {
	if len(messages) == 0 {
		return []SendResult{}, nil
	}
	if len(messages) > 100 {
		return nil, fmt.Errorf("Expo push batches cannot exceed 100 messages")
	}

	results := make([]SendResult, len(messages))
	payloadMessages := make([]expoMessage, 0, len(messages))
	payloadIndexes := make([]int, 0, len(messages))
	for index, message := range messages {
		token := strings.TrimSpace(message.Token)
		if token == "" {
			results[index] = SendResult{Err: fmt.Errorf("push token is empty"), Permanent: true}
			continue
		}
		if !strings.HasPrefix(token, "ExponentPushToken[") && !strings.HasPrefix(token, "ExpoPushToken[") {
			results[index] = SendResult{Err: fmt.Errorf("unsupported Expo push token format"), Permanent: true}
			continue
		}
		payloadMessages = append(payloadMessages, expoMessage{
			To: token, Title: message.Title, Body: message.Body, Sound: "default", Data: message.Data,
		})
		payloadIndexes = append(payloadIndexes, index)
	}
	if len(payloadMessages) == 0 {
		return results, nil
	}

	payload, err := json.Marshal(payloadMessages)
	if err != nil {
		return nil, fmt.Errorf("encode push batch: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create push request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if c.accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+c.accessToken)
	}

	response, err := c.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("send push batch: %w", err)
	}
	defer response.Body.Close()

	var providerResponse struct {
		Data []expoTicket `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&providerResponse); err != nil {
		return nil, fmt.Errorf("decode push response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("push provider returned %s", response.Status)
	}
	if len(providerResponse.Data) != len(payloadMessages) {
		return nil, fmt.Errorf("push provider returned %d results for %d messages", len(providerResponse.Data), len(payloadMessages))
	}

	for resultIndex, ticket := range providerResponse.Data {
		index := payloadIndexes[resultIndex]
		if ticket.Status == "ok" {
			results[index] = SendResult{TicketID: ticket.ID}
			continue
		}
		message := ticket.Details.Error
		if message == "" {
			message = ticket.Message
		}
		if message == "" {
			message = "push provider rejected the notification"
		}
		results[index] = SendResult{
			Err:       fmt.Errorf("push provider rejected notification: %s", message),
			Permanent: permanentExpoError(message),
		}
	}
	return results, nil
}

func permanentExpoError(message string) bool {
	normalized := strings.ToLower(message)
	return strings.Contains(normalized, "devicenotregistered") ||
		strings.Contains(normalized, "invalidcredentials") ||
		strings.Contains(normalized, "invalid expo push token")
}
