// Terms gate: shown on the first visit to any page that loads this module.
// Accept is remembered in this browser; Decline goes to declined.html.

const KEY = "obscura.terms";
const VERSION = "2026-10-04";

function accepted() {
  try { return JSON.parse(localStorage.getItem(KEY))?.version === VERSION; } catch { return false; }
}

function remember() {
  try { localStorage.setItem(KEY, JSON.stringify({ version: VERSION, at: new Date().toISOString() })); } catch { /* private mode: ask again next visit */ }
}

export function resetTerms() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

function gate() {
  const dlg = document.createElement("dialog");
  dlg.className = "terms-gate";
  dlg.setAttribute("aria-labelledby", "terms-title");
  dlg.innerHTML = `
    <div class="sheet-card">
      <div class="sheet-head">
        <h2 id="terms-title">Before you enter</h2>
        <p>Obscura is self-custody software. Please read these four points.</p>
      </div>
      <div class="sheet-body">
        <ol class="terms-list">
          <li>Obscura runs in your browser. We never receive or hold your assets, receipts, keys or passphrases.</li>
          <li>Receipts live only on your device. If you lose one without a backup, nobody can recover that bond.</li>
          <li>The $OBX token and the bond contract are not deployed. Nothing here is an offer, a solicitation or financial advice.</li>
          <li>You use the software at your own risk and are responsible for following the laws where you live.</li>
        </ol>
        <p class="terms-more"><a class="link" href="terms.html" target="_blank" rel="noopener">Read the full Terms of Use and Privacy notice</a></p>
      </div>
      <div class="sheet-foot">
        <button class="btn btn-light" type="button" data-terms="decline">Decline</button>
        <button class="btn btn-dark" type="button" data-terms="accept">Accept and enter</button>
      </div>
    </div>`;
  document.body.append(dlg);

  // The gate cannot be dismissed with Escape: it is accept or decline.
  dlg.addEventListener("cancel", (e) => e.preventDefault());
  dlg.addEventListener("click", (e) => {
    const choice = e.target.closest("[data-terms]")?.dataset.terms;
    if (choice === "accept") {
      remember();
      dlg.close();
      dlg.remove();
      document.documentElement.classList.remove("gated");
      document.dispatchEvent(new CustomEvent("terms:accepted"));
    } else if (choice === "decline") {
      location.href = "declined.html";
    }
  });

  document.documentElement.classList.add("gated");
  dlg.showModal();
  dlg.querySelector('[data-terms="accept"]').focus();
}

export const termsAccepted = accepted();
if (!termsAccepted) gate();
