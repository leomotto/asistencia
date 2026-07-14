const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const JS_DIR = path.join(ROOT_DIR, 'js');

function run() {
  const indexContent = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  
  // Encontrar la versión actual (ej: ?v=9.84)
  const match = indexContent.match(/\?v=([0-9]+\.[0-9]+)/);
  if (!match) {
    console.error("❌ No se encontró el parámetro ?v= en index.html");
    process.exit(1);
  }

  const currentVersionStr = match[1];
  const nextVersionNum = parseFloat(currentVersionStr) + 0.01;
  const nextVersionStr = nextVersionNum.toFixed(2);

  console.log(`📌 Actualizando versión de v${currentVersionStr} a v${nextVersionStr}...`);

  // Regex global para la versión anterior
  const regexAnterior = new RegExp(`\\?v=${currentVersionStr.replace('.', '\\.')}`, 'g');
  const reemplazo = `?v=${nextVersionStr}`;

  // Actualizar index.html
  fs.writeFileSync(INDEX_HTML_PATH, indexContent.replace(regexAnterior, reemplazo));

  // Actualizar todos los js
  const files = fs.readdirSync(JS_DIR);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(JS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (regexAnterior.test(content)) {
        fs.writeFileSync(filePath, content.replace(regexAnterior, reemplazo));
      }
    }
  }

  console.log(`✅ ¡Versión actualizada a v${nextVersionStr} en todos los archivos!`);
}

run();
