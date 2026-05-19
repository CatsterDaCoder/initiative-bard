import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "./contextMenu.js";
import { renderTracker } from "./tracker.js";

const EXT_ID = "com.initiativebard";

OBR.onReady(async () => {
  // Set up context menu (add/remove + theme song)
  setupContextMenu(EXT_ID);

  // Render the tracker UI
  renderTracker(EXT_ID);
});
