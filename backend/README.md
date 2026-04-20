# PostIt Backend

This service is the real backend for the GitHub Pages frontend.

It is responsible for:

- verifying Firebase users from the frontend
- storing provider tokens server-side
- handling OAuth callbacks
- publishing content to supported platforms

## Current Platform Status

- `x`: OAuth + text posting
- `linkedin`: OAuth + text posting
- `facebook`: OAuth + Page posting
- `instagram`: OAuth via Meta + image publishing by public media URL
- `tiktok`: OAuth/token storage scaffolded, posting pipeline still needs media upload flow
- `youtube`: OAuth/token storage scaffolded, upload pipeline still needs resumable video upload flow

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in Firebase Admin credentials.
3. Fill in each provider's client/app credentials.
4. Run `npm install`.
5. Run `npm run dev`.

## Redirect URIs

Each provider must point its OAuth callback to this backend:

- `X`: `${APP_BASE_URL}/api/oauth/x/callback`
- `LinkedIn`: `${APP_BASE_URL}/api/oauth/linkedin/callback`
- `Meta`: `${APP_BASE_URL}/api/oauth/meta/callback`
- `TikTok`: `${APP_BASE_URL}/api/oauth/tiktok/callback`
- `YouTube`: `${APP_BASE_URL}/api/oauth/youtube/callback`

## Important Notes

- The frontend must send a Firebase ID token to the backend before starting a connect flow.
- Instagram publishing currently expects a publicly reachable image URL.
- TikTok and YouTube publishing need a dedicated media upload pipeline next.
