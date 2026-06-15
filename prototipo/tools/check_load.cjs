const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
(async () => {
  const b = await chromium.launch({ channel: "chrome", args: ["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"] });
  const p = await b.newPage();
  const logs = [];
  p.on("console", m => { const t=m.text(); if(/cidade|jerico|Error|error/i.test(t)) logs.push("LOG "+t.slice(0,120)); });
  p.on("pageerror", e => logs.push("ERR "+e.message.slice(0,160)));
  await p.goto("http://localhost:5190/jerico-test.html?renderer=webgl", { waitUntil: "load", timeout: 90000 });
  await p.waitForFunction(() => window.__scene && window.__scene.meshes.length > 60, { timeout: 90000 }).catch(()=>{});
  await p.waitForTimeout(6000);
  await p.waitForFunction(() => window.__scene && window.__scene.meshes.length > 60, { timeout: 60000 }).catch(()=>{}); const n = await p.evaluate(() => window.__scene ? window.__scene.meshes.length : -1);
  console.log("MESHES="+n);
  logs.forEach(l => console.log(l));
  await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
