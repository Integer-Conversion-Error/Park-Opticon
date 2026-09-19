package mfa

import (
	"testing"
	"time"
)

func TestTOTPCodeRoundTrip(t *testing.T) {
	secret := "JBSWY3DPEHPK3PXP"
	now := time.Unix(1700000000, 0).UTC()
	code, err := Code(secret, now)
	if err != nil {
		t.Fatalf("generate code: %v", err)
	}
	if !VerifyCode(secret, code, now) {
		t.Fatal("generated code was not accepted")
	}
	if VerifyCode(secret, "000000", now) {
		t.Fatal("invalid code was accepted")
	}
}

func TestEncryptedSecretRoundTrip(t *testing.T) {
	encrypted, err := EncryptSecret("JBSWY3DPEHPK3PXP", "test-key")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	decrypted, err := DecryptSecret(encrypted, "test-key")
	if err != nil || decrypted != "JBSWY3DPEHPK3PXP" {
		t.Fatalf("decrypt mismatch: %q %v", decrypted, err)
	}
}
