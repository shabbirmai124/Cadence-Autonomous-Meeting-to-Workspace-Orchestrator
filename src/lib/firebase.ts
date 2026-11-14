import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

const configModules = import.meta.glob<{ default: FirebaseClientConfig }>(
  '../../firebase-applet-config.json',
  { eager: true }
);
const localConfig: FirebaseClientConfig =
  Object.values(configModules)[0]?.default ?? {};

const firebaseConfig: FirebaseClientConfig = {
  apiKey: localConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: localConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: localConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: localConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    localConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: localConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: localConfig.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId:
    localConfig.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.compose',
] as const;

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  dbInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  authInstance = getAuth(app);
}

export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;

// Validate connection to Firestore on initial boot
async function testConnection() {
  if (!dbInstance) return;
  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
// In-memory cache only (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onUserState: (user: User | null, accessToken: string | null) => void
) => {
  if (!authInstance) {
    onUserState(null, null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, (user: User | null) => {
    if (user) {
      if (!isSigningIn) {
        onUserState(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      onUserState(null, null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  if (!authInstance) {
    throw new Error(
      'Firebase is not configured. Copy firebase-applet-config.example.json to firebase-applet-config.json or set VITE_FIREBASE_* environment variables.'
    );
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(authInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Workspace access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  cachedAccessToken = null;
  if (authInstance) {
    await authInstance.signOut();
  }
};

