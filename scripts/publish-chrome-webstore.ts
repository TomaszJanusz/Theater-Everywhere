import fs from 'node:fs';
import path from 'node:path';

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

function getUploadState(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('uploadState' in body) || typeof body.uploadState !== 'string') {
    return null;
  }

  return body.uploadState;
}

async function requestAccessToken(): Promise<string> {
  const clientId = requireEnv('CWS_CLIENT_ID');
  const clientSecret = requireEnv('CWS_CLIENT_SECRET');
  const refreshToken = requireEnv('CWS_REFRESH_TOKEN');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const body = await readResponse(response);

  if (!response.ok) {
    throw new Error(`Failed to refresh Chrome Web Store token: ${describeResponseBody(body)}`);
  }

  if (!body || typeof body !== 'object' || !('access_token' in body) || typeof body.access_token !== 'string') {
    throw new Error(`Chrome Web Store token response did not include access_token: ${describeResponseBody(body)}`);
  }

  return body.access_token;
}

async function waitForUpload(token: string, itemUrl: string, initialBody: unknown): Promise<void> {
  const attempts = Number.parseInt(process.env.CWS_POLL_ATTEMPTS || '30', 10);
  const intervalSeconds = Number.parseInt(process.env.CWS_POLL_INTERVAL_SECONDS || '10', 10);
  let latestBody = initialBody;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const uploadState = getUploadState(latestBody);
    if (!uploadState) {
      console.log('Chrome Web Store upload response did not include uploadState; continuing to publish.');
      return;
    }

    console.log(`Chrome Web Store upload state (${attempt}/${attempts}): ${uploadState}`);

    if (uploadState.includes('SUCCESS')) {
      return;
    }

    if (uploadState.includes('FAIL')) {
      throw new Error(`Chrome Web Store upload failed: ${describeResponseBody(latestBody)}`);
    }

    if (!uploadState.includes('PROGRESS') && !uploadState.includes('PENDING')) {
      return;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    }

    const statusResponse = await fetch(`${itemUrl}:fetchStatus`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    latestBody = await readResponse(statusResponse);

    if (!statusResponse.ok) {
      throw new Error(`Chrome Web Store fetchStatus failed: ${describeResponseBody(latestBody)}`);
    }
  }

  throw new Error(`Chrome Web Store upload did not finish after ${attempts} attempts.`);
}

async function main(): Promise<void> {
  const publisherId = requireEnv('CWS_PUBLISHER_ID');
  const extensionId = requireEnv('CWS_EXTENSION_ID');
  const zipPath = path.resolve(process.env.CWS_ZIP_PATH || 'dist/theater-everywhere-chrome.zip');

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Chrome Web Store ZIP not found: ${zipPath}`);
  }

  const token = await requestAccessToken();
  const zip = fs.readFileSync(zipPath);
  const itemUrl = `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}`;

  console.log(`Uploading Chrome Web Store package: ${zipPath}`);
  const uploadResponse = await fetch(
    `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
      body: new Uint8Array(zip),
    }
  );
  const uploadBody = await readResponse(uploadResponse);

  if (!uploadResponse.ok) {
    throw new Error(`Chrome Web Store upload failed: ${describeResponseBody(uploadBody)}`);
  }

  console.log(`Chrome Web Store upload response: ${describeResponseBody(uploadBody)}`);
  await waitForUpload(token, itemUrl, uploadBody);

  console.log('Submitting Chrome Web Store package for review...');
  const publishResponse = await fetch(`${itemUrl}:publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const publishBody = await readResponse(publishResponse);

  if (!publishResponse.ok) {
    throw new Error(`Chrome Web Store publish failed: ${describeResponseBody(publishBody)}`);
  }

  console.log(`Chrome Web Store publish response: ${describeResponseBody(publishBody)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
