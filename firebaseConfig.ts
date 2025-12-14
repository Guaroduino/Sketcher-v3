import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// IMPORTANT: Replace the placeholder values below with your app's Firebase project configuration.
// You can find this configuration in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyBK5eiKiX7GFTVMy_LrTYDKYVEfoV8vImY",
  authDomain: "sketcher-companion.firebaseapp.com",
  projectId: "sketcher-companion",
  storageBucket: "sketcher-companion.firebasestorage.app",
  messagingSenderId: "629894472307",
  appId: "1:629894472307:web:7be8c8a190d1e9a25e4006"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the initialized services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
