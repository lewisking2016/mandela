---
name: security-auditor
description: >-
  Comprehensive security analysis skill covering OWASP Top 10, SQL Injection, CSRF, XSS, rate limiting, and HTTP header hardening.
---

# Security Auditor Skill

## Audit Rules
1. **Input Validation & Sanitization**: Enforce filter_input, parameterized SQL queries, and HTML entity escaping.
2. **CSRF Protection**: Verify anti-CSRF token generation, validation, and session binding on all state-changing endpoints.
3. **Rate Limiting**: Prevent brute-force submissions with IP-based rate limiting windows.
4. **Security Headers**: Enforce `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`.
