/**
 * One-shot OAuth token capture server.
 * Starts an HTTP server on port 8080 that serves a redirect handler page.
 * When Facebook redirects back with the token in the URL fragment, the page
 * POSTs it to /save and the server writes it to .token then exits.
 *
 * Usage:  node capture-token.mjs
 * Then visit the OAuth URL in a browser (already handled by the automation).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 8080;
const TOKEN_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.token');

const HTML = `<!DOCTYPE html>
<html>
<head><title>Token Capture</title></head>
<body>
<p id="status">Capturing token...</p>
<script>
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const error = params.get('error');
  if (token) {
    document.getElementById('status').textContent = 'Token captured! You can close this window.';
    fetch('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({access_token: token, raw_hash: hash})
    });
  } else if (error) {
    document.getElementById('status').textContent = 'Error: ' + error + ' - ' + params.get('error_description');
    fetch('/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({error, error_description: params.get('error_description')})
    });
  } else {
    document.getElementById('status').textContent = 'No token found in URL. Hash: ' + window.location.hash;
  }
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      fs.writeFileSync(TOKEN_FILE, body);
      console.log('[capture-token] Token saved to', TOKEN_FILE);
      res.writeHead(200);
      res.end('OK');
      server.close(() => process.exit(0));
    });
  } else {
    // Serve the capture HTML for any GET request
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log(`[capture-token] Listening on http://localhost:${PORT}`);
  console.log('[capture-token] Waiting for Facebook OAuth redirect...');
});
