const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8788;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'donations.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id TEXT UNIQUE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  note TEXT,
  donated_at TEXT NOT NULL
);
`);

app.use(cors());
app.use(express.urlencoded({
  extended: false,
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.json());

const insertDonation = db.prepare(`
INSERT OR IGNORE INTO donations (tx_id, name, amount, currency, note, donated_at)
VALUES (@tx_id, @name, @amount, @currency, @note, @donated_at)
`);

const latestDonations = db.prepare(`
SELECT name, amount, currency, note, donated_at
FROM donations
ORDER BY datetime(donated_at) DESC
LIMIT ?
`);

app.get('/api/donations', (req, res) => {
  const rawLimit = Number(req.query.limit || 30);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 30;
  const rows = latestDonations.all(limit).map((r) => ({
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    note: r.note || '',
    donatedAt: r.donated_at
  }));

  res.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    donations: rows
  });
});

app.post('/api/paypal/ipn', async (req, res) => {
  try {
    const bodyRaw = req.rawBody || '';
    if (!bodyRaw) {
      return res.status(400).send('missing body');
    }

    const verifyPayload = `cmd=_notify-validate&${bodyRaw}`;
    const useSandbox = process.env.PAYPAL_IPN_SANDBOX === 'true';
    const verifyUrl = useSandbox
      ? 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
      : 'https://ipnpb.paypal.com/cgi-bin/webscr';

    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'FriendlyShooter-IPN-Listener'
      },
      body: verifyPayload
    });

    const verifyText = (await verifyResponse.text()).trim();
    if (verifyText !== 'VERIFIED') {
      return res.status(400).send('invalid ipn');
    }

    const paymentStatus = req.body.payment_status;
    if (paymentStatus !== 'Completed') {
      return res.status(200).send('ignored');
    }

    const expectedReceiver = (process.env.PAYPAL_RECEIVER_EMAIL || '').toLowerCase();
    const actualReceiver = String(req.body.receiver_email || '').toLowerCase();
    if (expectedReceiver && expectedReceiver !== actualReceiver) {
      return res.status(400).send('receiver mismatch');
    }

    const txId = String(req.body.txn_id || '');
    const amount = Number(req.body.mc_gross || 0);
    const currency = String(req.body.mc_currency || 'USD');
    const firstName = String(req.body.first_name || '').trim();
    const lastName = String(req.body.last_name || '').trim();
    const payerName = `${firstName} ${lastName}`.trim() || 'Anonymous';
    const note = String(req.body.memo || '').trim();
    const paidAt = req.body.payment_date ? new Date(req.body.payment_date).toISOString() : new Date().toISOString();

    insertDonation.run({
      tx_id: txId,
      name: payerName,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      note,
      donated_at: paidAt
    });

    return res.status(200).send('ok');
  } catch (err) {
    console.error('IPN error:', err);
    return res.status(500).send('error');
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Donation API listening on http://localhost:${port}`);
});
