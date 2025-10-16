import { initializeApp } from 'firebase/app';
import { getDatabase, serverTimestamp } from 'firebase/database';

// The hardcoded config is now the only config used.
// FIX: Export firebaseConfig so it can be imported and used elsewhere in the application.
export const firebaseConfig = {
  apiKey: "AIzaSyDnkwQk4Y11adyGkiCog4H8xi_ZjCgHUaE",
  authDomain: "clubpkr-87519.firebaseapp.com",
  databaseURL: "https://clubpkr-87519-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "clubpkr-87519",
  storageBucket: "clubpkr-87519.firebasestorage.app",
  messagingSenderId: "323435934947",
  appId: "1:323435934947:web:97568617db4f891ce281d6",
  measurementId: "G-CJ0RSGJ1Q2"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export { serverTimestamp };
