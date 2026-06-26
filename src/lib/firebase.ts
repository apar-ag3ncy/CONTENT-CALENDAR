import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

/** True once the Firebase web config is present (set in .env.local). */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId)

if (!isFirebaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[content-calendar] Firebase is not configured. Add your VITE_FIREBASE_* ' +
      'keys to .env.local (see the README).',
  )
}

let app: FirebaseApp | undefined
let firestore: Firestore | undefined
let firebaseStorage: FirebaseStorage | undefined

if (isFirebaseConfigured) {
  app = initializeApp(config)
  firestore = getFirestore(app)
  firebaseStorage = getStorage(app)
}

// These are only used behind `isFirebaseConfigured` gates (queries are disabled
// and write/upload UI is disabled when not configured), so the cast is safe.
export const db = firestore as Firestore
export const storage = firebaseStorage as FirebaseStorage
