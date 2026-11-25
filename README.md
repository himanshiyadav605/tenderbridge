# TenderBridge

### Tender discovery and preliminary MSME matching

TenderBridge is an academic web application for browsing tender records and comparing supported eligibility criteria with a saved MSME company profile. It is not a live procurement aggregator or an official government service.

## Implemented features

- Browse a catalogue of tender records and view their details.
- Register, log in, and log out using application-managed accounts.
- Create, view, and update a persistent MSME company profile.
- View an account dashboard and profile completion information.
- See preliminary matching results and criterion explanations where a tender has supported structured criteria.

The application currently does not provide tender search or filters, saved tenders, an administrative tender-management interface, or live procurement-portal synchronization.

## Routes

| Route | Purpose |
|---|---|
| `/` | Home |
| `/about` | About TenderBridge |
| `/login` | Sign in |
| `/register` | Create an account |
| `/account` | Account dashboard (protected) |
| `/account/profile` | Create or update an MSME profile (protected) |
| `/tenders` | Tender catalogue |
| `/tenders/[id]` | Tender details and supported matching results |

## Technology

| Area | Implementation |
|---|---|
| Web framework | Next.js App Router |
| UI | React and Tailwind CSS |
| Server endpoints | Next.js Route Handlers |
| Database access | MongoDB through Mongoose |
| Password hashing | Node.js `crypto.scrypt` with a random salt |
| Sessions | Custom HMAC-SHA256-signed `tb_session` cookie |
| Input validation | Application validation helpers and Mongoose schema constraints |

Authentication is implemented in the application; it does not use Auth.js. Session tokens are signed using `SESSION_SECRET`, expire after 24 hours, and are stored in an HttpOnly, SameSite=Lax cookie. The cookie is Secure in production.

Registration and login input checks are implemented in `lib/user-input.js`. MSME profile payload validation and sanitization are implemented in `lib/profile-input.js`; database models in `models/` also define schema constraints. The project does not use Zod.

## Tender data and matching

The tender catalogue is a local dataset in `data/tenders.js`; it is not synchronized with procurement portals.

- `tnd-001` through `tnd-006` are fictional sample records for academic demonstration. They are labeled as demo data and do not represent real procurement notices.
- `tnd-007` is structured from a DRDO tender notice published through CPPP. Its eligibility summary is synthesized from the notice, and the original notice remains authoritative. This record is not a live feed; its current data entry does not provide a source URL or downloadable notice document.

The matching engine evaluates supported structured criteria. The current detailed evaluation covers five mandatory criteria for `tnd-007`; records without recognized structured criteria may show that criteria are unavailable. A public preview may use a demonstration profile, not a visitor's verified company information.

### Live GeM tender ingestion

TenderBridge can periodically import GeM bid discovery records from the `themineworks/india-tenders-scraper` Apify Actor. Only the `gem` source is enabled; central CPPP and state sources are disabled.

Configure these environment variables:

```dotenv
MONGODB_URI=<MongoDB Atlas connection URI>
SESSION_SECRET=<long random session secret>
APIFY_API_TOKEN=<Apify API token>
CRON_SECRET=<long random cron authorization secret>
```

`APIFY_API_TOKEN` and `CRON_SECRET` must be kept server-side and must not be added to browser code or `NEXT_PUBLIC_*` variables. `.env.local` is for local development and must not be committed.

A Vercel Cron request invokes `/api/cron/gem` once daily at 02:00 UTC. The route requires:

```text
Authorization: Bearer <CRON_SECRET>
```

For local manual testing, start the application and send:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/gem
```

Do not run the cron route against a production database during local testing. The ingestion is capped at 100 GeM records per run. Historical records are preserved; missing disappeared tenders are not inferred to be cancelled or withdrawn. Live GeM records are discovery data and do not receive automatic eligibility status.

Every result is preliminary and advisory. An `Eligible` result does not establish official eligibility, guarantee acceptance, or guarantee a contract award. Confirm requirements against the original procurement notice and the procuring authority.

## Local setup

You need Node.js and npm, plus a MongoDB database that the application can reach.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/himanshiyadav605/tenderbridge.git
   cd tenderbridge
   npm install
   ```

2. Create `.env.local` in the repository root and set:

   ```dotenv
   MONGODB_URI=<your MongoDB connection URI>
   SESSION_SECRET=<a long, randomly generated secret>
   ```

   Replace both placeholders with values for your environment. `MONGODB_URI` identifies the database used by authentication and profile features. `SESSION_SECRET` is required to sign session cookies. Do not commit `.env.local` or share its values; environment files are ignored by Git.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Available package scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm start` | Start the production server after building |

The repository does not define an `npm test` script. Integration scripts in `scratch/` create and delete database records; use them only with a disposable database, and ensure the test process and the server use that same isolated database.

## Project context

TenderBridge is an academic project for INT257: Modern Web Application Development.

## Disclaimer

TenderBridge is not an official government procurement portal. Matching results are automated preliminary assessments, do not guarantee legal tender eligibility or acceptance, and do not guarantee contract awards.