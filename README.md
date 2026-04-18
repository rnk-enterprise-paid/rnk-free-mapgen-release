![RNK Enterprise Logo](https://raw.githubusercontent.com/RNK-Enterprise/rnk-assets/main/logo.png)

# RNK™ Free MapGen

> **Current Version: v1.0.0** — Living Dungeons, Death Loot, Theme-Driven Textures, Epic Crawl Mode

**RNK™ Free MapGen** is a next-generation procedural map generation system that bridges the gap between high-level creative intent and tactical VTT execution. It creates **meaningful** maps, not just geometric patterns, by simulating history, purpose, and pacing before a single tile is ever placed.

---

## 🚀 The PCG Revolution: Intent-First Generation

Traditional generators ask: *"How do I place rooms and connect them?"*
RNK™ Free MapGen asks: **"What IS this place, who built it, and how should it FEEL to explore?"**

### The Layered Architecture
1. **Intent Layer** — Defines the experience (horror, stealth, gauntlet).
2. **Context Layer** — Defines the world (Dwarven Hold, Corrupted Temple).
3. **Semantic Layer** — Maps room purposes (Throne Room → Guards → Treasury).
4. **Structural Layer** — Builds topology and critical paths.
5. **Geometric Layer** — Generates actual tiles (BSP, Cellular Automata, Hex support).
6. **Tactical Layer** — Places walls, lights, sounds, traps, mobs, and loot directly into Foundry VTT.

---

## 🆕 What's New in v1.0.0

### 🎨 Theme-Driven Texture System
Select a **Theme** (Classic Dungeon, Lava, Frozen, Sewer, Corrupted Temple, Forest, and more) and all textures — floors, walls, and props — are automatically matched. No more manually picking three separate dropdowns.

- 9 custom floor image textures applied tile-by-tile to the generated scene
- Theme selection auto-wires `floor_textures`, `wall_textures`, and `texture_style`
- Swapping themes live updates the entire visual palette

---

### 🧟 Compendium-Powered Mob System
Replace generic placeholder tokens with real actors from your compendiums.

- **Compendium dropdown** — browse any Actor compendium in your world
- **Actor Folder dropdown** — pull from a specific world actor folder instead
- **Mob Count input** — set an exact number; the engine places *exactly* that many, no caps
- Round-robin across all rooms with stacking when tiles run out (epic crawls supported)
- Density-mode still available when mob count is left at 0

---

### 💰 Compendium-Powered Loot Spawning
Scatter real items throughout your dungeon at generation time.

- **Loot Compendium** and **Loot Folder** dropdowns to source items
- **Loot Count** — controls how many item tokens are placed per scene
- Loot tokens placed as OBSERVER NPC actors on floor tiles so players can open and take items
- Fully integrated into Campaign (multi-level) generation

---

### 🏕️ Campaign Mode — Per-Scene Mob Control
Generate a full multi-level dungeon in one click with fine-grained control over each floor.

- Set a **Level Count** and the system generates every scene, escalates CR and density, and links them
- **Per-scene mob count rows** — specify different mob densities per level (e.g. Level 1: 20, Level 2: 50, Level 3: 80)
- All scenes are automatically stair-linked with working portal notes

---

### ⚔️ Death-Triggered Loot Drops
When any NPC or monster token reaches 0 HP, the system automatically:

1. Deletes the monster token
2. Spawns a **chest token** at the exact same position
3. Fills it with a random subset of the monster's physical inventory
4. Adds a **CR-scaled gold bonus** item
5. Item count targets the number of **active connected players** so everyone gets a pickup
6. **Auto-deletes** the chest actor and token when the last item is taken

Works across game systems — HP is detected via system-agnostic probing (D&D 5e, PF2e, SWADE, Simple Worldbuilding, and others). Only the lead active GM executes drops to prevent duplication.

---

### 🔗 Multi-Level Scene Warp — Fixed
Stair notes placed by the Campaign generator now correctly warp to the linked scene in **all Foundry versions (V11/V12/V13)**.

- Notes are patched directly at the placeable level — no journal entry requirement
- Single-click or double-click on the stair icon teleports to the connected level
- Pan automatically centers on the entry point of the destination scene
- Backward-compatible: existing stair notes on already-generated scenes are patched on canvas load

---

## 🪤 Tactical Trap Waypoints

A professional-grade **GM-only Waypoint System** for tactical trap management.

- **Non-Placeable Visuals** — Trap overlays on `canvas.controls`, completely invisible to players
- **11+ Trap Categories** — Spike Floors, Poison Darts, Arcane Runes, Void Links (teleportation), and more
- **Void Link Pairing** — Step into one gate, emerge from its paired partner across the dungeon
- **Smart Triggers** — Proximity detection with configurable radii, DCs, and automated damage
- **Persistent State** — Trap triggered/untriggered state survives scene reloads

---

## 🛠️ Foundry VTT Integration

The **rnk-free-mapgen** module provides a powerful GM Hub within Foundry VTT (v12/v13 compatible).

### Full Feature List
| Feature | Description |
|---|---|
| One-Click Generation | Full scenes with walls, doors, lighting, mobs, and loot in seconds |
| Theme Textures | Floor/wall/prop visuals auto-matched to selected theme |
| Mob Spawning | Exact count from any compendium or world actor folder |
| Loot Spawning | Item tokens placed from compendium or item folder |
| Death Loot | Monsters auto-drop chests with loot on death |
| Campaign Mode | Multi-level generation with per-level mob counts |
| Scene Warping | Stair notes teleport between levels with one click |
| Trap System | GM-only trap overlays with proximity triggers |
| Living Dungeons | Actors patrol, respect walls, react to player tokens |
| AI Analysis | Real-time spatial clustering and optimization suggestions |
| Scene Tracker | Session analytics — crits, fumbles, damage totals |
| Turbo Engine | High-performance wall/light creation for 100+ room maps |

### Installation & Setup
1. **Start the Python Engine**:
   ```bash
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8001
   ```
2. **Install Module** — Copy the `/rnk-free-mapgen` folder to your Foundry `Data/modules` directory.
3. **Connect** — In module settings, set the server URL (default: `http://192.168.1.52:8001/api/generate`) and the Patreon auth URL (default: `http://192.168.1.52:3847`).
4. **Log In** — Open the GM Hub and connect your Patreon session when prompted.
5. **Open the GM Hub** — Click the RNK™ Free MapGen button in the scene controls toolbar.

---

## 🧪 Quick Start (CLI)

Generate a dungeon PNG directly from the terminal:
```bash
python src/main.py --preset horror --output dungeon.png
```

Save as JSON with tactical anchors:
```bash
python src/main.py --output dungeon.json --anchor_types wall door
```

---

## 📂 Project Structure

```
rnk-free-mapgen/
├── rnk-free-mapgen/          # Foundry VTT Module
│   ├── scripts/
│   │   ├── rnk-dungeon.js   # Core engine, GM Hub, mob/loot/warp/death-loot
│   │   ├── rnk-movement.js  # Patrol & wall-aware actor movement
│   │   └── rnk-traps.js     # Trap waypoint system
│   ├── templates/
│   │   ├── gm-hub.html      # GM Hub interface (themes, mobs, loot, campaign)
│   │   └── scene-tracker.html
│   └── assets/              # Floor textures, props, sounds
├── src/                     # Python PCG Engine
│   ├── core/                # Layer definitions & types
│   ├── geometric_layer.py   # BSP/CA tile generation
│   ├── semantic_layer.py    # Room meaning & relationships
│   └── visualization.py    # Image rendering with custom floor textures
├── server.py                # FastAPI bridge
└── start_servers.bat        # Windows quick-start
```

---

## 📜 Philosophy: Generate Meaning First

| Traditional Generators | RNK™ Free MapGen |
|---|---|
| Start with grid | Start with meaning |
| Rooms are rectangles | Rooms are concepts |
| Connections are corridors | Connections are relationships |
| Parameters are numbers | Parameters are intent |
| Output is tiles | Output is **experience** |

---

## 🌐 Semantic Relationships

Rooms are connected by *meaning*, not just corridors:
- `GUARDS` — A guard post protects the treasury
- `HIDES` — The throne room conceals a secret passage
- `OVERLOOKS` — The balcony has a line of sight on the great hall
- `TRANSFORMS` — A sacred altar became corrupted over time

The system performs automated graph traversal to guarantee solvability. If a Key-Lock puzzle is requested, the key is always placed in a reachable area before the corresponding locked door.

---

## 📈 Roadmap

- [x] **v0.1.0** — Core Semantic Engine & Geometric Layers
- [x] **v0.2.0** — Foundry VTT Hub & Wall/Light automation
- [x] **v0.3.0** — Tactical Trap Waypoints & Void Link Teleportation
- [x] **v0.4.0** — Theme-Driven Textures, Compendium Mob & Loot System
- [x] **v0.5.0** — Campaign Mode, Per-Scene Mob Counts, Scene Warp Fix
- [x] **v0.6.0** — Death-Triggered Loot Drops, Exact Mob Count, Epic Crawl Support
- [x] **v1.0.0** — Full release: all systems stable, V13 verified, production-ready
- [ ] **v1.1.0** — Wave Function Collapse (WFC) for infinite mega-dungeons
- [ ] **v1.2.0** — Multi-level 3D visualization using Canvas V2

---

## 🏗️ Technical Stack

- **Backend**: Python 3.10+, FastAPI, NetworkX, NumPy, SciPy, Pillow
- **VTT Client**: JavaScript (ES Modules), PIXI.js, Handlebars
- **Compatibility**: Foundry VTT V11 / V12 / V13 Verified

---

## 📝 License & Attributions

- **Code**: Proprietary — All Rights Reserved
- **Assets**: See [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md) for sound/texture credits.

## 🔐 Access Policy

- Free-tier generation requires Patreon authentication.
- The free tier is quota-limited per day by the API.
- Alpha, core, and architect tiers use the same Patreon sign-in flow with tier-specific access levels.

---

## 🤝 Support & Community

- **GitHub**: [RNK-Enterprise/rnk-mapper](https://github.com/RNK-Enterprise/rnk-mapper)
- **Discord**: Join our community of digital dungeon masters.

**© 2026 RNK™ Enterprise. All Rights Reserved.**
