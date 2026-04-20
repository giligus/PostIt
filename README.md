# PostIt

This GitHub Pages app now supports a real user database flow for static hosting:

- Firebase Authentication stores the email/password accounts.
- Cloud Firestore stores a profile document for each user in `users/{uid}`.
- If Firebase is not configured yet, the app stays available in demo mode so the site does not break.

## What Changed

- `index.html` now supports:
  - real sign in
  - real account creation
  - sign out
  - Firestore-backed user profile sync
  - company name persistence per user
- `firebase-config.js` is the only file you need to edit to connect your Firebase project.

## Firebase Setup

1. Create a Firebase project and add a Web app.
2. In Firebase Authentication, enable `Email/Password`.
3. In Firestore, create a database.
4. Replace the placeholder in `firebase-config.js` with your Firebase web config object.
5. Commit and push the updated files so GitHub Pages serves the config file too.

## Backend Setup

Real platform integrations now live in the `backend/` service.

1. Go into `backend/`.
2. Copy `.env.example` to `.env`.
3. Fill in your Firebase Admin credentials plus each platform's client/app keys.
4. Run `npm install`.
5. Run `npm run dev`.
6. Set the backend URL in `app-config.js`.

The frontend remains a static GitHub Pages app, but OAuth callbacks, provider secrets, and platform tokens now belong to the backend.

## Recommended Firestore Rule

Use a rule like this so each signed-in user can read and write only their own profile:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Notes

- The Firebase web config is safe to ship in a client app; it is not a secret by itself.
- The frontend can now connect real platform accounts through the backend integrations panel.
- Live posting is started for X, LinkedIn, and Meta-backed Facebook Page publishing. TikTok and YouTube still need dedicated upload pipelines.
- Official setup references:
  - https://firebase.google.com/docs/web/setup
  - https://firebase.google.com/docs/auth/web/start
  - https://firebase.google.com/docs/firestore/quickstart
