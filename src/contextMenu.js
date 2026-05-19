import OBR from "@owlbear-rodeo/sdk";

export function setupContextMenu(EXT_ID) {
  const META_KEY = `${EXT_ID}/metadata`;

  OBR.contextMenu.create({
    id: `${EXT_ID}/context-menu`,
    icons: [
      {
        // Show "Add to Initiative" when the token has NO metadata yet
        icon: "/add.svg",
        label: "Add to Initiative",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            { key: ["metadata", META_KEY], value: undefined },
          ],
        },
      },
      {
        // Show "Remove from Initiative" when the token already has metadata
        icon: "/remove.svg",
        label: "Remove from Initiative",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            {
              key: ["metadata", META_KEY],
              value: undefined,
              operator: "!=",
            },
          ],
        },
      },
    ],
    async onClick(context) {
      const addToInitiative = context.items.every(
        (item) => item.metadata[META_KEY] === undefined
      );

      if (addToInitiative) {
        // Add with default initiative of 0; user can edit in the panel
        OBR.scene.items.updateItems(context.items, (items) => {
          for (const item of items) {
            item.metadata[META_KEY] = {
              initiative: 0,
              themeSong: "",
            };
          }
        });
      } else {
        // Remove from initiative
        OBR.scene.items.updateItems(context.items, (items) => {
          for (const item of items) {
            delete item.metadata[META_KEY];
          }
        });
      }
    },
  });

  // Second context menu entry: Theme Song (only shows when already in initiative)
  OBR.contextMenu.create({
    id: `${EXT_ID}/theme-song-menu`,
    icons: [
      {
        icon: "/music.svg",
        label: "Set Theme Song",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER" },
            {
              key: ["metadata", META_KEY],
              value: undefined,
              operator: "!=",
            },
          ],
        },
      },
    ],
    async onClick(context) {
      if (context.items.length !== 1) return;
      const item = context.items[0];
      const currentSong = item.metadata[META_KEY]?.themeSong ?? "";

      const url = window.prompt(
        `🎵 Paste a YouTube URL for "${item.name}":\n(Leave blank to clear)`,
        currentSong
      );

      if (url === null) return; // cancelled

      OBR.scene.items.updateItems([item], (items) => {
        for (const i of items) {
          if (i.metadata[META_KEY]) {
            i.metadata[META_KEY].themeSong = url.trim();
          }
        }
      });

      OBR.notification.show(
        url.trim()
          ? `🎵 Theme song set for ${item.name}!`
          : `Theme song cleared for ${item.name}.`,
        "SUCCESS"
      );
    },
  });
}
