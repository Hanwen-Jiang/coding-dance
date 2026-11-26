package ws

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

const (
	OpContinuation = 0x0
	OpText         = 0x1
	OpBinary       = 0x2
	OpClose        = 0x8
	OpPing         = 0x9
	OpPong         = 0xA
)

var (
	ErrClosed       = errors.New("websocket closed")
	ErrFrameTooBig  = errors.New("websocket frame exceeds max payload limit")
	ErrBadHandshake = errors.New("websocket handshake failed")
)

// Conn is a minimal, RFC 6455 compliant WebSocket connection supporting both server and client roles.
type Conn struct {
	netConn   net.Conn
	br        *bufio.Reader
	bw        *bufio.Writer
	isClient  bool
	maxRead   int64
	writeMu   sync.Mutex
	closeOnce sync.Once
}

func computeAcceptKey(key string) string {
	h := sha1.New()
	h.Write([]byte(key))
	h.Write([]byte(wsGUID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// Upgrade upgrades an HTTP server request to a WebSocket connection.
func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if !headerContainsToken(r.Header, "Connection", "upgrade") || !headerContainsToken(r.Header, "Upgrade", "websocket") {
		http.Error(w, "websocket upgrade required", http.StatusUpgradeRequired)
		return nil, ErrBadHandshake
	}
	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	if key == "" {
		http.Error(w, "missing Sec-WebSocket-Key", http.StatusBadRequest)
		return nil, ErrBadHandshake
	}
	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijacking not supported", http.StatusInternalServerError)
		return nil, errors.New("http.ResponseWriter does not support Hijacker")
	}
	nc, brw, err := hj.Hijack()
	if err != nil {
		return nil, err
	}
	accept := computeAcceptKey(key)
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	if _, err := brw.WriteString(resp); err != nil {
		_ = nc.Close()
		return nil, err
	}
	if err := brw.Flush(); err != nil {
		_ = nc.Close()
		return nil, err
	}
	return &Conn{
		netConn:  nc,
		br:       brw.Reader,
		bw:       brw.Writer,
		isClient: false,
		maxRead:  4 << 20, // 4 MiB default max message
	}, nil
}

// Dial connects to a ws:// WebSocket endpoint (used for testing and BFF upstream proxying).
func Dial(ctx context.Context, rawURL string, headers http.Header) (*Conn, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		if u.Scheme == "wss" || u.Scheme == "https" {
			host += ":443"
		} else {
			host += ":80"
		}
	}
	var d net.Dialer
	nc, err := d.DialContext(ctx, "tcp", host)
	if err != nil {
		return nil, err
	}
	var keyBytes [16]byte
	_, _ = rand.Read(keyBytes[:])
	wsKey := base64.StdEncoding.EncodeToString(keyBytes[:])

	path := u.RequestURI()
	if path == "" {
		path = "/"
	}
	var req strings.Builder
	fmt.Fprintf(&req, "GET %s HTTP/1.1\r\n", path)
	fmt.Fprintf(&req, "Host: %s\r\n", u.Host)
	req.WriteString("Upgrade: websocket\r\n")
	req.WriteString("Connection: Upgrade\r\n")
	fmt.Fprintf(&req, "Sec-WebSocket-Key: %s\r\n", wsKey)
	req.WriteString("Sec-WebSocket-Version: 13\r\n")
	for k, vals := range headers {
		for _, v := range vals {
			fmt.Fprintf(&req, "%s: %s\r\n", k, v)
		}
	}
	req.WriteString("\r\n")

	if _, err := nc.Write([]byte(req.String())); err != nil {
		_ = nc.Close()
		return nil, err
	}
	br := bufio.NewReader(nc)
	httpResp, err := http.ReadResponse(br, &http.Request{Method: http.MethodGet})
	if err != nil {
		_ = nc.Close()
		return nil, err
	}
	if httpResp.StatusCode != http.StatusSwitchingProtocols || httpResp.Header.Get("Sec-WebSocket-Accept") != computeAcceptKey(wsKey) {
		_ = nc.Close()
		return nil, fmt.Errorf("%w: status %d", ErrBadHandshake, httpResp.StatusCode)
	}
	return &Conn{
		netConn:  nc,
		br:       br,
		bw:       bufio.NewWriter(nc),
		isClient: true,
		maxRead:  4 << 20,
	}, nil
}

func headerContainsToken(h http.Header, key, token string) bool {
	for _, v := range h.Values(key) {
		for _, part := range strings.Split(v, ",") {
			if strings.EqualFold(strings.TrimSpace(part), token) {
				return true
			}
		}
	}
	return false
}

