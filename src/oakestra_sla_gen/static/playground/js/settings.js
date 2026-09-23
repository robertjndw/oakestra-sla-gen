import { $ } from "./dom.js";
import { plural } from "./format.js";

const settingsBtn = $("settings-btn");
const settingsPanel = $("settings-panel");
const fields = ["method", "max-retries", "customer-id", "check-images"].map($);

export function collectSettings() {
  let retries = parseInt($("max-retries").value, 10);
  if (!isFinite(retries)) retries = 3;
  return {
    method: $("method").value,
    max_retries: Math.max(1, Math.min(10, retries)),
    check_images: $("check-images").checked,
    customer_id: $("customer-id").value.trim() || "Admin",
  };
}

// Settings go out with the first message only, so they're locked once a session exists.
export function lockSettings(locked) {
  for (const node of fields) node.disabled = locked;
  $("settings-note").hidden = !locked;
}

function updateSummary() {
  const s = collectSettings();
  $("settings-summary").textContent = s.method + ", " + plural(s.max_retries, "attempt");
}

function toggle(open) {
  settingsPanel.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", String(open));
}

export function initSettings() {
  settingsBtn.addEventListener("click", () => toggle(settingsPanel.hidden));
  document.addEventListener("click", (e) => {
    if (!settingsPanel.hidden && !e.target.closest(".settings-wrap")) toggle(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsPanel.hidden) { toggle(false); settingsBtn.focus(); }
  });
  for (const node of fields) node.addEventListener("change", updateSummary);
  updateSummary();
}
