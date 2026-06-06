/**
 * services/firebase.js
 *
 * Firebase Authentication service layer.
 *
 * Exports:
 *   initFirebase()          — call once at app startup
 *   loginUser(email, pw)    — sign in, returns user
 *   logoutUser()            — sign out
 *   onAuthChange(callback)  — subscribe to auth state
 *   getCurrentUser()        — synchronous current user (or null)
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { firebaseConfig } from '../firebase/config.js';

/** @type {import('firebase/app').FirebaseApp} */
let app;

/** @type {import('firebase/auth').Auth} */
let auth;

/**
 * Initialize Firebase.
 * Safe to call multiple times — skips init if already done.
 */
export function initFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);

  // Persist auth session across app restarts (stored in IndexedDB via Tauri's webview)
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] Could not set persistence:', err.message);
  });

  return auth;
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function loginUser(email, password) {
  if (!auth) throw new Error('Firebase not initialized. Call initFirebase() first.');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Sign out the current user.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  if (!auth) throw new Error('Firebase not initialized.');
  await signOut(auth);
}

/**
 * Subscribe to authentication state changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onAuthChange(callback) {
  if (!auth) throw new Error('Firebase not initialized.');
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the currently signed-in user synchronously.
 * Returns null if not authenticated.
 * @returns {import('firebase/auth').User | null}
 */
export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}
