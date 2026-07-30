import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Firebase is the app's persistence layer: auth/session metadata and all training records live here.
const firebaseConfig = {
  apiKey: "AIzaSyAfQrudh-T1liBQJnxZz18ike0uPu2mB60",
  authDomain: "scdf-and-dell.firebaseapp.com",
  projectId: "scdf-and-dell",
  storageBucket: "scdf-and-dell.firebasestorage.app",
  messagingSenderId: "1073307835067",
  appId: "1:1073307835067:web:ea74fd60f98d3c6b19679e",
  measurementId: "G-L86B7EDEFX",
};

const app = initializeApp(firebaseConfig);

// Firestore is the shared source of truth for user profiles, IPPT history, and AI outputs.
export const db = getFirestore(app);

// Analytics stays attached to the same Firebase app instance.
const analytics = getAnalytics(app);