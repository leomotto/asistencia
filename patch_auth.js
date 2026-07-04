const fs = require('fs');

let file = fs.readFileSync('js/firebase-config.js', 'utf8');

if (!file.includes('getRedirectResult')) {
  file = file.replace(
    'import { getAuth, signInWithCustomToken, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut }',
    'import { getAuth, signInWithCustomToken, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, getRedirectResult }'
  );
  
  file = file.replace(
    'export const initAuth = async () => {',
    'export const initAuth = async () => {\n  try { await getRedirectResult(auth); } catch(e) { console.error("Redirect error", e); }'
  );
  
  fs.writeFileSync('js/firebase-config.js', file);
  console.log("Patched firebase-config.js");
}
