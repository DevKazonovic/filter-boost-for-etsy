const http = require('http');
const { execFile } = require('child_process');
const readline = require('readline');

const PORT = Number(process.env.PORT || 0);
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

let redirect = '';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      const write = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (text) => (text.includes(question) ? write(text) : write('*'));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(command, [url], () => {});
}

async function exchange(clientId, clientSecret, code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    }),
  });
  return { ok: response.ok, body: await response.json() };
}

(async () => {
  const clientId = process.env.CWS_CLIENT_ID || (await ask('Client ID: '));
  const clientSecret = process.env.CWS_CLIENT_SECRET || (await ask('Client secret: ', true));

  if (!clientId || !clientSecret) {
    console.error('Both a client ID and a client secret are required.');
    process.exit(1);
  }

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, redirect);
      const received = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:3rem">${
          received ? 'Authorised. You can close this tab and go back to the terminal.' : `Failed: ${error || 'no code returned'}`
        }</body>`
      );
      server.close();
      received ? resolve(received) : reject(new Error(error || 'no code returned'));
    });

    server.listen(PORT, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${server.address().port}`;
      const authUrl =
        'https://accounts.google.com/o/oauth2/auth?' +
        new URLSearchParams({
          response_type: 'code',
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPE,
          client_id: clientId,
          redirect_uri: redirect,
        });

      console.log(`\nListening on ${redirect}`);
      console.log('Approve access in the browser window that just opened.');
      console.log('If it did not open, paste this into your browser:\n');
      console.log(authUrl + '\n');
      openBrowser(authUrl);
    });

    server.on('error', reject);
  });

  const { ok, body } = await exchange(clientId, clientSecret, code);

  if (!ok || !body.refresh_token) {
    console.error('\nToken exchange failed:');
    console.error(JSON.stringify(body, null, 2));
    if (body.error === 'invalid_grant') {
      console.error('\nThe code expired or was already used. Run this again.');
    }
    if (ok && !body.refresh_token) {
      console.error('\nGoogle returned no refresh token. Remove the app under');
      console.error('https://myaccount.google.com/permissions and run this again.');
    }
    process.exit(1);
  }

  console.log('\nAdd these as GitHub repository secrets:\n');
  console.log(`CWS_CLIENT_ID       ${clientId}`);
  console.log(`CWS_CLIENT_SECRET   ${clientSecret}`);
  console.log(`CWS_REFRESH_TOKEN   ${body.refresh_token}`);
  console.log('\nCWS_EXTENSION_ID is the 32 letter id in your dashboard URL.\n');
  process.exit(0);
})();
