# Security Practices Guide

Never write `db.execute(sql.raw(...))` outside of verified administrative control nodes. Always write negative path integration tests (`test/integration/security.test.ts`) validating that a 403 error is thrown for standard users on restricted assets.
