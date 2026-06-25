import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAx8JRsalcFz1jLtwYAmZPBa953OhRaLdY",
  authDomain:        "sistemaasistencia-a6c5b.firebaseapp.com",
  projectId:         "sistemaasistencia-a6c5b",
  storageBucket:     "sistemaasistencia-a6c5b.firebasestorage.app",
  messagingSenderId: "978466599405",
  appId:             "1:978466599405:web:a1596739cc85ab0049f7e4"
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db   = getFirestore(firebaseApp);

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'mi-app-asistencia';

export function getPath(coleccion) {
  return typeof __app_id !== 'undefined'
    ? `artifacts/${appId}/public/data/${coleccion}`
    : coleccion;
}

const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  await signInWithPopup(auth, provider);
};

export const loginAnonymously = async () => {
  await signInAnonymously(auth);
};

export const logout = async () => {
  try { await signOut(auth); } catch(e) { console.error(e); }
};

export const initAuth = async () => {
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    }
  } catch(e) { console.error("Auth init error:", e); }
};
