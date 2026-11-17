# AuditFlow

A complete audit-management MVP for manager and doctor workflows. It includes protected role-based access, dashboards, confirmed Excel imports, assignment and reassignment history, doctor management, the audit/review workspace, supporting-evidence uploads, configurable master data, CSV reports, analytics, notifications, settings, and an audit trail.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with one of the initial accounts:

- Manager: `manager@auditflow.in` / `Audit@123`
- Doctor: `doctor@auditflow.in` / `Audit@123`

Change these credentials in `.env` before deployment.

### PostgreSQL and Redis

The production data schema and session infrastructure are included. Start the local services with:

```bash
docker compose up -d
```

Copy `.env.example` to `.env`, expose its variables to the Node process, then initialize the database:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

When `DATABASE_URL` is configured, authentication reads hashed users and account-lockout state from PostgreSQL. When `REDIS_URL` is configured, sessions are shared through Redis. Without those variables the application deliberately uses JSON data and memory sessions for zero-configuration development only. Production startup fails if a configured PostgreSQL database cannot be reached.

For a production build:

```bash
npm run build
npm start
```

Open `http://localhost:4000`.

## File storage

Copy `.env.example` to `.env` and add all three Cloudinary settings to enable Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

If any credential is absent, uploads are stored automatically in `storage/uploads/` and served from `/uploads`. The active provider is available from `GET /api/health` and is visible in the server startup log.

## Excel import

The import preview accepts `.xlsx`, `.xls`, and `.csv` files, detects columns, counts missing Case IDs, and detects duplicate Case IDs. Supported ID headings are `Case ID`, `caseId`, and `CaseID`. Confirming the preview creates both the batch and its valid cases in the application database.

## Data

The app starts with representative demo data. API mutations are persisted to `server/data.json`, which is ignored by Git. Delete that generated file to return to the initial seed data.

## Implemented workflows

- Manager/doctor authentication with HTTP-only sessions and server-enforced RBAC
- Excel validation, preview, confirmation, and batch creation
- Manual assignment and reassignment with immutable assignment history
- Doctor drafts, validated submission, manager approval, and return for correction
- Doctor creation, activation/deactivation, workload and performance summaries
- Configurable audit result, finding, verification, financial, clinical, and decision options
- Local or Cloudinary evidence storage
- Notifications, activity log, configurable organization settings, and CSV report exports

The current persistence layer is intentionally file-backed for zero-configuration local operation. For horizontally scaled production deployment, replace `server/data.json` and the in-memory session map with PostgreSQL and a shared session store such as Redis.
