## Nextologies Meet Controller

Control microphones in Google Meet rooms via the **NextoTalk** Chrome Extension. Each Companion button maps to one active Meet tab and shows the room's live mic state — muted, unmuted, speaking, or busy.

---

### Prerequisites

- **NextoTalk** Chrome Extension installed and running in your browser
- **Bitfocus Companion** 3.x or later
- The NextoTalk extension must be configured to connect to the same WebSocket port as this module (default: **7005**)

---

### Connection Setup

1. Add a new connection in Companion and select **Nextologies – Meet Controller**.
2. Set the **WebSocket Port** to match the port configured in the NextoTalk extension (default: `7005`).
3. Leave **Host / Bind Address** at its default (`127.0.0.1`) unless the extension runs on a different machine — widening it (e.g. to `0.0.0.0`) exposes the module's commands to anything on the same network, so only do this if you understand the exposure.
4. Save. The module status shows **Connecting** while the server starts, then **OK** with the host/port once it's actually listening.

> If the status shows a port-in-use error, either change the port here or stop any other process using that port.

---

### Quick Start — Preset Buttons

The module ships a ready-made preset:

| Preset              | Category | What it does                                                                           |
| ------------------- | -------- | -------------------------------------------------------------------------------------- |
| Toggle Mic (Custom) | Meetings | Toggles mute on the room mapped to this button. Button colour reflects live mic state. |

**To use a preset:**

1. Open the **Presets** panel in Companion.
2. Drag **Toggle Mic (Custom)** onto any button on your surface.
3. Open a Google Meet tab with the NextoTalk extension active — the room name and mic state will appear on the button automatically.

---

### Actions

#### Toggle Microphone

Toggles the microphone of the Google Meet room associated with this button.

- No manual options required — the room mapping is handled automatically by the NextoTalk extension.
- Pressing the button sends a toggle request to the extension; the button colour updates immediately (optimistic), then confirms once the extension echoes the new state.
- If the button has no room mapped (blank key), the action logs a warning and does nothing.

---

### Feedbacks

#### Microphone Status

Drives the button's background colour and icon based on the live room state.

| Option      | Values                 | Notes                                                                                                          |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Room Number | `0` (Auto) or `1–9999` | `0` = auto-map to whichever room the extension assigns. A specific number pins the button to that room number. |

**Colour coding:**

| Colour             | State                                                    |
| ------------------ | -------------------------------------------------------- |
| Red                | Microphone muted                                         |
| Green              | Microphone unmuted (live)                                |
| Blue               | Participant is actively speaking                         |
| Orange             | Room / participant is busy                               |
| Dark grey          | Room exists but is inactive (tab closed / meeting ended) |
| Black (blank icon) | No room mapped to this button                            |

The button also shows the **room name** as text and a mic icon (muted/unmuted).

**Room name font size:** the font size used for the room-name text is controlled by the NextoTalk extension **per room**, not by a Companion button setting and not by one global dial. The extension stores a `roomNameFontSize` (1–10 scale, default `5`) on each room's own metadata — set via its external `map_meeting_room_to_key` / `update_room_name` / `allocate_room` commands — and sends that room's value with every mic-status update for it. This module keeps its own per-meeting map, maps each room's level to a pixel size (`10 + level * 3`), and applies it only to the button(s) showing that room. Level `5` (the default) renders close to Companion's own `auto` sizing, so rooms that never set it look unchanged. There is nothing to configure on the Companion side.

---

### Variables

The module exposes these Companion variables:

| Variable                                     | Description                                                  |
| -------------------------------------------- | ------------------------------------------------------------ |
| `$(nextologies-nextotalk:module_version)`    | Running module version (read from `package.json`)            |
| `$(nextologies-nextotalk:connected_clients)` | Number of WebSocket clients (extensions) currently connected |

---

### How Room Mapping Works

The NextoTalk extension manages the mapping automatically:

1. When a Meet tab opens, the extension assigns it a **room number** and sends the room's mic state to this module.
2. The module's `toggle_mic` action on each button advertises its **grid position** (row, column) to the extension via WebSocket.
3. The extension maps that grid position to the nearest available room and pushes the mapping back.
4. From that point, pressing the button toggles the correct room, and the feedback reflects live state.

If you restart Companion, the extension re-delivers all active room states and the mappings self-heal within a few seconds.

---

### Use Cases

**1. Mute / unmute your own mic in a single Google Meet call**

- Add one Toggle Mic button to your panel.
- Join a Meet call — the button auto-maps to that call and shows your current mic state.
- Press to toggle.

**2. Manage multiple simultaneous Meet rooms (e.g. broadcast / multi-room scenarios)**

- Add one Toggle Mic button per room.
- Each button auto-maps to a different active Meet tab via grid position.
- The NextoTalk extension assigns rooms by matching button positions to tabs in order.

**3. Pin a button to a specific room number**

- Set the **Room Number** option on the `mic_status` feedback to a fixed value (e.g. `2`).
- That button always tracks room 2, regardless of which grid position it occupies.

**4. Visual monitoring without pressing anything**

- Add `mic_status` feedbacks to buttons or indicators on a read-only page.
- Use the colour states to monitor mic activity across all rooms at a glance.

---

### Known Limitations

- **Google Meet only** — the extension targets Google Meet tabs exclusively; other video platforms are not supported.
- **NextoTalk extension required** — this module is a companion to the NextoTalk Chrome Extension; it does not communicate with Google Meet directly.
- **One surface** — the module advertises itself as a single Companion surface to the extension, without a fixed grid size (actual page/surface dimensions are user-configurable). Physical Stream Deck devices are managed separately through the extension's own Stream Deck plugin.
- **Room auto-mapping is positional** — buttons that share the same grid coordinates in different Companion pages may map to the same room. Use fixed Room Numbers on the feedback to disambiguate.
- **No push-to-talk** — the module sends a toggle command on button press. Hold-to-talk (push-to-talk) is not implemented; pressing again re-toggles.

---

### Troubleshooting

| Symptom                                          | Likely cause                                                       | Fix                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Module status shows "Port in use?"               | Another process (or a previous module instance) is using port 7005 | Change the port in module settings and update the extension to match     |
| Button stays blank after joining a call          | Extension not connected or mismatched port                         | Check the extension's WebSocket URL; confirm the port matches            |
| Button shows wrong room                          | Grid position collision across pages                               | Set a fixed Room Number in the `mic_status` feedback options             |
| Mute state out of sync after a Companion restart | Mapping not yet re-delivered                                       | Wait a few seconds; the extension re-sends all room states automatically |
| Room name not updating                           | Extension version mismatch                                         | Update the NextoTalk Chrome Extension to the latest version              |
