import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "sistemaasistencia-a6c5b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const collections = ["materias", "usuarios", "estudiantes", "instituciones", "asistencias", "evaluaciones", "evaluaciones_locks"];
  
  for (const col of collections) {
    console.log(`\nChecking root collection '${col}':`);
    const snap = await getDocs(collection(db, col));
    snap.forEach(d => console.log(` - ${d.id}:`, Object.keys(d.data())));
  }

  for (const col of collections) {
    const path = `artifacts/mi-app-asistencia/public/data/${col}`;
    console.log(`\nChecking artifact collection '${path}':`);
    const snap = await getDocs(collection(db, path));
    snap.forEach(d => console.log(` - ${d.id}:`, Object.keys(d.data())));
  }
}

run().catch(console.error);
