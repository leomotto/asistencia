import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

const configPath = "/home/leo/proyectos/asistencia/js/firebase-config.js";
const configContent = fs.readFileSync(configPath, "utf-8");
const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);

if (!configMatch) {
  console.error("Could not parse config");
  process.exit(1);
}

// Convert unquoted keys to quoted keys for JSON.parse
let configStr = configMatch[1]
  .replace(/apiKey:/g, '"apiKey":')
  .replace(/authDomain:/g, '"authDomain":')
  .replace(/projectId:/g, '"projectId":')
  .replace(/storageBucket:/g, '"storageBucket":')
  .replace(/messagingSenderId:/g, '"messagingSenderId":')
  .replace(/appId:/g, '"appId":');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const est = await getDocs(query(collection(db, "2026_estudiantes"), where("curso", "==", "4to A")));
  console.log(`4to A students: ${est.size}`);
  
  const asist = await getDocs(collection(db, "2026_asistencias"));
  let asistCount = 0;
  asist.forEach(d => {
    if (d.data().curso && d.data().curso.startsWith("4to A")) asistCount++;
  });
  console.log(`4to A asistencias: ${asistCount}`);
  
  const mats = await getDocs(collection(db, "2026_materias"));
  let matCount = 0;
  mats.forEach(d => {
    if (d.data().division === "4to A" || d.data().nombre.startsWith("4to A")) matCount++;
  });
  console.log(`4to A materias: ${matCount}`);
  process.exit(0);
}
check();
