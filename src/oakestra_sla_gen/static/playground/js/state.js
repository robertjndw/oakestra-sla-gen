// Shared by conversation.js and output.js. An object rather than exported `let`s, since
// importers can't reassign those.
export const state = {
  sessionId: null,
  turnRunning: false,
  draftCount: 0,
  modelSla: null,          // latest SLA the model produced
  previousModelSla: null,  // the one before it, for "what changed"
  accepted: false,
};
