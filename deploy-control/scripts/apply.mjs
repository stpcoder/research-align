import fs from 'node:fs';
import path from 'node:path';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node deploy-control/scripts/apply.mjs <manifest.json>');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const vercelToken = process.env.VERCEL_TOKEN;
if (!vercelToken) throw new Error('Missing GitHub Actions secret: VERCEL_TOKEN');

const secretBag = (() => {
  const raw = process.env.DEPLOY_CONTROL_SECRETS || '{}';
  try { return JSON.parse(raw); }
  catch { throw new Error('DEPLOY_CONTROL_SECRETS must be a JSON object'); }
})();

const githubAdminToken = process.env.GITHUB_ADMIN_TOKEN || '';
const name = manifest.name;
const teamId = manifest.teamId || process.env.VERCEL_TEAM_ID;
const framework = manifest.framework || 'nextjs';
const gitRepo = manifest.git?.repo;
const gitRef = manifest.git?.ref || 'main';

if (!name) throw new Error('Manifest requires name');
if (!teamId) throw new Error('Manifest requires teamId (or VERCEL_TEAM_ID)');
if (!gitRepo || !gitRepo.includes('/')) throw new Error('Manifest requires git.repo as owner/repo');

const q = (extra = {}) => new URLSearchParams({ teamId, ...extra }).toString();

async function readJson(res) {
  const text = await res.text();
  let body = text;
  try { body = text ? JSON.parse(text) : {}; } catch {}
  return body;
}

async function vercelApi(endpoint, options = {}, { allow404 = false } = {}) {
  const res = await fetch(`https://api.vercel.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await readJson(res);
  if (allow404 && res.status === 404) return null;
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Vercel ${options.method || 'GET'} ${endpoint} -> ${res.status}: ${detail}`);
  }
  return body;
}

async function githubApi(endpoint, options = {}, { allow404 = false } = {}) {
  if (!githubAdminToken) throw new Error('GITHUB_ADMIN_TOKEN is required for git.createIfMissing');
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${githubAdminToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await readJson(res);
  if (allow404 && res.status === 404) return null;
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`GitHub ${options.method || 'GET'} ${endpoint} -> ${res.status}: ${detail}`);
  }
  return body;
}

async function ensureGithubRepo() {
  if (!manifest.git?.createIfMissing) return;
  const [owner, repo] = gitRepo.split('/');
  const existing = await githubApi(`/repos/${owner}/${repo}`, {}, { allow404: true });
  if (existing) return;

  const me = await githubApi('/user');
  const privateRepo = (manifest.git.visibility || 'private') !== 'public';
  const body = {
    name: repo,
    private: privateRepo,
    auto_init: true,
    description: manifest.git.description || `Managed by deploy-control for ${name}`,
  };

  if (me.login === owner) {
    await githubApi('/user/repos', { method: 'POST', body: JSON.stringify(body) });
  } else {
    await githubApi(`/orgs/${owner}/repos`, { method: 'POST', body: JSON.stringify(body) });
  }
  console.log(`Created GitHub repository ${gitRepo}`);
}

async function getProject() {
  return vercelApi(`/v9/projects/${encodeURIComponent(name)}?${q()}`, {}, { allow404: true });
}

