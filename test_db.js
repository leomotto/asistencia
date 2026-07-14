import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
const auth = getAuth(app);

async function test() {
  try {
    await signInAnonymously(auth);
    const qSnapshot = await getDocs(collection(db, "escuelas"));
    console.log("Escuelas root encontradas:", qSnapshot.size);
    qSnapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
test();
