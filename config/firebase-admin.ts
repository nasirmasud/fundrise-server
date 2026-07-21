import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app: App;

function getFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  // Use FIREBASE_SERVICE_ACCOUNT_KEY (base64-encoded JSON) or GOOGLE_APPLICATION_CREDENTIALS
  const encodedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (encodedKey) {
    const serviceAccount = JSON.parse(Buffer.from(encodedKey, "base64").toString("utf-8"));
    app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Fallback: use application default credentials
    app = initializeApp();
  }

  return app;
}

export function getFirebaseAuth() {
  const adminApp = getFirebaseAdmin();
  return getAuth(adminApp);
}
