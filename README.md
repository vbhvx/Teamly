# Teamly

Teamly is a workspace-based task-management application. It implements registration/login, workspace and membership administration, invitations, task workflows, task and workspace activity, and an OpenAPI route.

## Implementation

Built with Next.js 15, React 19, TypeScript, PostgreSQL, Drizzle ORM, Zod, bcrypt, Tailwind CSS, and Vitest. Route handlers are located at `src/app/api/v1`; database/migration code is under `src/db`; tests are separated into unit, integration, security, and end-to-end directories.

## Run locally

```bash
cd 8_Teamly
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Set `DATABASE_URL`, `DATABASE_TEST_URL`, `APP_URL`, and a strong `SESSION_SECRET`; configure auth rate limits according to the deployment.

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e
npm run typecheck
npm run build
```