func (c *Conn) SetReadDeadline(t time.Time) error {
	return c.netConn.SetReadDeadline(t)
}

func (c *Conn) SetMaxReadBytes(n int64) {
	c.maxRead = n
}

// ReadMessage reads the next complete Text or Binary message, automatically responding to Ping frames.
func (c *Conn) ReadMessage() (opcode byte, payload []byte, err error) {
	var msgBuf []byte
	var msgOp byte
	for {
		fin, op, frameData, err := c.readFrame()
		if err != nil {
			return 0, nil, err
		}
		switch op {
		case OpPing:
			_ = c.writeFrame(OpPong, frameData)
			continue
		case OpPong:
			continue
		case OpClose:
			_ = c.writeFrame(OpClose, nil)
			_ = c.Close()
			return OpClose, nil, ErrClosed
		case OpText, OpBinary:
			msgOp = op
			msgBuf = append(msgBuf[:0], frameData...)
			if fin {
				return msgOp, msgBuf, nil
			}
		case OpContinuation:
			msgBuf = append(msgBuf, frameData...)
			if int64(len(msgBuf)) > c.maxRead {
				return 0, nil, ErrFrameTooBig
			}
			if fin {
				return msgOp, msgBuf, nil
			}
		}
	}
}

func (c *Conn) readFrame() (fin bool, opcode byte, payload []byte, err error) {
	var hdr [2]byte
	if _, err := io.ReadFull(c.br, hdr[:]); err != nil {
		if errors.Is(err, io.EOF) {
			return false, 0, nil, ErrClosed
		}
		return false, 0, nil, err
	}
	fin = hdr[0]&0x80 != 0
	opcode = hdr[0] & 0x0F
	masked := hdr[1]&0x80 != 0
	length := int64(hdr[1] & 0x7F)

	switch length {
	case 126:
		var ext [2]byte
		if _, err := io.ReadFull(c.br, ext[:]); err != nil {
			return false, 0, nil, err
		}
		length = int64(binary.BigEndian.Uint16(ext[:]))
	case 127:
		var ext [8]byte
		if _, err := io.ReadFull(c.br, ext[:]); err != nil {
			return false, 0, nil, err
		}
		length = int64(binary.BigEndian.Uint64(ext[:]))
	}
	if length < 0 || length > c.maxRead {
		return false, 0, nil, ErrFrameTooBig
	}
	var maskKey [4]byte
	if masked {
		if _, err := io.ReadFull(c.br, maskKey[:]); err != nil {
			return false, 0, nil, err
		}
	}
	payload = make([]byte, length)
	if _, err := io.ReadFull(c.br, payload); err != nil {
		return false, 0, nil, err
	}
	if masked {
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}
	return fin, opcode, payload, nil
}

func (c *Conn) WriteText(msg []byte) error {
	return c.writeFrame(OpText, msg)
}

func (c *Conn) WriteJSON(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.writeFrame(OpText, b)
}

func (c *Conn) writeFrame(opcode byte, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	var hdr [14]byte
	hdr[0] = 0x80 | (opcode & 0x0F)
	n := len(payload)
	offset := 2
	maskBit := byte(0)
	if c.isClient {
		maskBit = 0x80
	}
	switch {
	case n <= 125:
		hdr[1] = maskBit | byte(n)
	case n <= 65535:
		hdr[1] = maskBit | 126
		binary.BigEndian.PutUint16(hdr[2:4], uint16(n))
		offset = 4
	default:
		hdr[1] = maskBit | 127
		binary.BigEndian.PutUint64(hdr[2:10], uint64(n))
		offset = 10
	}

	var maskKey [4]byte
	if c.isClient {
		_, _ = rand.Read(maskKey[:])
		copy(hdr[offset:offset+4], maskKey[:])
		offset += 4
	}
	if _, err := c.bw.Write(hdr[:offset]); err != nil {
		return err
	}
	if c.isClient && n > 0 {
		masked := make([]byte, n)
		for i := range payload {
			masked[i] = payload[i] ^ maskKey[i%4]
		}
		if _, err := c.bw.Write(masked); err != nil {
			return err
		}
	} else if n > 0 {
		if _, err := c.bw.Write(payload); err != nil {
			return err
		}
	}
	return c.bw.Flush()
}

func (c *Conn) Close() error {
	var err error
	c.closeOnce.Do(func() {
		_ = c.writeFrame(OpClose, nil)
		err = c.netConn.Close()
	})
	return err
}
