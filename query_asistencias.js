const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "preceptor-digital-3e5f0"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const asisRef = collection(db, 'db_produccion/datos/asistencias');
  const asisSnap = await getDocs(asisRef);
  let noDivision = [];
  let counts = {};
  
  asisSnap.forEach(doc => {
    const data = doc.data();
    if (!data.curso) return;
    counts[data.curso] = (counts[data.curso] || 0) + 1;
    if (!data.curso.includes(' - ')) {
      noDivision.push({
        id: doc.id,
        curso: data.curso,
        fecha: data.fecha,
        registros: Object.keys(data.registros || {}).length
      });
    }
  });

  console.log("Planillas sin división (' - ' no encontrado):");
  noDivision.forEach(a => {
    console.log(`- Curso: ${a.curso} | Fecha: ${a.fecha} | Alumnos registrados: ${a.registros}`);
  });
  
  console.log("\nTodos los cursos registrados en asistencias:");
  for (let c in counts) {
    if (c.includes('4to') || c.includes('4TO') || !c.includes('-')) {
        console.log(`- ${c}: ${counts[c]} planillas`);
    }
  }
}
run();
