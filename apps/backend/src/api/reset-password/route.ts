import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/** A browser fallback for reset links opened from email on iOS and Android. */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'")
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset your password · Bawi Shopping</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f8f6f3; color: #211d1a; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(100%, 420px); padding: 36px 28px; background: #fff; border: 1px solid #e8e2db; border-radius: 20px; box-shadow: 0 18px 48px rgba(33,29,26,.07); }
    .brand { margin: 0 0 28px; font-size: 20px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; }
    p { margin: 0 0 24px; color: #6b625a; }
    label { display: block; margin: 18px 0 6px; font-size: 14px; font-weight: 600; }
    input { width: 100%; padding: 13px 14px; border: 1px solid #bcb3aa; border-radius: 10px; background: #fff; color: #211d1a; font: inherit; }
    input:focus { outline: 2px solid #211d1a; outline-offset: 2px; }
    button { width: 100%; margin-top: 24px; padding: 15px; border: 0; border-radius: 10px; background: #211d1a; color: #fff; font: inherit; font-weight: 650; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    #message { margin: 18px 0 0; color: #9d2e25; }
    #message:empty { display: none; }
  </style>
</head>
<body>
  <main>
    <div class="brand">Bawi Shopping</div>
    <h1>Reset your password</h1>
    <p>Choose a new password for your Bawi account.</p>
    <form id="reset-form">
      <label for="password">New password</label>
      <input id="password" type="password" autocomplete="new-password" minlength="8" required>
      <label for="confirm">Confirm new password</label>
      <input id="confirm" type="password" autocomplete="new-password" minlength="8" required>
      <button type="submit">Update password</button>
    </form>
    <p id="message" role="status" aria-live="polite"></p>
  </main>
  <script>
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('token');
    const email = params.get('email');
    history.replaceState(null, '', location.pathname);
    const form = document.getElementById('reset-form');
    const message = document.getElementById('message');
    if (!token || !email) {
      form.hidden = true;
      message.textContent = 'This reset link is incomplete. Request a new email from the Bawi Shopping app.';
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      if (password !== document.getElementById('confirm').value) {
        message.textContent = 'The passwords do not match.';
        return;
      }
      const button = form.querySelector('button');
      button.disabled = true;
      message.textContent = '';
      try {
        const response = await fetch('/auth/customer/emailpass/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) throw new Error('Reset failed');
        form.hidden = true;
        message.style.color = '#186341';
        message.textContent = 'Password updated. Open Bawi Shopping and log in with your new password.';
      } catch {
        message.textContent = 'This link may have expired. Request a new password-reset email from the Bawi Shopping app.';
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`)
}
