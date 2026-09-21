/**
 * The merchant side, driven through a browser: onboard, create a charge, take
 * a payment from a second account, refund it, and check the books.
 *
 *   npx tsx --conditions=react-server scripts/merchant-journey.ts
 */
import { chromium, type Browser, type Page } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EXECUTABLE = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const log: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  log.push(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};
const textOf = (page: Page) => page.locator("body").innerText().then((t) => t.replace(/\s+/g, " "));

async function signUp(browser: Browser, name: string, email: string, desktop = false) {
  const context = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 900 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", "a-decent-passphrase-2026");
  await page.click('button[type="submit"]');
  // Sign-ups are rate limited per address. If the redirect does not arrive,
  // report what the form actually said instead of a bare timeout.
  try {
    await page.waitForURL("**/dashboard", { timeout: 25_000 });
  } catch {
    const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    throw new Error(`Sign-up did not complete: ${shown.slice(0, 200)}`);
  }
  return page;
}

async function fund(page: Page, amount: string) {
  await page.goto(`${BASE}/wallet/deposit`, { waitUntil: "domcontentloaded" });
  await page.fill("#sim-amount", amount);
  await page.click('form:has(#sim-amount) button[type="submit"]');
  await page.waitForFunction(() => !document.body.innerText.includes("Crediting"), undefined, { timeout: 20_000 });
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const stamp = Date.now();

  // --- the merchant onboards ------------------------------------------------
  const owner = await signUp(browser, "Mira Owner", `owner${stamp}@example.com`, true);
  await owner.goto(`${BASE}/merchant`, { waitUntil: "domcontentloaded" });
  check("a new user is sent to merchant onboarding", owner.url().includes("/merchant/onboarding"));
  await owner.fill("#name", `Test Bakery ${stamp}`);
  await owner.click('button[type="submit"]');
  await owner.waitForURL("**/merchant/dashboard", { timeout: 20_000 });
  const dash = await textOf(owner);
  check("merchant dashboard opens after onboarding", dash.includes(`Test Bakery ${stamp}`));
  check("an unverified merchant is told so", dash.includes("Verification pending"));

  // --- create a charge ------------------------------------------------------
  await owner.goto(`${BASE}/merchant/payments`, { waitUntil: "domcontentloaded" });
  await owner.fill("#amount", "7.50");
  await owner.fill("#description", "Sourdough loaf");
  await owner.click('form button[type="submit"]');
  await owner.waitForURL("**/merchant/payments/**", { timeout: 20_000 });
  const chargeText = await textOf(owner);
  check("the charge page shows the amount", chargeText.includes("€7.50"));
  check("the charge page shows a QR and a code", chargeText.includes("scans this with the Payence app"));
  const code = owner.url().split("/").pop()!;
  const qrPresent = await owner.locator('[role="img"] svg').count();
  check("a QR code is rendered", qrPresent > 0);

  // --- an API key -----------------------------------------------------------
  await owner.goto(`${BASE}/merchant/developers`, { waitUntil: "domcontentloaded" });
  await owner.fill('input[name="name"]', "Journey key");
  await owner.click('form:has(input[name="name"]) button[type="submit"]');
  await owner.waitForSelector("text=Copy this key now", { timeout: 20_000 });
  const keyText = await textOf(owner);
  check("an API key is shown exactly once, with a warning", keyText.includes("It is not shown again"));
  check("the key looks like a key", /pk_test_[A-Za-z0-9_-]{10,}/.test(keyText));

  // --- a customer pays it ---------------------------------------------------
  const customer = await signUp(browser, "Cass Customer", `cust${stamp}@example.com`);
  await fund(customer, "100");
  await customer.goto(`${BASE}/checkout/${code}`, { waitUntil: "domcontentloaded" });
  const checkout = await textOf(customer);
  check("the customer sees the merchant's charge", checkout.includes("€7.50") && checkout.includes("Sourdough loaf"));
  await customer.click('button[type="submit"]');
  await customer.waitForURL("**/done**", { timeout: 20_000 });
  check("the customer gets a completion screen", (await textOf(customer)).includes("Payment complete"));

  // --- the merchant sees it, net of the fee ---------------------------------
  await owner.goto(`${BASE}/merchant/transactions`, { waitUntil: "domcontentloaded" });
  const payments = await textOf(owner);
  check("the payment appears on the merchant account", payments.includes("Payment") && payments.includes("fee"));
  check("the payment is marked completed", payments.includes("Completed"));

  // --- refund ---------------------------------------------------------------
  await owner.click('button:has-text("Refund")');
  await owner.fill('input[name="amount"]', "2.00");
  await owner.click('button:has-text("Send refund")');
  await owner.waitForSelector("text=Refund sent", { timeout: 20_000 });
  check("a partial refund succeeds", (await textOf(owner)).includes("Refund sent"));

  await customer.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" });
  const custActivity = await textOf(customer);
  check("the refund reaches the customer's activity", custActivity.includes("Refund from"));

  // --- the merchant dashboard adds up ---------------------------------------
  await owner.goto(`${BASE}/merchant/dashboard`, { waitUntil: "domcontentloaded" });
  const summary = await textOf(owner);
  // The stat label is uppercased in CSS, so innerText gives "PAYMENTS · 30D".
  const statsAt = summary.toLowerCase().indexOf("payments \u00b7 30d");
  const statsSlice = statsAt >= 0 ? summary.slice(statsAt, statsAt + 60) : "(stat tile not found)";
  check("the dashboard counts the payment", /30d\s*1\b/i.test(statsSlice), statsSlice);
  check("the dashboard reports net revenue by asset", summary.includes("USD Coin"), summary.slice(0, 200));
  check("the dashboard counts the refund", summary.includes("1 refunded"));

  await browser.close();
  console.log(log.join("\n"));
  console.log(`\n${log.filter((l) => l.startsWith("PASS")).length} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
