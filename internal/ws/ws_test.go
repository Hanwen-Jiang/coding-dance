package ws

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebSocketRoundTripLargeAndSmall(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := Upgrade(w, r)
		if err != nil {
			return
		}
		defer c.Close()
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				return
			}
			if err := c.WriteText(msg); err != nil {
				return
			}
		}
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	cli, err := Dial(context.Background(), wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer cli.Close()

	for _, payload := range [][]byte{
		[]byte(`{"seq":1,"type":"request","command":"initialize"}`),
		bytes.Repeat([]byte("A"), 1024),
		bytes.Repeat([]byte("B"), 70000),
	} {
		if err := cli.WriteText(payload); err != nil {
			t.Fatalf("write failed: %v", err)
		}
		_, got, err := cli.ReadMessage()
		if err != nil {
			t.Fatalf("read failed: %v", err)
		}
		if !bytes.Equal(got, payload) {
			t.Fatalf("echo mismatch: len %d vs %d", len(got), len(payload))
		}
	}
}
