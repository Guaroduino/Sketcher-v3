import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// IMPORTANT: Replace with your own Firebase project configuration or provide via Vite env vars.
// You can find these values in Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyBK5eiKiX7GFTVMy_LrTYDKYVEfoV8vImY",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "sketcher-companion.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "sketcher-companion",
  // NOTE: Firebase Storage bucket names normally end with appspot.com
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "sketcher-companion.appspot.com",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "629894472307",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:629894472307:web:7be8c8a190d1e9a25e4006"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the initialized services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
