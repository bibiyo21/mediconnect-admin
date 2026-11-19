# mediconnect-admin

Next.js administration console for MediConnect (Phase 2, increment 2.4). The clinic console joins it in increment 2.6 (D-03).

## What it does today

| Screen | API | Who |
|---|---|---|
| Sign in, then the second factor (authenticator code or recovery code) | `POST /auth/login`, `POST /auth/mfa/verify` | staff accounts |
| Two-step verification setup (setup key, confirm, recovery codes shown once) | `POST /auth/mfa/totp/setup`, `/confirm` | privileged accounts without MFA |
| Overview (counts only) | `GET /admin/overview` | `users.view` |
| Users: list with search and filters, detail, suspend and reactivate, roles | `/admin/users…` | `users.view`; `users.suspend`; `roles.manage` (SUPER_ADMIN) |
| Audit logs with filters | `GET /admin/audit-logs` | `audit_logs.view` |
| Settings (JSON values; secrets refused) | `/admin/settings…` | `settings.manage` |

The navigation hides sections a role cannot use; the API checks every permission again.

## Security model

- **Session:** cookie session and CSRF (D-04). The browser never stores a token, and pages never put identifiers in URLs except record ids.
- **MFA:** privileged roles must enrol before the API lets them do anything else.
- **Step-up:** suspending, reactivating, changing roles and saving settings need a reason and a fresh authenticator code. The step-up dialog asks for the code and retries the action once (`src/components/StepUp.tsx`). Each such action is written to `admin_activity_logs` with the reason.
- **Data:** medical information is never shown in the console.

## Run it

Requires the API (from `mediconnect-infrastructure`) and the shared packages built (`cd ../shared && pnpm build`). The API allows `http://localhost:3001` for CORS and Sanctum by default.

```bash
pnpm install
pnpm dev                 # http://localhost:3001
pnpm typecheck && pnpm lint && pnpm build
pnpm e2e                 # Playwright + axe, three viewports, API mocked (no backend needed)
pnpm e2e:wip             # WIP screenshots to ../docs/wip-screenshots/
```

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | API base URL (public; no secrets in `NEXT_PUBLIC_*`) |

## Not yet

- Audit log export (`audit_logs.export`) and editing account details (`users.update`).
- Doctor verification (increment 2.9) and clinic management (2.6).
- A QR code for MFA setup: today the setup key and an `otpauth://` link are shown.
