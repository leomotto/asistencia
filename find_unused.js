const fs = require('fs');

const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js'));
const allContent = jsFiles.map(f => fs.readFileSync('js/' + f, 'utf8')).join('\n');
const appContent = fs.readFileSync('js/app.js', 'utf8');

const exportRegex = /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)/g;

jsFiles.forEach(file => {
  const content = fs.readFileSync('js/' + file, 'utf8');
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    const funcName = match[2];
    if (funcName === 'initAuth' || funcName === 'initSidebar') continue; // Imported safely
    
    // Check if it's imported in app.js
    const isImported = appContent.includes(funcName);
    
    // Check if it's called anywhere in HTML
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    const isCalledInHtml = htmlContent.includes(funcName);
    
    if (!isImported && !isCalledInHtml) {
      console.log(`WARNING: ${funcName} in ${file} might be unused!`);
    }
  }
});
console.log("Unused scan complete.");
