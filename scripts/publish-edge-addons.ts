import fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

type EdgeOperation = {
  status?: string;
  message?: string | null;
  errorCode?: string | null;
  errors?: unknown;
};

const API_ROOT = 'https://api.addons.microsoftedge.microsoft.com/v1';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeResponseBody(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body, null, 2);
}

function getOperationId(location: string | null): string {
  if (!location) {
    throw new Error('Microsoft Edge Add-ons response did not include a Location header with an operation ID.');
  }

  const trimmed = location.trim();
  const parts = trimmed.split('/').filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

function edgeHeaders(includeZipContentType = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `ApiKey ${requireEnv('EDGE_API_KEY')}`,
    'X-ClientID': requireEnv('EDGE_CLIENT_ID'),
  };

  if (includeZipContentType) {
    headers['Content-Type'] = 'application/zip';
  }

  return headers;
}

async function pollOperation(url: string, label: string): Promise<void> {
  const attempts = Number.parseInt(process.env.EDGE_POLL_ATTEMPTS || '30', 10);
  const intervalSeconds = Number.parseInt(process.env.EDGE_POLL_INTERVAL_SECONDS || '10', 10);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'GET',
      headers: edgeHeaders(),
    });
    const body = await readResponse(response);

    if (!response.ok) {
      throw new Error(`${label} status request failed: ${describeResponseBody(body)}`);
    }

    const operation = body as EdgeOperation;
    const status = operation.status || 'Unknown';
    console.log(`${label} status (${attempt}/${attempts}): ${status}`);

    if (status === 'Succeeded') {
      if (operation.message) {
        console.log(operation.message);
      }
      return;
    }

    if (status === 'Failed') {
      throw new Error(`${label} failed: ${describeResponseBody(operation)}`);
    }

    if (attempt < attempts) {
      await setTimeout(intervalSeconds * 1000);
    }
  }

  throw new Error(`${label} did not finish after ${attempts} attempts.`);
}

async function main(): Promise<void> {
  const productId = requireEnv('EDGE_PRODUCT_ID');
  const zipPath = path.resolve(process.env.EDGE_ZIP_PATH || 'dist/theater-everywhere-chrome.zip');

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Microsoft Edge Add-ons ZIP not found: ${zipPath}`);
  }

  const packageUrl = `${API_ROOT}/products/${productId}/submissions/draft/package`;
  const submissionsUrl = `${API_ROOT}/products/${productId}/submissions`;
  const zip = fs.readFileSync(zipPath);

  console.log(`Uploading Microsoft Edge Add-ons package: ${zipPath}`);
  const uploadResponse = await fetch(packageUrl, {
    method: 'POST',
    headers: edgeHeaders(true),
    body: new Uint8Array(zip),
  });
  const uploadBody = await readResponse(uploadResponse);

  if (uploadResponse.status !== 202) {
    throw new Error(`Microsoft Edge Add-ons upload failed: ${describeResponseBody(uploadBody)}`);
  }

  const uploadOperationId = getOperationId(uploadResponse.headers.get('location'));
  await pollOperation(`${packageUrl}/operations/${uploadOperationId}`, 'Microsoft Edge package upload');

  console.log('Publishing Microsoft Edge Add-ons draft submission...');
  const publishNotes = process.env.EDGE_PUBLISH_NOTES || 'Automated release from GitHub Actions.';
  const publishResponse = await fetch(submissionsUrl, {
    method: 'POST',
    headers: {
      ...edgeHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes: publishNotes }),
  });
  const publishBody = await readResponse(publishResponse);

  if (publishResponse.status !== 202) {
    throw new Error(`Microsoft Edge Add-ons publish failed: ${describeResponseBody(publishBody)}`);
  }

  const publishOperationId = getOperationId(publishResponse.headers.get('location'));
  await pollOperation(`${submissionsUrl}/operations/${publishOperationId}`, 'Microsoft Edge publish');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
