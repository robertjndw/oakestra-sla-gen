import { fetchInfo } from "./api.js";
import { initConversation } from "./conversation.js";
import { $ } from "./dom.js";
import { initOutput } from "./output.js";
import { initSettings } from "./settings.js";

initSettings();
initOutput();
initConversation();

fetchInfo().then(({ status, body }) => {
  if (status === 200 && body.model) {
    $("model-name").textContent = body.model;
    $("model-pill").hidden = false;
  }
});
