const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');
content = content.replace(
  "request.auth.token.email == 'leomotto@gmail.com'",
  "request.auth.token.email in ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar']"
);
content = content.replace(
  "request.auth.token.email == 'leomotto@gmail.com'",
  "request.auth.token.email in ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar']"
);
content = content.replace(
  "request.auth.token.email == 'leomotto@gmail.com'",
  "request.auth.token.email in ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar']"
);
content = content.replace(
  "request.auth.token.email == 'leomotto@gmail.com'",
  "request.auth.token.email in ['leomotto@gmail.com', 'leopoldo.motto@bue.edu.ar']"
);
fs.writeFileSync('firestore.rules', content);
