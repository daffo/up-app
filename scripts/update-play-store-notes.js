#!/usr/bin/env node
/**
 * Updates Google Play Store release notes for the latest production release.
 * Reads from changelogs/en-US.txt and changelogs/it-IT.txt.
 *
 * Usage: node scripts/update-play-store-notes.js
 * Requires: GOOGLE_SERVICE_ACCOUNT_KEY_FILE env var pointing to the JSON key file
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const PACKAGE_NAME = 'com.daffo.upapp';
const TRACK = 'production';
const SCOPES = 'https://www.googleapis.com/auth/androidpublisher';

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = base64url(sign.sign(serviceAccount.private_key));
  const jwt = `${header}.${payload}.${signature}`;

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await request('POST', 'oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  return res.access_token;
}

function request(method, host, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: host, path, headers: { ...headers } };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 300) {
          reject(new Error(`${method} ${path} → ${res.statusCode}: ${text}`));
        } else {
          resolve(text ? JSON.parse(text) : {});
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function api(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  const bodyStr = body ? JSON.stringify(body) : undefined;
  if (bodyStr) headers['Content-Type'] = 'application/json';
  return request(method, 'androidpublisher.googleapis.com', path, bodyStr, headers);
}

function loadChangelogs() {
  const notes = [];
  const files = { 'en-US': 'changelogs/en-US.txt', 'it-IT': 'changelogs/it-IT.txt' };
  for (const [lang, file] of Object.entries(files)) {
    if (fs.existsSync(file)) {
      notes.push({ language: lang, text: fs.readFileSync(file, 'utf-8').trim() });
    }
  }
  return notes;
}

async function main() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './google-service-account.json';
  const serviceAccount = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
  const releaseNotes = loadChangelogs();

  if (releaseNotes.length === 0) {
    console.log('No changelogs found, skipping release notes update');
    return;
  }

  console.log(`Found ${releaseNotes.length} changelog(s): ${releaseNotes.map(n => n.language).join(', ')}`);

  const token = await getAccessToken(serviceAccount);
  const basePath = `/androidpublisher/v3/applications/${PACKAGE_NAME}`;

  // Create edit
  const edit = await api('POST', `${basePath}/edits`, token);
  const editId = edit.id;
  console.log(`Created edit: ${editId}`);

  // Get current track
  const track = await api('GET', `${basePath}/edits/${editId}/tracks/${TRACK}`, token);
  console.log(`Current track has ${track.releases?.length || 0} release(s)`);

  // Add release notes to the latest release
  if (track.releases && track.releases.length > 0) {
    track.releases[0].releaseNotes = releaseNotes;

    // Update track
    await api('PUT', `${basePath}/edits/${editId}/tracks/${TRACK}`, token, track);
    console.log('Updated release notes');

    // Commit edit
    await api('POST', `${basePath}/edits/${editId}:commit`, token);
    console.log('Committed edit — release notes are live');
  } else {
    console.log('No releases found on track, skipping');
  }
}

main().catch((err) => {
  console.error('Failed to update release notes:', err.message);
  process.exit(1);
});
