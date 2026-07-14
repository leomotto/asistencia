const fs = require('fs');

const path = './js/escuelas.js';
let content = fs.readFileSync(path, 'utf8');

const migrationCode = `
window.app.migrateDataToSchool = async function(schoolId) {
  if (window.app.currentUser?.rolActivo !== 'SUPERADMIN') return;
  const { collection, getDocs, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  const { db } = await import("./firebase-config.js?v=10.01");
  
  const collections = ['materias', 'estudiantes', 'asistencias', 'evaluaciones', 'evaluaciones_locks', 'horarios'];
  
  console.log("Iniciando migración a " + schoolId);
  for (const col of collections) {
    console.log("Migrando " + col + "...");
    const snap = await getDocs(collection(db, col));
    let count = 0;
    for (const d of snap.docs) {
      await setDoc(doc(db, "instituciones", schoolId, col, d.id), d.data());
      count++;
    }
    console.log("-> " + count + " documentos migrados en " + col);
  }
  
  console.log("Migrando docentes (usuarios)...");
  const snapUsers = await getDocs(collection(db, 'usuarios'));
  let userCount = 0;
  for (const u of snapUsers.docs) {
    const data = u.data();
    if (data.rol === 'DOCENTE' || data.rol === 'ADMIN') {
      const userData = { ...data };
      if (!userData.escuelas) userData.escuelas = {};
      userData.escuelas[schoolId] = {
        rol: data.rol,
        materias: data.materias || []
      };
      await setDoc(doc(db, 'usuarios', u.id), userData, { merge: true });
      userCount++;
    }
  }
  console.log("-> " + userCount + " usuarios actualizados con acceso a " + schoolId);
  console.log("Migración completada.");
  alert("Migración completada. Revisa la consola para más detalles.");
};
`;

if (!content.includes('migrateDataToSchool')) {
    content = content + "\n\n" + migrationCode;
    fs.writeFileSync(path, content);
    console.log("Migration code added to escuelas.js");
} else {
    console.log("Migration code already present.");
}
