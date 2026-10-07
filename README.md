# Zneaker

Zneaker is a React/Vite storefront with an Express API and MongoDB/Mongoose data layer. The root Vercel project deploys the client and API together: the client is built to `client/dist`, and `/api/*` is served by a Vercel Function.

## Deploy to Vercel

1. Push this repository to GitHub and import it into Vercel. Keep the project root set to the repository root. `vercel.json` supplies the build and output settings.
2. Create a MongoDB Atlas cluster and database user. Add the Vercel deployment's network access to Atlas (for Vercel's changing serverless IPs, Atlas commonly requires allowing `0.0.0.0/0` and relying on a strong database password).
3. Create a Vercel Blob store and connect it to the Vercel project.
4. Add these environment variables in Vercel for Production and Preview:

   - `MONGO_URI`: Atlas connection string for the `zneaker` database. URL-encode special characters in the database username/password.
   - `JWT_SECRET`: long, random secret used to sign login tokens.
   - `OPN_SECRET_KEY`: Opn/Omise secret key. Keep it server-side; use a test key while testing and a live key only after merchant approval.
   - `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `ADMIN_ORDER_EMAIL`: optional Resend settings for order emails. Verify the sender domain with Resend before sending.
   - `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token (added automatically when the store is connected).
   - `CLIENT_ORIGIN`: optional exact origin if the API is hosted separately. For this single-project deployment, leave it unset.

5. Redeploy after adding or changing environment variables. The API health endpoint is `/api/health`.

## PromptPay point top-ups

Point top-ups use Opn/Omise PromptPay charges. The existing club conversion is 50 THB per point; each charge accepts 1–3,000 points (50–150,000 THB). Points are credited only after the server verifies the successful charge with Opn and processes its webhook.

1. Create an Opn/Omise merchant account and request PromptPay activation; the payment method requires provider approval.
2. Add `OPN_SECRET_KEY` to Vercel for Production (and Preview when testing). Never expose the secret key in the client bundle.
3. Register `https://<your-production-domain>/api/payments/opn/webhook` as the Opn webhook endpoint, with `charge.complete` and `charge.expire` events enabled. Configure the test-mode webhook separately when testing with a test key.
4. Test with the provider's test secret key first. In test mode, complete or fail the charge from the Opn dashboard and confirm the points change only after the successful webhook is verified.

## Storefront and checkout

The catalog API supports text search, category/gender and price filters, sorting, and pagination. Product records include tags and optional size/color stock variants. The 12 sample sneaker models have individual product images. To safely add the catalog to the database configured in `server/.env`, run `npm --prefix server run seed:products`. This inserts missing products and only fills an image when an existing same-name product has none; it does not touch users, orders, or stock. If Node reports `querySrv ECONNREFUSED` on Windows, retry with a DNS resolver that supports SRV records:

```powershell
$env:MONGODB_DNS_SERVERS = "8.8.8.8,1.1.1.1"
npm --prefix server run seed:products
Remove-Item Env:MONGODB_DNS_SERVERS
```

`npm --prefix server run seed` is different: it **deletes and recreates all users, products, reviews, and orders**, so only use it on a disposable database.

Members can edit their profile, maintain delivery addresses, and review past orders. The cart persists in browser storage. Checkout supports cash on delivery and Opn PromptPay; the API recalculates item prices, checks variant stock, and reserves inventory inside a MongoDB transaction. Shipping is ฿60 under ฿2,000 and free at or above ฿2,000. Paid PromptPay orders are confirmed only after the provider charge is verified. Admin accounts can add catalog items from the account panel; product write APIs and order status changes require an admin token.

To enable order emails, configure the three Resend variables above. Order receipt and payment confirmation emails are sent to the member and, if configured, the admin inbox. Without those variables, checkout continues and order history remains available in the account panel.

## Image uploads

`uploadImage(file, token)` is exported from `client/src/services/productApi.js`. Pass it a browser `File` and the logged-in admin JWT. The browser uploads file bytes directly to Vercel Blob; the Express token route validates the admin JWT and permits JPEG, PNG, WebP, and AVIF images up to 5 MiB. Use the returned `url` as the product's `image` or an entry in `images` when saving the product through the API. The Vercel Blob store must be connected for uploads to work.

```js
import { uploadImage } from "./services/productApi";

const blob = await uploadImage(file, adminToken);
await createProduct({ name, price, image: blob.url });
```

## Local development

Install dependencies in the root, `client`, and `server` directories (`npm install` in each). Copy `server/.env.example` to `server/.env` and set a local or Atlas `MONGO_URI` plus a `JWT_SECRET`. Run the API with `npm --prefix server run dev` and the UI with `npm --prefix client run dev`. Vite proxies `/api` to `localhost:5000`.

For local Blob uploads, set a development Blob token in `server/.env` and use Vercel's local development tools or a public tunnel for Blob callbacks. The direct upload itself uses Vercel Blob's client upload SDK.
