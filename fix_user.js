import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyAx8JRsalcFz1jLtwYAmZPBa953OhRaLdY",
  authDomain:        "sistemaasistencia-a6c5b.firebaseapp.com",
  projectId:         "sistemaasistencia-a6c5b",
  storageBucket:     "sistemaasistencia-a6c5b.firebasestorage.app",
  messagingSenderId: "978466599405",
  appId:             "1:978466599405:web:a1596739cc85ab0049f7e4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// UID de leomotto@gmail.com (asumimos que lo podemos encontrar o crearlo). 
// No tenemos admin SDK, así que le pediremos al usuario que entre a la consola o intentaremos algo
