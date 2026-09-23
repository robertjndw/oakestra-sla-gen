// Never rejects. A network failure comes back as status 0, so callers only have to switch
// on the status.
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    return { status: 0, body: { detail: err.message } };
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data || {} };
}

const sessionUrl = (id) => "/playground/sessions/" + encodeURIComponent(id);

export const fetchInfo = () => api("GET", "/playground/info");
export const startSession = (settings, description, compose) => {
  const body = { ...settings, description };
  if (compose) body.compose = compose;
  return api("POST", "/playground/sessions", body);
};
export const answerSession = (id, text) => api("POST", sessionUrl(id) + "/answer", { text });
export const deleteSession = (id) => api("DELETE", sessionUrl(id));
export const validate = (sla) => api("POST", "/validate", sla);
