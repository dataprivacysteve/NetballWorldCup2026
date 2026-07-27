import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const root = resolve(process.cwd());
const outDir = join(root, "manuals", "assets");
const profileDir = join(root, ".manual-chrome-profile");
const port = 9337;

await mkdir(outDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });

const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--ignore-certificate-errors",
    "--window-size=1600,1000",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

let target;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    target = targets.find((item) => item.type === "page");
    if (target) break;
  } catch {}
  await sleep(200);
}
if (!target) throw new Error("Chrome DevTools target did not start");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolvePromise, reject) => {
  socket.addEventListener("open", resolvePromise, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  if (message.error) item.reject(new Error(message.error.message));
  else item.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(url, wait = 2600) {
  await command("Page.navigate", { url });
  await sleep(wait);
}

async function login(email, password) {
  await navigate("https://platform.netballamericas.test/", 1000);
  const response = await evaluate(`fetch("https://api.netballamericas.test/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(${JSON.stringify({ email, password })})
  }).then(async r => ({ ok: r.ok, status: r.status, body: await r.text() }))`);
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status} ${response.body}`);
}

async function screenshot(name, url, wait = 2600) {
  await navigate(url, wait);
  await evaluate("window.scrollTo(0, 0)");
  const { data } = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(join(outDir, name), Buffer.from(data, "base64"));
  console.log(`${name} <- ${url}`);
}

try {
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await command("Network.clearBrowserCookies");
  await login("control@sportsbb.org", "sportsbb-control-1234");
  await screenshot("sportsbb-control-plane.png", "https://platform.netballamericas.test/control");
  await screenshot("sportsbb-public-experience.png", "https://platform.netballamericas.test/control/public");

  await command("Network.clearBrowserCookies");
  await login("admin@netballamericas.org", "oc-admin-1234");
  await screenshot("loc-operations-dashboard.png", "https://platform.netballamericas.test/");
  await screenshot("loc-venue-resilience.png", "https://platform.netballamericas.test/venue");
  await screenshot("loc-broadcast-console.png", "https://platform.netballamericas.test/broadcast");
  await screenshot("loc-gate-scanner.png", "https://platform.netballamericas.test/scan");

  await command("Network.clearBrowserCookies");
  await screenshot("gameday-official-sign-in.png", "https://platform.netballamericas.test/gameday");
} finally {
  socket.close();
  browser.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true });
}
