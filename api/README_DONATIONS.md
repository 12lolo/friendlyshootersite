Live Donations With PayPal IPN

Overview
- This setup adds a live donor feed endpoint at /api/donations and a PayPal webhook listener at /api/paypal/ipn.
- The frontend page donate.html polls /api/donations every 20 seconds.

Files
- donations-express.js: Express server with SQLite storage and PayPal IPN validation.
- data/donations.db: local SQLite database created automatically.

Quick Start
1. In the api folder, install dependencies:
   npm install
2. Start the donation API:
   npm run start:donations
3. Open donate.html in your site and verify it loads.

Required Environment Variables
- PAYPAL_RECEIVER_EMAIL: your PayPal account email that receives funds.
- PAYPAL_IPN_SANDBOX: set to true only when testing against PayPal sandbox.
- PORT: optional, defaults to 8788.

PowerShell example
$env:PAYPAL_RECEIVER_EMAIL="your-paypal-email@example.com"
$env:PAYPAL_IPN_SANDBOX="false"
npm run start:donations

PayPal IPN Setup
1. In PayPal account settings, enable Instant Payment Notification (IPN).
2. Set the IPN notification URL to:
   https://your-domain/api/paypal/ipn
3. Save and send a test payment.

Notes
- PayPal.Me does not expose a public client-side feed of donations.
- Live updates require a backend listener like this one.
- Duplicate transactions are ignored by txn_id uniqueness.
