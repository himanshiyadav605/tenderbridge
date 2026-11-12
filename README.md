# TenderBridge

### Government Tender Matchmaking Platform for MSMEs

TenderBridge is a web-based platform designed to help Micro, Small and Medium Enterprises (MSMEs) discover relevant government tender opportunities and evaluate their eligibility based on their business profiles.

## Problem Statement

MSMEs often struggle to identify suitable government tenders and understand whether they satisfy the eligibility requirements. Tender information is distributed across different procurement sources, making opportunity discovery time-consuming.

TenderBridge aims to simplify this process through centralized tender discovery and business-based matching.

## Objectives

- Provide a centralized tender discovery interface.
- Allow MSMEs to create and manage company profiles.
- Match tenders against company qualifications.
- Display eligibility information and matching reasons.
- Allow users to save relevant tenders.
- Provide administrative tender data management.

## Planned Features

- User registration and login.
- MSME company profiles.
- Tender catalogue with search and filters.
- Tender details and eligibility requirements.
- Tender matching and recommendations.
- Saved tenders.
- Admin dashboard.
- Tender dataset import and synchronization history.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router |
| Language | JavaScript |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | Auth.js / Credentials |
| Validation | Zod |
| Deployment | Vercel |
| Version Control | GitHub |

## Project Pages

- Home
- Browse Tenders
- Tender Details
- About
- Login
- Register
- MSME Dashboard
- Company Profile
- Recommended Tenders
- Saved Tenders
- Admin Dashboard

## Tender Data Approach

The initial academic MVP will use a prepared dataset containing sample tender records and verified public tender information where available.

Sample records will be clearly identified as demo data. Live integration with government procurement portals is a planned future enhancement, subject to permitted data access.

## Team

This project is developed collaboratively by a three-member student team as part of INT257 – Modern Web Application Development.

## Running Locally

Clone the repository:

```bash
git clone https://github.com/himanshiyadav605/tenderbridge.git
cd tenderbridge
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Project Status

Initial Next.js application setup completed. Feature development is in progress.

## Disclaimer

TenderBridge is an academic project. It is not an official government procurement portal and does not guarantee tender eligibility or contract awards.