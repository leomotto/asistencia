const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('https://asistencia.muchacholoco.com.ar/', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // click login button
  const loginBtn = await page.$('button[onclick="app.iniciarSesionGoogle()"]');
  if (loginBtn) {
    console.log("Clicking login...");
    await loginBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log("Login button not found!");
  }
  
  await browser.close();
})();
