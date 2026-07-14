import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAx8JRsalcFz1jLtwYAmZPBa953OhRaLdY",
  authDomain: "sistemaasistencia-a6c5b.firebaseapp.com",
  projectId: "sistemaasistencia-a6c5b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    await setDoc(doc(db, "escuelas", "EEM1DE20"), {
      nombre: "EEM 1 DE 20 - Biblioteca del Congreso de la Nación",
      materias: []
    });
    console.log("School created successfully!");
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
