# Deploy Control Plane

The primary deployment path is now a **server-side ChatGPT control plane** hosted in the connected Supabase project. GitHub remains the source of truth for application source; Vercel REST API manages persistent projects and production deployments.

## Architecture

```text
ChatGPT
  -> GitHub source / main
  -> Supabase deploy_control_jobs
  -> Postgres pg_net trigger
  -> Supabase Edge Function: vercel-control
  -> Vercel REST API
  -> persistent Vercel Project + production deployment
  -> deploy_control_state
```

Vercel credentials are stored only in the Supabase private server-side secret store. They are not committed to GitHub and are not exposed to the browser.

The original token used to bootstrap the system was rotated to a dedicated `chatgpt-deploy-control` token and revoked after rotation.

## Why snapshot deployment exists

The control plane first creates/reconciles a persistent Vercel Project. For deployments it can snapshot the configured GitHub branch and upload those files through Vercel's Files Deployment API. This keeps ChatGPT deployments working even when the Vercel GitHub App is not authorized for the repository.

If the Vercel GitHub App is authorized later, normal push-triggered Vercel deployments can coexist with this control plane.

## Project manifest

`deploy-control/projects/<project>.json` documents the desired project configuration. The live Supabase control plane currently consumes an equivalent manifest payload containing at least:

```json
{
  "name": "research-align",
  "repo": "stpcoder/research-align",
  "branch": "main",
  "framework": "nextjs",
  "publicProduction": true,
  "env": []
}
```

`publicProduction: true` reconciles Vercel Authentication to disabled (`ssoProtection: null`) so participant-facing production URLs remain public.

## Deployment lifecycle

1. ChatGPT updates the GitHub source.
2. ChatGPT inserts an `apply-project` row into `deploy_control_jobs`.
3. The database trigger dispatches the job without exposing control credentials.
4. `vercel-control` creates or reconciles the persistent Vercel Project.
5. Environment variables are upserted from public values and server-only secret references.
6. The GitHub branch is snapshotted and uploaded to Vercel.
7. Vercel builds the production deployment.
8. `deploy_control_state` records project ID, deployment ID, status and canonical production URL.
9. The matching job is marked `succeeded` or `failed`.

## GitHub Actions fallback

`.github/workflows/vercel-control.yml` remains available as a **manual fallback only**. It no longer runs on every push. The normal ChatGPT path does not require a GitHub Actions `VERCEL_TOKEN` secret.

## Current Research Align production

The persistent Vercel project is `research-align`, and its canonical production domain is:

`https://research-align.vercel.app`
