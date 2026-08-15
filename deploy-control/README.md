# Deploy Control Plane

This folder turns GitHub into a control plane for Vercel projects. A project manifest is the desired state; GitHub Actions creates/reconciles the Vercel project, Git connection, environment variables, deployment protection, and a production deployment.

## One-time setup

### Required: `VERCEL_TOKEN`

Create a Vercel access token that can manage projects/deployments in the target team, then add it to this repository:

`GitHub → Settings → Secrets and variables → Actions → New repository secret`

Name it exactly:

```text
VERCEL_TOKEN
```

The Vercel team ID is stored per manifest, so it does not need to be a secret.

### Optional: `DEPLOY_CONTROL_SECRETS`

Sensitive app environment variables are referenced by name from manifests. Store them in one JSON-valued Actions secret:

```json
{
  "KEYID_PROJECT_KEY": "...",
  "DATABASE_URL": "...",
  "OTHER_API_KEY": "..."
}
```

Secret name:

```text
DEPLOY_CONTROL_SECRETS
```

A manifest uses it like this:

```json
{
  "key": "KEYID_PROJECT_KEY",
  "fromSecret": "KEYID_PROJECT_KEY",
  "type": "sensitive",
  "target": ["production"],
  "optional": true
}
```

### Optional: `GITHUB_ADMIN_TOKEN`

Only needed if a future manifest sets `git.createIfMissing: true`. Use a fine-grained GitHub PAT with repository Administration/write permission for the target owner, then save it as:

```text
GITHUB_ADMIN_TOKEN
```

Without this secret, deploy-control still works for repositories that already exist.

## Manifest

One JSON file lives at `deploy-control/projects/<project>.json`.

Example:

```json
{
  "name": "my-app",
  "teamId": "team_xxx",
  "framework": "nextjs",
  "git": {
    "repo": "owner/my-app",
    "ref": "main",
    "createIfMissing": false
  },
  "rootDirectory": null,
  "publicProduction": true,
  "deploy": true,
  "target": "production",
  "env": [
    {
      "key": "NEXT_PUBLIC_API_URL",
      "value": "https://example.com",
      "type": "plain",
      "target": ["production", "preview"]
    },
    {
      "key": "API_SECRET",
      "fromSecret": "API_SECRET",
      "type": "sensitive",
      "target": ["production"]
    }
  ]
}
```

## What `publicProduction` does

When `publicProduction` is `true`, the control plane explicitly sends `ssoProtection: null` through the Vercel project API. This disables Vercel Authentication for that project so public participant/customer URLs do not get stuck behind the Vercel login page.

## Execution

Changing a manifest automatically runs `.github/workflows/vercel-control.yml`.

It will:

1. Optionally create the GitHub repository.
2. Create the Vercel project if it does not exist.
3. Connect it to the GitHub repository.
4. Reconcile framework/root-directory/deployment-protection settings.
5. Upsert public and secret environment variables.
6. Create a production deployment from the configured Git ref.
7. Poll until the deployment is `READY` or fails.
8. Write the resolved project/deployment/production URL to `deploy-control/state/<project>.json`.
9. Commit that state file back to this repository.

You can also run it manually from GitHub Actions → **Vercel Control Plane** → **Run workflow**.

## Normal ChatGPT workflow after setup

For an existing GitHub repository, a ChatGPT session only needs to:

1. Write/update application source in GitHub.
2. Create/update `deploy-control/projects/<name>.json`.
3. The workflow creates or updates the corresponding Vercel project and deployment.
4. ChatGPT reads `deploy-control/state/<name>.json` and reports the canonical production URL.

Once Vercel Git Integration is established, ordinary source pushes will also trigger Vercel's normal Git deployments. The control-plane manifest is primarily for project bootstrap and infrastructure/config changes.
