const fs = require('fs');

const appContent = fs.readFileSync('js/app.js', 'utf8');
const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']\.\/([^"']+)["']/g;

let match;
while ((match = importRegex.exec(appContent)) !== null) {
  const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
  const file = match[2].split('?')[0]; // remove ?v=9.34
  
  const fileContent = fs.readFileSync('js/' + file, 'utf8');
  
  imports.forEach(imp => {
    // Check if the file exports this name
    const exportRegex1 = new RegExp(`export\\s+(async\\s+)?function\\s+${imp}\\s*\\(`, 'g');
    const exportRegex2 = new RegExp(`export\\s+(const|let|var)\\s+${imp}\\s*=`, 'g');
    const exportRegex3 = new RegExp(`export\\s+\\{[^}]*\\b${imp}\\b[^}]*\\}`, 'g');
    
    if (!exportRegex1.test(fileContent) && !exportRegex2.test(fileContent) && !exportRegex3.test(fileContent)) {
      console.log(`ERROR: ${imp} is NOT exported from js/${file}`);
    }
  });
}
console.log("Check complete.");
