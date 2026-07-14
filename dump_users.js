import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAx8JRsalcFz1jLtwYAmZPBa953OhRaLdY",
  authDomain: "sistemaasistencia-a6c5b.firebaseapp.com",
  projectId: "sistemaasistencia-a6c5b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "usuarios"));
  snap.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
