package database

import (
	"errors"

	"github.com/lib/pq"
)

// IsUniqueViolation reports whether PostgreSQL rejected a write because of a
// unique constraint. Handlers use this to turn race-safe database invariants
// into stable HTTP conflict responses instead of leaking driver errors.
func IsUniqueViolation(err error) bool {
	var postgresError *pq.Error
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}
