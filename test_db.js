import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function test() {
  try {
    const qSnapshot = await getDocs(collection(db, "artifacts/mi-app-asistencia/public/data/escuelas"));
    console.log("Escuelas encontradas:", qSnapshot.size);
    qSnapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
