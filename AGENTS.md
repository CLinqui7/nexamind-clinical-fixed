# Linkare development rules

Use only real Supabase Auth in src. QA identities live only in qa and must never enter the production bundle. Never reintroduce seed bootstrapping, local passwords, role fallbacks, or broad JSON state access.

Permissions are enforced by SQL/Edge Functions, not hidden buttons. Secretary access must never include the private clinical chart. The explicit user-requested exception is `prescriptionsEdit`: secretaries may read, correct and archive existing prescriptions, including their prescription contents, while diagnoses, medications and notes outside those prescriptions remain hidden. This permission never authorizes issuing new prescriptions. Prescription deletion is a server-attributed archive that remains in revision and audit history; archived prescriptions cannot be restored, edited or printed. Use versioned per-resource deltas; never overwrite the clinic snapshot blindly. Signed notes must remain byte-preserving objects across normalization. Documents are archived, not destroyed by browser actions.

Plans are server-owned snapshots: 4000/22000/40000 USD cents with 1/6/12 calendar months. A redirect is not proof of payment. Webhooks require signature, app ID, reference, exact amount and idempotency. Never repeat an ambiguous checkout or notification automatically.

Run npm run check after edits. Backend fixtures in qa/backend/compiled.json are tied to source SHA-256; regenerate them with scripts/refresh-backend-tests.cjs and TypeScript when modifying functions. UI/SDK mock tests do not prove live database RLS, email delivery or payments; execute staging SQL and acceptance tests before release.

No production DB reset, no automatic reapplication of old migrations, no force push. Keep .env files, snapshots, downloaded records and QA outputs out of Git. Follow docs/DESPLIEGUE-v3.md. The old v1/v2 files are historical references, not current deployment instructions.