async function ensureProject() {
  let project = await getProject();
  const [owner] = gitRepo.split('/');

  if (!project) {
    const body = {
      name,
      framework,
      gitRepository: { type: 'github', repo: gitRepo },
      ...(manifest.rootDirectory ? { rootDirectory: manifest.rootDirectory } : {}),
      ...(manifest.publicProduction === true ? { ssoProtection: null } : {}),
    };
    project = await vercelApi(`/v11/projects?${q()}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    console.log(`Created Vercel project ${name} (${project.id})`);
  } else {
    const patch = {
      framework,
      ...(manifest.rootDirectory !== undefined ? { rootDirectory: manifest.rootDirectory } : {}),
      ...(manifest.publicProduction === true ? { ssoProtection: null } : {}),
      ...(manifest.ssoProtection ? { ssoProtection: manifest.ssoProtection } : {}),
    };
    project = await vercelApi(`/v9/projects/${encodeURIComponent(project.id || name)}?${q()}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    console.log(`Reconciled Vercel project ${name} (${project.id})`);
  }

  if (manifest.publicProduction === true) {
    // Explicitly disable Vercel Authentication even if a team default enabled it.
    project = await vercelApi(`/v9/projects/${encodeURIComponent(project.id || name)}?${q()}`, {
      method: 'PATCH',
      body: JSON.stringify({ ssoProtection: null }),
    });
  }

  return project;
}

function resolveEnv(entry) {
  if (Object.prototype.hasOwnProperty.call(entry, 'value')) return String(entry.value);
  if (entry.fromSecret) {
    const value = secretBag[entry.fromSecret];
    if (value === undefined || value === null || value === '') {
      if (entry.optional) return null;
      throw new Error(`Missing '${entry.fromSecret}' in DEPLOY_CONTROL_SECRETS`);
    }
    return String(value);
  }
  throw new Error(`Environment entry ${entry.key} needs value or fromSecret`);
}

async function reconcileEnv(project) {
  const configured = [];
  for (const entry of manifest.env || []) {
    const value = resolveEnv(entry);
    if (value === null) {
      console.log(`Skipping optional secret ${entry.key}`);
      continue;
    }
    configured.push({
      key: entry.key,
      value,
      type: entry.type || (entry.fromSecret ? 'sensitive' : 'plain'),
      target: entry.target || ['production', 'preview'],
      ...(entry.gitBranch ? { gitBranch: entry.gitBranch } : {}),
      ...(entry.comment ? { comment: entry.comment } : {}),
    });
  }
  if (!configured.length) return;
  await vercelApi(`/v10/projects/${encodeURIComponent(project.id || name)}/env?${q({ upsert: 'true' })}`, {
    method: 'POST',
    body: JSON.stringify(configured),
  });
  console.log(`Upserted ${configured.length} Vercel environment variable(s)`);
}

async function createDeployment(project) {
  if (manifest.deploy === false) return null;
  const [org, repo] = gitRepo.split('/');
  const body = {
    name,
    project: project.id,
    target: manifest.target || 'production',
    gitSource: {
      type: 'github',
      org,
      repo,
      ref: gitRef,
    },
    projectSettings: {
      framework,
      ...(manifest.rootDirectory ? { rootDirectory: manifest.rootDirectory } : {}),
    },
  };
  const deployment = await vercelApi(`/v13/deployments?${q()}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log(`Created deployment ${deployment.id || deployment.uid}`);
  return deployment;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDeployment(deployment) {
  if (!deployment) return null;
  const id = deployment.id || deployment.uid;
  for (let attempt = 0; attempt < 100; attempt++) {
    const current = await vercelApi(`/v13/deployments/${encodeURIComponent(id)}?${q()}`);
    const status = current.readyState || current.status || current.state;
    process.stdout.write(`Deployment ${id}: ${status || 'unknown'}\n`);
    if (status === 'READY') return current;
    if (['ERROR', 'CANCELED', 'CANCELLED'].includes(status)) {
      throw new Error(`Deployment ${id} ended as ${status}: ${current.errorMessage || current.error || ''}`);
    }
    await sleep(3000);
  }
  throw new Error(`Deployment ${id} did not become READY before timeout`);
}

function normalizeDomain(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = normalizeDomain(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') return normalizeDomain(value.url || value.alias || value.name || value.domain);
  const text = String(value);
  return text.startsWith('http://') || text.startsWith('https://') ? text : `https://${text}`;
}

function findProductionUrl(project, deployment) {
  const candidates = [
    project?.targets?.production?.alias,
    project?.targets?.production?.aliases,
    project?.production?.alias,
    project?.alias,
    deployment?.alias,
    deployment?.aliases,
    deployment?.url,
  ];
  for (const candidate of candidates) {
    const domain = normalizeDomain(candidate);
    if (domain) return domain;
  }
  return null;
}

async function writeState(project, deployment) {
  const refreshed = await getProject();
  const state = {
    name,
    teamId,
    projectId: project.id,
    git: { repo: gitRepo, ref: gitRef },
    framework,
    rootDirectory: manifest.rootDirectory ?? null,
    publicProduction: manifest.publicProduction === true,
    deploymentId: deployment?.id || deployment?.uid || null,
    deploymentStatus: deployment?.readyState || deployment?.status || deployment?.state || null,
    deploymentUrl: normalizeDomain(deployment?.url),
    productionUrl: findProductionUrl(refreshed || project, deployment),
    updatedAt: new Date().toISOString(),
  };
  const stateDir = path.join('deploy-control', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  const statePath = path.join(stateDir, `${name}.json`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(`State written: ${statePath}`);
  console.log(JSON.stringify(state, null, 2));

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## ${name}\n- Project: \`${state.projectId}\`\n- Deployment: \`${state.deploymentId || 'n/a'}\`\n- Status: **${state.deploymentStatus || 'n/a'}**\n- Production: ${state.productionUrl || 'not resolved'}\n\n`);
  }
}

await ensureGithubRepo();
const project = await ensureProject();
await reconcileEnv(project);
const initialDeployment = await createDeployment(project);
const finalDeployment = await waitForDeployment(initialDeployment);
await writeState(project, finalDeployment);
