import { loadSceneTraps, renderSceneTraps, checkTraps } from "./rnk-traps.js";
import { createPatreonAuthController } from "./rnk-patreon-auth.js";

const MODULE_NAME = "rnk-free-mapgen";
const DEFAULT_ENDPOINT = "https://mapgen-api.rnkstudios.uk/api/generate";
const DEFAULT_AUTH_ENDPOINT = "https://mapgen-api.rnkstudios.uk";
const MODULE_TIER = "free";

// ── Dialog compatibility shim (V11/V12 legacy ↔ V13 DialogV2) ────────────────
// V13 deprecates `new Dialog({...})`. This wrapper transparently uses DialogV2
// when available and falls back to the legacy API on older versions.
function rnkDialog(opts) {
  const DV2 = foundry.applications?.api?.DialogV2;
  if (DV2) {
    const buttons = Object.entries(opts.buttons || {}).map(([action, btn]) => ({
      action,
      icon: btn.icon || "",
      label: btn.label || action,
      default: action === (opts.default ?? ""),
      callback: btn.callback
        ? (_ev, _btn, dialog) => btn.callback($(dialog.element))
        : undefined,
    }));
    const d = new DV2({
      window: { title: opts.title || "" },
      content: opts.content || "",
      buttons,
      render: opts.render
        ? (_ev, dialog) => opts.render($(dialog.element))
        : undefined,
    });
    return d;
  }
  return new Dialog(opts);
}
// ─────────────────────────────────────────────────────────────────────────────

// Tile type values from the generator
const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  DOOR: 3,
  HIDDEN_DOOR: 4,
  WATER: 5,
  LAVA: 6,
  PIT: 7,
  STAIRS_UP: 8,
  STAIRS_DOWN: 9,
  ENTRANCE: 10,
  EXIT: 11,
};
const PRESET_LABELS = {
  // Intent presets
  classic: "Classic Dungeon",
  horror: "Horror",
  puzzle: "Puzzle Dungeon",
  gauntlet: "Combat Gauntlet",
  exploration: "Exploration",
  stealth: "Stealth Mission",
  survival: "Survival Horror",
  heist: "Heist",
  boss_rush: "Boss Rush",
  mystery: "Mystery/Investigation",
  tutorial: "Tutorial/Beginner",
  // Context presets
  dwarven: "Dwarven Hold",
  temple: "Corrupted Temple",
  elven: "Elven Ruins",
  cult: "Dark Cult Lair",
  tomb: "Ancient Tomb",
  caves: "Natural Caves",
  sewers: "City Sewers",
  volcanic: "Volcanic Forge",
  manor: "Haunted Manor",
  underwater: "Underwater Temple",
  arctic: "Arctic Outpost",
  // Constraint presets
  maze: "Maze",
  metroidvania: "Metroidvania",
  linear: "Linear/Story",
  open_world: "Open World",
  branching: "Branching Paths",
  tight: "Tight/Small",
  sprawling: "Sprawling Complex",
  puzzle_heavy: "Puzzle-Heavy",
  boss_arena: "Boss Arena",
  // Procedural Texture Styles
  procedural_classic: "Procedural: Classic",
  procedural_cave: "Procedural: Cave",
  procedural_dungeon: "Procedural: Dungeon",
  procedural_temple: "Procedural: Temple",
  procedural_sewer: "Procedural: Sewer",
  procedural_ice: "Procedural: Frozen/Ice",
  procedural_lava: "Procedural: Volcanic/Lava",
  procedural_forest: "Procedural: Overgrown/Forest",
  procedural_underwater: "Procedural: Underwater",
  procedural_clean: "Procedural: Clean/Modern",
  // Asset-Based Texture Styles
  asset_classic_dungeon: "Asset: Classic Dungeon",
  asset_corrupted_temple: "Asset: Corrupted Temple",
  asset_elven_ruins: "Asset: Elven Ruins",
  asset_dark_cult: "Asset: Dark Cult",
  asset_ancient_tomb: "Asset: Ancient Tomb",
  asset_natural_caves: "Asset: Natural Caves",
  asset_city_sewers: "Asset: City Sewers",
  asset_volcanic_forge: "Asset: Volcanic Forge",
  asset_haunted_manor: "Asset: Haunted Manor",
  asset_underwater_temple: "Asset: Underwater Temple",
  asset_arctic_outpost: "Asset: Arctic Outpost",
  asset_forest: "Asset: Forest",
  asset_frozen: "Asset: Frozen",
  asset_modern: "Asset: Modern",
  asset_lava: "Asset: Lava",
  // High-Quality Texture Assets
  asset_classic_dungeon_floor: "🏰 Classic Dungeon Floor",
  asset_corrupted_temple_floor: "⛩️ Corrupted Temple Floor",
  asset_natural_caves_floor: "⛏️ Natural Cave Floor",
  asset_city_sewers_floor: "🚿 Sewer Floor",
  asset_lava_floor: "🔥 Lava Floor",
  asset_underwater_temple_floor: "🌊 Underwater Floor",
  asset_forest_floor: "🌲 Forest Floor",
  asset_frozen_floor: "❄️ Frozen Floor",
  asset_modern_floor: "🏢 Modern Floor",
  // Output formats
  png: "PNG Image",
  svg: "SVG Vector",
  json: "JSON Data",
  all: "All Formats",
};

// Theme → texture mapping: floor image, wall style, and texture_style per theme
const THEME_TEXTURES = {
  abandoned_mine:    { floor: "natural_cave_floor",     wall: "dirty",       style: "classic" },
  arcane_laboratory: { floor: "modern_floor",            wall: "brick",        style: "classic" },
  celestial:         { floor: "classic_dungeon_floor",   wall: "cobblestone", style: "classic" },
  classic_dungeon:   { floor: "classic_dungeon_floor",   wall: "cobblestone", style: "classic" },
  clockwork:         { floor: "modern_floor",            wall: "brick",        style: "classic" },
  corrupted_temple:  { floor: "corrupted_temple_floor",  wall: "dirty",       style: "classic" },
  crypt:             { floor: "classic_dungeon_floor",   wall: "cobblestone", style: "classic" },
  crystal_cavern:    { floor: "natural_cave_floor",      wall: "dirty",       style: "classic" },
  drow_temple:       { floor: "corrupted_temple_floor",  wall: "dirty",       style: "classic" },
  eldritch:          { floor: "corrupted_temple_floor",  wall: "dirty",       style: "classic" },
  forest:            { floor: "forest_floor",            wall: "dirty",       style: "classic" },
  frozen:            { floor: "frozen_floor",            wall: "cobblestone", style: "classic" },
  fungal_underdark:  { floor: "natural_cave_floor",      wall: "dirty",       style: "classic" },
  infernal:          { floor: "lava_floor",              wall: "dirty",       style: "classic" },
  lava:              { floor: "lava_floor",              wall: "dirty",       style: "classic" },
  modern:            { floor: "modern_floor",            wall: "cobblestone", style: "classic" },
  natural_cave:      { floor: "natural_cave_floor",      wall: "dirty",       style: "classic" },
  sewer:             { floor: "sewer_floor",             wall: "brick",        style: "classic" },
  sunken_ruins:      { floor: "underwater_floor",        wall: "cobblestone", style: "classic" },
  underwater:        { floor: "underwater_floor",        wall: "cobblestone", style: "classic" },
  volcanic:          { floor: "lava_floor",              wall: "dirty",       style: "classic" },
};
function themeTextures(theme) {
  return THEME_TEXTURES[theme] || THEME_TEXTURES.classic_dungeon;
}

// Preset icons
const PRESET_ICONS = {
  // Intent
  classic: "fa-dungeon",
  horror: "fa-skull",
  puzzle: "fa-puzzle-piece",
  gauntlet: "fa-fist-raised",
  exploration: "fa-compass",
  stealth: "fa-user-ninja",
  survival: "fa-heartbeat",
  heist: "fa-gem",
  boss_rush: "fa-dragon",
  mystery: "fa-search",
  tutorial: "fa-graduation-cap",
  // Context
  dwarven: "fa-mountain",
  temple: "fa-cross",
  elven: "fa-leaf",
  cult: "fa-skull-crossbones",
  tomb: "fa-monument",
  caves: "fa-gem",
  sewers: "fa-water",
  volcanic: "fa-fire",
  manor: "fa-ghost",
  underwater: "fa-fish",
  arctic: "fa-snowflake",
  // Constraints
  maze: "fa-maze",
  metroidvania: "fa-gamepad",
  linear: "fa-arrow-right",
  open_world: "fa-globe",
  branching: "fa-code-branch",
  tight: "fa-compress",
  sprawling: "fa-expand",
  puzzle_heavy: "fa-brain",
  boss_arena: "fa-khanda",
  // Procedural Texture Styles
  procedural_classic: "fa-palette",
  procedural_cave: "fa-mountain",
  procedural_dungeon: "fa-dungeon",
  procedural_temple: "fa-cross",
  procedural_sewer: "fa-water",
  procedural_ice: "fa-snowflake",
  procedural_lava: "fa-fire",
  procedural_forest: "fa-tree",
  procedural_underwater: "fa-fish",
  procedural_clean: "fa-broom",
  // Asset-Based Texture Styles
  asset_classic_dungeon: "fa-image",
  asset_corrupted_temple: "fa-image",
  asset_elven_ruins: "fa-image",
  asset_dark_cult: "fa-image",
  asset_ancient_tomb: "fa-image",
  asset_natural_caves: "fa-image",
  asset_city_sewers: "fa-image",
  asset_volcanic_forge: "fa-image",
  asset_haunted_manor: "fa-image",
  asset_underwater_temple: "fa-image",
  asset_arctic_outpost: "fa-image",
  asset_forest: "fa-image",
  asset_frozen: "fa-image",
  asset_modern: "fa-image",
  asset_lava: "fa-image",
  // High-Quality Texture Assets
  asset_classic_dungeon_floor: "fa-image",
  asset_corrupted_temple_floor: "fa-image",
  asset_natural_caves_floor: "fa-image",
  asset_city_sewers_floor: "fa-image",
  asset_lava_floor: "fa-image",
  asset_underwater_temple_floor: "fa-image",
  asset_forest_floor: "fa-image",
  asset_frozen_floor: "fa-image",
  asset_modern_floor: "fa-image",
  // Output formats
  png: "fa-image",
  svg: "fa-vector-square",
  json: "fa-code",
  all: "fa-layer-group",
};

function getPresetLabel(key) {
  return PRESET_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getPresetIcon(key) {
  return PRESET_ICONS[key] || "fa-circle";
}

/**
 * Main application window for RNK Free MapGen GM Hub.
 * Uses ApplicationV2 (v12/v13+) with Handlebars.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api || {};
const AppV2Base = HandlebarsApplicationMixin ? HandlebarsApplicationMixin(ApplicationV2) : foundry.applications.api?.HandlebarsApplicationV2 || class { static DEFAULT_OPTIONS = {}; constructor() { throw new Error("This module requires Foundry VTT V12 or later."); } };

/**
 * Helper function to extract form data as an object
 */
function getFormData(form) {
  const formData = new FormData(form);
  const data = {};
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  return data;
}

/**
 * Independent Scene Tracker Hub for live analytics and event logging.
 */
class RNKSceneTracker extends AppV2Base {
  static _instance;
  _shouldTrack = true;

  static get instance() {
    if (!this._instance) this._instance = new this();
    return this._instance;
  }

  static DEFAULT_OPTIONS = {
    id: "rnk-scene-tracker",
    classes: ["rnk-scene-tracker"],
    tag: "div",
    window: {
      title: "RNK SCENE TRACKER HUB",
      icon: "fas fa-satellite-dish",
      resizable: true,
      controls: []
    },
    position: {
      width: 1280,
      height: 900,
      minWidth: 960,
      minHeight: 720
    }
  };

  static PARTS = {
    form: {
      template: "modules/rnk-free-mapgen/templates/scene-tracker.html"
    }
  };

  constructor(options = {}) {
    super(options);
    this.patreonAuth = createPatreonAuthController({
      moduleName: MODULE_NAME,
      defaultAuthBaseUrl: DEFAULT_AUTH_ENDPOINT,
      onChange: () => this.render(),
    });
    this.analytics = {
      totalRolls: 0,
      crits: 0,
      fumbles: 0,
      totalDamage: 0
    };
    this.events = [];
    this.startTime = Date.now();
    this._loadPersistedData();
  }

  async _loadPersistedData() {
    if (!canvas.scene) return;
    const sceneData = canvas.scene.getFlag(MODULE_NAME, "sceneAnalytics") || {};
    this.analytics = {
      totalRolls: sceneData.totalRolls || 0,
      crits: sceneData.crits || 0,
      fumbles: sceneData.fumbles || 0,
      totalDamage: sceneData.totalDamage || 0
    };
  }

  async _savePersistedData() {
    if (!canvas.scene) return;
    await canvas.scene.setFlag(MODULE_NAME, "sceneAnalytics", this.analytics);
    
    // Also update global totals (increments only)
    const currentGlobal = game.settings.get(MODULE_NAME, "globalAnalytics") || {};
    // Note: This is an simplified increment. For real precision we'd track deltas,
    // but for user feedback this is often sufficient.
    await game.settings.set(MODULE_NAME, "globalAnalytics", {
      totalRolls: (currentGlobal.totalRolls || 0) + 1,
      crits: this.analytics.crits, 
      fumbles: this.analytics.fumbles,
      totalDamage: this.analytics.totalDamage
    });
  }

  async _prepareContext(options) {
    // Re-load every time we prepare context to stay in sync
    await this._loadPersistedData();
    
    const players = game.users.filter(u => !u.isGM).map(u => {
      const char = u.character;
      return {
        id: u.id,
        name: u.name,
        className: char?.items?.find(i => i.type === "class")?.name || "Adventurer",
        analytics: char?.getFlag(MODULE_NAME, "analytics") || { avgRoll: 0, topAction: "None" }
      };
    });

    return {
      data: {
        currentScene: {
          name: canvas.scene?.name || "Void"
        },
        analytics: this.analytics,
        events: this.events.slice(-20), // Show more events locally
        players: players
      }
    };
  }

  async addEvent(message, type = "info") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.events.push({ time, message, type });
    if (this.events.length > 50) this.events.shift();
    await this._savePersistedData();
    this.render();
  }
}

class RnkDungeonGmHub extends AppV2Base {
  static _instance;

  static get instance() {
    if (!this._instance) this._instance = new this();
    return this._instance;
  }

  _loadTextureAssets() {
    // Map of texture file names to texture style keys
    const textureMap = {
      "Classic Dungeon Floor": "asset_classic_dungeon_floor",
      "Classic Dungeon Wall": "asset_classic_dungeon_wall",
      "Corrupted Temple Floor": "asset_corrupted_temple_floor",
      "Corrupted Temple Wall": "asset_corrupted_temple_wall",
      "Natural Cave Floor": "asset_natural_caves_floor",
      "Natural Cave Wall": "asset_natural_caves_wall",
      "Sewer Floor": "asset_city_sewers_floor",
      "Sewer Wall": "asset_city_sewers_wall",
      "Volcano Walls": "asset_volcanic_forge_wall",
      "Lava Floor": "asset_lava_floor",
      "Underwater Floor": "asset_underwater_temple_floor",
      "Underwater Wall": "asset_underwater_temple_wall",
      "Forest Floor": "asset_forest_floor",
      "Forest Wall": "asset_forest_wall",
      "Frozen Floor": "asset_frozen_floor",
      "Frozen Wall": "asset_frozen_wall",
      "Modern Floor": "asset_modern_floor",
      "Modern Wall": "asset_modern_wall",
    };

    return Object.values(textureMap);
  }

  static DEFAULT_OPTIONS = {
    id: "rnk-gm-hub",
    classes: ["rnk-gm-hub", "rnk-gothic"],
    tag: "div",
    window: {
      title: "RNK Free MapGen: Semantic Weaver",
      icon: "fas fa-dice-d20",
      resizable: true,
      controls: []
    },
    position: {
      width: 960,
      height: 720
    }
  };

  static TABS = {
    main: {
      initial: "generator",
      label: "Main Tabs"
    }
  };

  static PARTS = {
    form: {
      template: "modules/rnk-free-mapgen/templates/gm-hub.html"
    }
  };

  constructor(options = {}) {
    super(options);

    // Load actual texture files from assets
    const textureFiles = this._loadTextureAssets();

    this.presets = {
      intent: [
        "classic", "horror", "puzzle", "gauntlet", "exploration",
        "stealth", "survival", "heist", "boss_rush", "mystery", "tutorial"
      ],
      context: [
        "dwarven", "temple", "elven", "cult", "tomb", "caves",
        "sewers", "volcanic", "manor", "underwater", "arctic"
      ],
      constraints: [
        "classic", "maze", "metroidvania", "linear", "open_world",
        "branching", "tight", "sprawling", "gauntlet", "puzzle_heavy", "boss_arena"
      ],
      texture_styles: [
        "procedural_classic", "procedural_cave", "procedural_dungeon", "procedural_temple", "procedural_sewer",
        "procedural_ice", "procedural_lava", "procedural_forest", "procedural_underwater", "procedural_clean",
        ...textureFiles
      ],
      output_formats: ["png", "svg", "json", "all"],
    };
    this.lastResult = null;
    this.multiLevelResults = null;
    this.multiLevelIndex = 0;
    this.serverStatus = "checking...";
    this._didFetchPresets = false;
    this._didTestConnection = false;
    
    // Store form values to preserve across renders
    this.formState = {
      preset: "classic",
      context: "dwarven",
      constraint: "classic",
      width: 60,
      height: 45,
      seed: "",
      tile_size: "12",
      output_format: "png",
      enable_ai: false,
      turbo_mode: false,
      patrol_count: 0,
      dungeon_theme: "classic_dungeon",
      grid_type: "square",
      room_count: 15,
      room_size: "medium",
      corridor_complexity: 5,
      room_variety: 5,
      total_levels: 1,
      // Trap settings
      trap_count: 10,
      trap_difficulty: "15",
      trap_type: "random",
      trap_radius: 5,
      trap_waypoint_visible: false,
      trap_scripts_enabled: true,
      // Lighting
      light_color: "#ffaa55",
      light_intensity: 0.3,
      light_animation: "torch",
      // Sound
      sound_ambient: "none",
      sound_volume: 0.5,
      sound_water: false,
      sound_lava: false,
      // Scene
      scene_name: "",
      auto_activate: false,
      // Scene size
      grid_size: 70,
      darkness: 0.5,
      // Mobs
      mob_type: "auto",
      mob_density: "normal",
      mob_challenge: "3",
      mob_compendium: "",
      mob_folder: "",
      mob_count: 0,
      spawn_mobs: true,
      spawn_boss: false,
      spawn_miniboss: false,
      // Walls/doors/lights/sounds toggles
      create_walls: true,
      create_doors: true,
      create_lights: true,
      create_sounds: true,
      // Movement
      enable_movement: false,
      movement_speed: "normal",
      movement_interval: 10,
      pause_on_combat: true,
      respect_walls: true,
      avoid_players: false,
      generate_waypoints: true,
      // Accessibility
      accessibility_difficulty_ramps: false,
      accessibility_tutorial_markers: false,
      accessibility_wheelchair_paths: false,
      accessibility_safe_zones: false,
      // Thematic (Advanced)
      corruption_level: 0,
      decay_intensity: 0,
      magical_saturation: 0,
      cursed_level: 0,
      environmental_hazard: "none",
      chamber_shape: "square",
      symmetry_preference: "asymmetric",
      verticality_preference: "flat",
      connection_density: "moderate",
      branch_factor: 5,
      dead_end_frequency: 5,
      encounter_pacing: "spread",
      treasure_density: 5,
      secret_room_frequency: 3,
      shadow_intensity: 0.5,
      light_source_density: 5,
      light_flicker_rate: 0.3,
      mob_loot_rarity: "common",
      equipment_quality: "common",
      loot_compendium: "",
      loot_folder: "",
      loot_count: 0,
    };
    
    this._sceneOptions = {
      gridSize: 70,
      createWalls: true,
      createDoors: true,
      createLights: true,
      createSounds: true,
      darkness: 0.5,
      lightColor: "#ffaa55",
      lightIntensity: 0.3,
      lightAnimation: "torch",
      soundAmbient: "dungeon",
      soundVolume: 0.5,
      soundWater: true,
      soundLava: true,
      sceneName: "",
      autoActivate: true,
      spawnMobs: true,
      mobDensity: "normal",
      mobChallenge: "3",
      mobType: "auto",
      spawnBoss: true,
      spawnMiniboss: false,
      enableMovement: false,
      movementSpeed: "normal",
      movementInterval: 10,
      pauseOnCombat: true,
      respectWalls: true,
      avoidPlayers: false,
      generateWaypoints: true,
      trapCount: 10,
      trapRadius: 5,
      trapDifficulty: "15",
      trapType: "random",
      trapWaypointVisible: true,
      trapScriptsEnabled: true,
    };

    this.patreonAuth = createPatreonAuthController({
      moduleName: MODULE_NAME,
      defaultAuthBaseUrl: DEFAULT_AUTH_ENDPOINT,
      onChange: () => this.render(),
    });
  }

  _prepareTabs(tabs, selected) {
    const prepared = {};
    for (const [name, tab] of Object.entries(tabs || {})) {
      prepared[name] = {
        active: name === selected,
        cssClass: name === selected ? "active" : "",
        label: tab.label || name,
        icon: tab.icon || ""
      };
    }
    return prepared;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Ensure tabs structure exists
    if (!context.tabs) {
      context.tabs = {};
    }

    // Transform preset arrays into objects with keys, labels, and icons
    const transformPresets = (presetArray) => {
      return (presetArray || []).map(key => ({
        key: key,
        label: getPresetLabel(key),
        icon: getPresetIcon(key),
      }));
    };

    // Scene Tracker Data
    const currentScene = canvas.scene;
    const trackerData = {
      name: currentScene?.name || "No Scene Active",
      hasData: false,
      rooms: [],
      traps: [],
      loot: [],
      patrols: [],
      unallocatedLootCount: 0
    };

    if (currentScene) {
      const genData = currentScene.getFlag(MODULE_NAME, "generationData");
      const sentinelData = currentScene.getFlag(MODULE_NAME, "scenePatrolData") || {};
      const moduleTraps = currentScene.getFlag(MODULE_NAME, "traps") || [];
      const sentinelPatrols = Array.isArray(sentinelData) ? sentinelData : Object.values(sentinelData);

      if (genData || sentinelPatrols.length > 0 || moduleTraps.length > 0) {
        trackerData.hasData = true;
        trackerData.rooms = genData?.rooms || [];
        trackerData.traps = moduleTraps.length > 0 ? moduleTraps : (genData?.traps || []);
        trackerData.loot = genData?.loot || [];
        trackerData.patrols = sentinelPatrols;
        trackerData.unallocatedLootCount = trackerData.loot.filter(l => !l.allocated).length;
      }
    }

    // Merge everything into a consistent data object for the template
    const transformedTextures = transformPresets(this.presets.texture_styles);

    context.data = {
      presets: {
        intent: transformPresets(this.presets.intent),
        context: transformPresets(this.presets.context),
        constraints: transformPresets(this.presets.constraints),
        texture_styles: transformedTextures,
        output_formats: transformPresets(this.presets.output_formats),
      },
      defaults: {
        ...this.formState,
        preset: this.formState.preset,
        context: this.formState.context,
      },
      sceneOptions: this._sceneOptions,
      endpoint: DEFAULT_ENDPOINT,
      serverStatus: this.serverStatus || "Offline",
      result: this.lastResult,
      hasResult: !!this.lastResult,
      multiLevel: (this.multiLevelResults?.length ?? 0) > 1,
      multiLevelIndex: this.multiLevelIndex ?? 0,
      multiLevelCount: this.multiLevelResults?.length ?? 0,
      aiAnalysis: this.lastAIAnalysis || null,
      currentScene: trackerData
    };

    // Daily generation quota for free tier (waived for authenticated Patreon patrons)
    const genStatus = this._getDailyGenStatus();
    context.data.genUsed = genStatus.used;
    context.data.genRemaining = genStatus.remaining;
    context.data.genLimit = genStatus.limit;
    context.data.genUnlimited = genStatus.unlimited;

    // Available Item compendiums and Item folders for loot sourcing
    context.data.lootCompendiums = [
      { key: "", label: "\u2014 All Item Packs \u2014" },
      ...(game.packs ?? []).filter(p => p.documentName === "Item").map(p => ({ key: p.collection, label: p.title }))
    ];
    context.data.lootFolders = [
      { key: "", label: "\u2014 No Folder Filter \u2014" },
      ...(game.folders ?? []).filter(f => f.type === "Item").map(f => ({ key: f.id, label: f.name }))
    ];

    // Available Actor compendiums and world Actor folders for mob sourcing
    context.data.mobCompendiums = [
      { key: "", label: "\u2014 All Compendiums \u2014" },
      ...(game.packs ?? []).filter(p => p.documentName === "Actor").map(p => ({ key: p.collection, label: p.title }))
    ];
    context.data.mobFolders = [
      { key: "", label: "\u2014 No Folder Filter \u2014" },
      ...(game.folders ?? []).filter(f => f.type === "Actor").map(f => ({ key: f.id, label: f.name }))
    ];

    return context;
  }

  _onRender(context, options) {
    const html = $(this.element);
    
    if (!game.user?.isGM) {
      html.find(".rnk-gm-hub__actions").hide();
    }

    this.patreonAuth?.bindUI(html[0]);

    // Apply dungeon theme color scheme on render and on change
    const form = html.find(".rnk-form")[0] || this.element.querySelector("form");
    const themeSelect = html.find("select[name='dungeon_theme']");
    const applyTheme = (theme) => {
      if (form) form.dataset.theme = theme || "classic_dungeon";
    };
    applyTheme(themeSelect.val());
    themeSelect.on("change", (event) => applyTheme(event.currentTarget.value));

    // Range Slider value display updates
    html.find("input[type='range']").on("input", (event) => {
      const input = event.currentTarget;
      const value = input.value;
      const labelValue = $(input).closest(".rnk-field").find(".range-value");
      if (labelValue.length) {
        labelValue.text(value);
      }
    });

    // Open Tracker
    html.find("[data-action='open-tracker']").on("click", (event) => {
      event.preventDefault();
      RNKSceneTracker.instance.render(true);
    });

    // Generation
    html.find("[data-action='generate']").on("click", (event) => {
      event.preventDefault();
      const form = this.element.querySelector("form");
      if (!form) return;
      const formData = getFormData(form);
      const levels = parseInt(formData.total_levels) || 1;
      
      this._collectSceneOptions(formData);

      if (levels > 1) {
        this._onGenerateMultiLevel(levels, formData);
      } else {
        this._onGenerate(formData);
      }
    });

    // Campaign generation — prompts for scene count then generates + links all scenes
    html.find("[data-action='generate-campaign']").on("click", (event) => {
      event.preventDefault();
      const form = this.element.querySelector("form");
      if (!form) return;
      const formData = getFormData(form);
      this._collectSceneOptions(formData);

      // Pre-fill count from the Linked Scenes field, but let the user override via dialog
      const defaultCount = parseInt(formData.total_levels) || 3;

      rnkDialog({
        content: `
          <div style="padding:10px;">
            <p style="margin-bottom:8px;">Generate multiple fully-populated linked scenes. Each scene will have escalating CR, density, and a stair connection to the next.</p>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <label style="white-space:nowrap;font-weight:bold;">Number of Scenes:</label>
              <input id="rnk-campaign-count" type="number" min="2" max="20" value="${defaultCount}"
                style="width:70px;padding:4px;border:1px solid #999;border-radius:4px;">
            </div>
            <div id="rnk-scene-rows" style="display:grid;gap:4px;margin-bottom:8px;max-height:260px;overflow-y:auto;padding-right:4px;"></div>
            <p style="margin-top:6px;font-size:0.82em;color:#888;">Tip: stair notes placed on each scene let you warp between them with one click.</p>
          </div>
        `,
        render: (html) => {
          const baseMobs = parseInt(formData.mob_count) || 0;
          const buildRows = (count) => {
            const container = html.find("#rnk-scene-rows")[0];
            if (!container) return;
            container.innerHTML = "";
            for (let i = 1; i <= count; i++) {
              const row = document.createElement("div");
              row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #3a3a3a;";
              row.innerHTML = `
                <span style="min-width:62px;font-size:0.85em;color:#aaa;">Scene ${i}</span>
                <label style="font-size:0.82em;white-space:nowrap;">Mobs:</label>
                <input class="rnk-scene-mobs" type="number" min="0" max="200" value="${baseMobs}"
                  style="width:55px;padding:2px 4px;border:1px solid #666;border-radius:3px;">
                <span style="font-size:0.78em;color:#777;">(0=auto)</span>
              `;
              container.appendChild(row);
            }
          };
          buildRows(defaultCount);
          html.find("#rnk-campaign-count").on("change input", (e) => {
            buildRows(Math.max(2, Math.min(20, parseInt(e.target.value) || defaultCount)));
          });
        },
        buttons: {
          generate: {
            icon: '<i class="fas fa-layer-group"></i>',
            label: "Generate Campaign",
            callback: (html) => {
              const count = parseInt(html.find("#rnk-campaign-count").val()) || defaultCount;
              const clamped = Math.max(2, Math.min(20, count));
              const perSceneMobs = [];
              html.find(".rnk-scene-mobs").each((_, el) => perSceneMobs.push(parseInt($(el).val()) || 0));
              this._onGenerateMultiLevel(clamped, formData, perSceneMobs);
            }
          },
          cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
        },
        default: "generate"
      }).render(true);
    });

    // Scene creation
    html.find("[data-action='create-scene']").on("click", async (event) => {
      event.preventDefault();
      if (!this.lastResult) {
        ui.notifications.warn("Generate a dungeon first");
        return;
      }
      if (this.multiLevelResults?.length > 1) {
        const sceneCount = this.multiLevelResults.length;
        // V13+ uses DialogV2; fall back to legacy Dialog for V11/V12
        let confirmed = false;
        if (foundry.applications?.api?.DialogV2?.confirm) {
          confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Create Scenes" },
            content: `<p>This will create and link <strong>${sceneCount} scene${sceneCount !== 1 ? "s" : ""}</strong>. Are you sure?</p>`,
            rejectClose: false,
          });
        } else {
          confirmed = await Dialog.confirm({
            title: "Create Scenes",
            content: `<p>This will create and link <strong>${sceneCount} scene${sceneCount !== 1 ? "s" : ""}</strong>. Are you sure?</p>`,
            yes: () => true, no: () => false, defaultYes: true,
          });
        }
        if (!confirmed) return;
        await this._createMultiLevelScenes();
      } else {
        this._collectSceneOptions();
        await this._createScene();
      }
    });

    // Multi-level preview navigation
    html.find("[data-action='prev-level']").on("click", (event) => {
      event.preventDefault();
      if (!this.multiLevelResults?.length) return;
      this.multiLevelIndex = Math.max(0, this.multiLevelIndex - 1);
      this._updateLevelPreview(html);
    });
    html.find("[data-action='next-level']").on("click", (event) => {
      event.preventDefault();
      if (!this.multiLevelResults?.length) return;
      this.multiLevelIndex = Math.min(this.multiLevelResults.length - 1, this.multiLevelIndex + 1);
      this._updateLevelPreview(html);
    });

    // Utility buttons
    html.find("[data-action='download-png']").on("click", (event) => {
      if (!this.lastResult?.image_png) return;
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${this.lastResult.image_png}`;
      link.download = `rnk-dungeon-${this.lastResult.seed || Date.now()}.png`;
      link.click();
    });

    html.find("[data-action='download-svg']").on("click", (event) => {
      if (!this.lastResult?.image_svg) return;
      const blob = new Blob([this.lastResult.image_svg], { type: 'image/svg+xml' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rnk-dungeon-${this.lastResult.seed || Date.now()}.svg`;
      link.click();
    });

    html.find("[data-action='download-json']").on("click", (event) => {
      if (!this.lastResult) return;
      const dataStr = JSON.stringify(this.lastResult, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `rnk-dungeon-${this.lastResult.seed || Date.now()}.json`;
      link.click();
    });

    html.find("[data-action='copy-json']").on("click", async (event) => {
      event.preventDefault();
      if (!this.lastResult) return;
      if (!navigator.clipboard) {
        ui.notifications.warn("Clipboard access unavailable");
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(this.lastResult, null, 2));
      ui.notifications.info("Full JSON copied to clipboard");
    });

    html.find("[data-action='show-ai-analysis']").on("click", (event) => {
      if (!this.lastResult?.ai_analysis) return;
      this._showAIAnalysis();
    });

    html.find("[data-action='test-connection']").on("click", (event) => {
      event.preventDefault();
      this._testConnection();
    });

    // Collapsible sections
    html.find(".rnk-section__toggle").on("click", (event) => {
      const section = $(event.currentTarget).closest(".rnk-section");
      section.toggleClass("collapsed");
    });

    // Tracker Actions
    html.find("[data-action='ping-room']").on("click", async (event) => {
      const roomId = $(event.currentTarget).closest("[data-room-id]").data("room-id");
      const room = canvas.scene.getFlag(MODULE_NAME, "generationData")?.rooms.find(r => r.id === roomId);
      if (room && room.center) {
        const tileSize = canvas.grid.size;
        canvas.ping({ x: room.center.x * tileSize, y: room.center.y * tileSize });
      }
    });

    html.find("[data-action='trigger-trap']").on("click", (event) => {
      const trapId = $(event.currentTarget).data("trap-id");
      checkTraps(true, trapId); // Force trigger a specific trap
    });

    html.find("[data-action='allocate-item']").on("click", async (event) => {
      const lootId = $(event.currentTarget).data("loot-id");
      await this._allocateLoot(lootId);
    });

    html.find("[data-action='allocate-all']").on("click", async (event) => {
      await this._allocateLoot(null, true);
    });

    html.find("[data-action='toggle-patrol']").on("click", async (event) => {
      const patrolId = $(event.currentTarget).data("patrol-id");
      await this._toggleSentinelPatrol(patrolId);
    });

    // Range input display
    html.find("input[type='range']").on("input", (event) => {
      const display = $(event.currentTarget).siblings(".range-value");
      display.text(event.currentTarget.value);
    });

    if (!this._didFetchPresets) {
      this._fetchPresets();
    }
    if (!this._didTestConnection) {
      this._didTestConnection = true;
      this._testConnection();
    }
  }

  async _onGenerate(formData) {
    if (this._isGenerating) {
      ui.notifications.warn("RNK™: Generation already in progress — please wait.");
      return;
    }
    if (!formData) {
      const form = this.element?.querySelector("form");
      if (!form) return;
      formData = getFormData(form);
    }

    if (!this.patreonAuth?.hasToken?.()) {
      const token = await this.patreonAuth?.login?.();
      if (!token) {
        this._isGenerating = false;
        return;
      }
    }

    // Daily generation limit check (free tier: 3/day) — waived for authenticated Patreon patrons
    const genStatus = this._getDailyGenStatus();
    if (!genStatus.unlimited && genStatus.remaining <= 0) {
      ui.notifications.warn("RNK Free MapGen: Daily limit reached (3/3). Try again tomorrow or upgrade at patreon.com/RagNaroks.");
      this._isGenerating = false;
      return;
    }

    this._isGenerating = true;
    // Single level — clear any existing multi-level preview
    this.multiLevelResults = null;
    this.multiLevelIndex = 0;

    // Save form state for preservation across renders
    this.formState = {
      preset: formData.preset || "classic",
      context: formData.context || "dwarven",
      constraint: formData.constraint || "classic",
      width: Number(formData.width) || 60,
      height: Number(formData.height) || 45,
      seed: formData.seed || "",
      tile_size: formData.tile_size || "12",
      output_format: formData.output_format || "png",
      enable_ai: formData.enable_ai === "on",
      turbo_mode: formData.turbo_mode === "on",
      patrol_count: Number(formData.patrol_count) || 0,
      dungeon_theme: formData.dungeon_theme || "classic_dungeon",
      grid_type: formData.grid_type || "square",
      room_count: Number(formData.room_count) || 15,
      room_size: formData.room_size || "medium",
      corridor_complexity: Number(formData.corridor_complexity) || 5,
      room_variety: Number(formData.room_variety) || 5,
      total_levels: Number(formData.total_levels) || 1,
      // Trap settings
      trap_count: Number(formData.trap_count) || 0,
      trap_difficulty: formData.trap_difficulty || "15",
      trap_type: formData.trap_type || "random",
      trap_radius: Number(formData.trap_radius) || 5,
      trap_waypoint_visible: formData.trap_waypoint_visible === "on",
      trap_scripts_enabled: formData.trap_scripts_enabled === "on",
      // Lighting
      light_color: formData.light_color || "#ffaa55",
      light_intensity: Number(formData.light_intensity) || 0.3,
      light_animation: formData.light_animation || "torch",
      // Sound
      sound_ambient: formData.sound_ambient || "none",
      sound_volume: Number(formData.sound_volume) || 0.5,
      sound_water: formData.sound_water === "on",
      sound_lava: formData.sound_lava === "on",
      // Scene
      scene_name: formData.scene_name || "",
      auto_activate: formData.auto_activate === "on",
      // Mobs
      mob_type: formData.mob_type || "auto",
      mob_density: formData.mob_density || "normal",
      mob_compendium: formData.mob_compendium || "",
      mob_folder: formData.mob_folder || "",
      mob_count: Number(formData.mob_count) || 0,
      spawn_mobs: formData.spawn_mobs === "on" || formData.spawn_mobs == null,
      spawn_boss: formData.spawn_boss === "on",
      spawn_miniboss: formData.spawn_miniboss === "on",
      // Advanced Thematic/Architecture
      corruption_level: Number(formData.corruption_level) || 0,
      decay_intensity: Number(formData.decay_intensity) || 0,
      magical_saturation: Number(formData.magical_saturation) || 0,
      cursed_level: Number(formData.cursed_level) || 0,
      environmental_hazard: formData.environmental_hazard || "none",
      chamber_shape: formData.chamber_shape || "square",
      symmetry_preference: formData.symmetry_preference || "asymmetric",
      verticality_preference: formData.verticality_preference || "flat",
      connection_density: formData.connection_density || "moderate",
      branch_factor: Number(formData.branch_factor) || 5,
      dead_end_frequency: Number(formData.dead_end_frequency) || 5,
      encounter_pacing: formData.encounter_pacing || "spread",
      treasure_density: Number(formData.treasure_density) || 5,
      secret_room_frequency: Number(formData.secret_room_frequency) || 3,
      shadow_intensity: Number(formData.shadow_intensity) || 0.5,
      light_source_density: Number(formData.light_source_density) || 5,
      light_flicker_rate: Number(formData.light_flicker_rate) || 0.3,
      mob_loot_rarity: formData.mob_loot_rarity || "common",
      equipment_quality: formData.equipment_quality || "common",
      loot_compendium: formData.loot_compendium || "",
      loot_folder: formData.loot_folder || "",
      loot_count: Number(formData.loot_count) || 0,
      // Toggles
      create_walls: formData.create_walls === "on" || formData.create_walls == null,
      create_doors: formData.create_doors === "on" || formData.create_doors == null,
      create_lights: formData.create_lights === "on" || formData.create_lights == null,
      create_sounds: formData.create_sounds === "on" || formData.create_sounds == null,
      // Movement
      enable_movement: formData.enable_movement === "on",
      movement_speed: formData.movement_speed || "normal",
      movement_interval: Number(formData.movement_interval) || 10,
      pause_on_combat: formData.pause_on_combat === "on",
      respect_walls: formData.respect_walls === "on" || formData.respect_walls == null,
      avoid_players: formData.avoid_players === "on",
      generate_waypoints: formData.generate_waypoints === "on" || formData.generate_waypoints == null,
      // Accessibility
      accessibility_difficulty_ramps: formData.accessibility_difficulty_ramps === "on",
      accessibility_tutorial_markers: formData.accessibility_tutorial_markers === "on",
      accessibility_wheelchair_paths: formData.accessibility_wheelchair_paths === "on",
      accessibility_safe_zones: formData.accessibility_safe_zones === "on",
      patreon_token: this.patreonAuth?.getToken?.() || "",
      module_tier: MODULE_TIER,
    };

    const payload = {
      preset: this.formState.preset,
      context: this.formState.context,
      constraint: this.formState.constraint,
      width: this.formState.width,
      height: this.formState.height,
      grid_type: this.formState.grid_type,
      seed: this.formState.seed ? Number(this.formState.seed) : null,
      tile_size: Number(this.formState.tile_size),
      texture_style: themeTextures(this.formState.dungeon_theme).style,
      output_format: this.formState.output_format,
      enable_ai: this.formState.enable_ai,
      turbo_mode: this.formState.turbo_mode,
      patrol_count: this.formState.patrol_count,
      dungeon_theme: this.formState.dungeon_theme,
      room_count: this.formState.room_count,
      room_size: this.formState.room_size,
      corridor_complexity: this.formState.corridor_complexity,
      room_variety: this.formState.room_variety,
      total_levels: this.formState.total_levels,
      trap_count: Number(this.formState.trap_count) || 0,
      mob_type: this.formState.mob_type,
      mob_density: this.formState.mob_density,
      spawn_boss: this.formState.spawn_boss,
      spawn_miniboss: this.formState.spawn_miniboss,
      mob_compendium: this.formState.mob_compendium,
      // Pass the new advanced parameters
      corruption_level: this.formState.corruption_level,
      decay_intensity: this.formState.decay_intensity,
      magical_saturation: this.formState.magical_saturation,
      cursed_level: this.formState.cursed_level,
      environmental_hazard: this.formState.environmental_hazard,
      chamber_shape: this.formState.chamber_shape,
      symmetry_preference: this.formState.symmetry_preference,
      verticality_preference: this.formState.verticality_preference,
      connection_density: this.formState.connection_density,
      branch_factor: this.formState.branch_factor,
      dead_end_frequency: this.formState.dead_end_frequency,
      encounter_pacing: this.formState.encounter_pacing,
      treasure_density: this.formState.treasure_density,
      secret_room_frequency: this.formState.secret_room_frequency,
      shadow_intensity: this.formState.shadow_intensity,
      light_source_density: this.formState.light_source_density,
      light_flicker_rate: this.formState.light_flicker_rate,
      mob_loot_rarity: this.formState.mob_loot_rarity,
      equipment_quality: this.formState.equipment_quality,
      loot_compendium: this.formState.loot_compendium,
      loot_folder: this.formState.loot_folder,
      loot_count: this.formState.loot_count,
      // Pass the creation toggles to the backend
      create_walls: this.formState.create_walls,
      create_doors: this.formState.create_doors,
      create_lights: this.formState.create_lights,
      create_sounds: this.formState.create_sounds,
      // Pass the specific trap type
      trap_type: this.formState.trap_type,
      // Use arrays for floor/wall textures as expected by the backend
      floor_textures: [themeTextures(this.formState.dungeon_theme).floor],
      wall_textures: [themeTextures(this.formState.dungeon_theme).wall],
      // Accessibility
      accessibility_difficulty_ramps: this.formState.accessibility_difficulty_ramps,
      accessibility_tutorial_markers: this.formState.accessibility_tutorial_markers,
      accessibility_wheelchair_paths: this.formState.accessibility_wheelchair_paths,
      accessibility_safe_zones: this.formState.accessibility_safe_zones,
    };

    const data = await this._requestDungeon(payload);
    this._isGenerating = false;
    if (data) {
      this.lastResult = data;
      this._incrementDailyGen();
      this.render();
    }
  }

  async _onGenerateMultiLevel(levelCount, formData, perSceneMobs = []) {
    if (this._isGenerating) {
      ui.notifications.warn("RNK™: Generation already in progress — please wait.");
      return;
    }
    if (!formData) {
      const form = this.element?.querySelector("form");
      if (!form) return;
      formData = getFormData(form);
    }

    if (!this.patreonAuth?.hasToken?.()) {
      const token = await this.patreonAuth?.login?.();
      if (!token) {
        this._isGenerating = false;
        return;
      }
    }

    this._isGenerating = true;
    const baseSeed = formData.seed ? Number(formData.seed) : Math.floor(Math.random() * 1000000);
    const baseCr = parseInt(formData.mob_challenge) || 3;
    const baseDensity = formData.mob_density || "normal";
    const densities = ["sparse", "normal", "dense", "swarm"];
    const densityIdx = densities.indexOf(baseDensity);

    ui.notifications.info(`Generating ${levelCount} levels for preview...`);

    this.multiLevelResults = [];
    this.multiLevelIndex = 0;

    try {
    for (let i = 0; i < levelCount; i++) {
        const crSteps = [1, 3, 6, 9, 13];
        let crIdx = crSteps.indexOf(baseCr);
        if (crIdx === -1) crIdx = 1;
        const currentCr = crSteps[Math.min(crIdx + i, crSteps.length - 1)];
        const currentDensity = densities[Math.min(densityIdx + Math.floor(i/2), densities.length - 1)];

        const payload = {
            preset: formData.preset || "classic",
            context: formData.context || "dwarven",
            constraint: formData.constraint || "classic",
            width: Math.min((Number(formData.width) || 60) + (i * 5), 500),
            height: Math.min((Number(formData.height) || 45) + (i * 5), 500),
            grid_type: formData.grid_type || 'square',
            seed: baseSeed + i,
            tile_size: Number(formData.tile_size) || 12,
            texture_style: themeTextures(formData.dungeon_theme || "classic_dungeon").style,
            output_format: "png",
            enable_ai: formData.enable_ai === "on",
            turbo_mode: formData.turbo_mode === "on",
            patrol_count: Number(formData.patrol_count) || 0,
            dungeon_theme: formData.dungeon_theme || "classic_dungeon",
            room_count: Number(formData.room_count) || 15,
            room_size: formData.room_size || "medium",
            corridor_complexity: Number(formData.corridor_complexity) || 5,
            room_variety: Number(formData.room_variety) || 5,
            total_levels: 1,
            trap_count: Number(formData.trap_count) || 10,
            mob_type: formData.mob_type || "auto",
            mob_density: currentDensity,
            spawn_boss: i === levelCount - 1,
            spawn_miniboss: formData.spawn_miniboss === "on",
            mob_compendium: formData.mob_compendium || "",
            floor_textures: [themeTextures(formData.dungeon_theme || "classic_dungeon").floor],
            wall_textures: [themeTextures(formData.dungeon_theme || "classic_dungeon").wall],
            patreon_token: this.patreonAuth?.getToken?.() || "",
            module_tier: MODULE_TIER,
        };

        const data = await this._requestDungeon(payload);
        if (data) {
            this._collectSceneOptions(formData);
            this._sceneOptions.mobChallenge = currentCr.toString();
            this._sceneOptions.mobDensity = currentDensity;
            // Apply per-scene mob count: use individual value if provided, else fall back to formData.mob_count
            const sceneMobCount = perSceneMobs[i] !== undefined ? perSceneMobs[i] : (parseInt(formData.mob_count) || 0);
            this._sceneOptions.mobCount = sceneMobCount;
            this._sceneOptions.sceneName = `Level ${i + 1}: ${formData.dungeon_theme || "Dungeon"} (CR ${currentCr})`;
            this.multiLevelResults.push({
                data,
                sceneOptions: { ...this._sceneOptions }
            });
        }
    }
    } finally {
      this._isGenerating = false;
    }

    if (this.multiLevelResults.length > 0) {
        this.lastResult = this.multiLevelResults[0].data;
        this.render();
        ui.notifications.info(`${this.multiLevelResults.length} levels ready — use ◀ ▶ to preview each, then hit CREATE to place them all.`);
    }
  }

  _updateLevelPreview(html) {
    const entry = this.multiLevelResults?.[this.multiLevelIndex];
    if (!entry) return;
    this.lastResult = entry.data;
    const idx = this.multiLevelIndex;
    const total = this.multiLevelResults.length;
    // Update image
    html.find(".rnk-preview-image").attr("src", `data:image/png;base64,${entry.data.image_png}`);
    // Update level counter
    html.find(".rnk-level-counter").text(`Level ${idx + 1} / ${total}`);
    // Update info row
    html.find(".rnk-preview-info .info-rooms").text(`${entry.data.rooms?.length ?? 0} Rooms`);
    html.find(".rnk-preview-info .info-passages").text(`${entry.data.passages?.length ?? 0} Passages`);
    html.find(".rnk-preview-info .info-seed").text(entry.data.seed);
    // Update button states
    html.find("[data-action='prev-level']").prop("disabled", idx === 0);
    html.find("[data-action='next-level']").prop("disabled", idx === total - 1);
  }

  async _createMultiLevelScenes() {
    if (!this.multiLevelResults?.length) return;
    ui.notifications.info(`Creating ${this.multiLevelResults.length} linked scenes...`);
    const created = [];
    for (let i = 0; i < this.multiLevelResults.length; i++) {
        const { data, sceneOptions } = this.multiLevelResults[i];
        this.lastResult = data;
        this._sceneOptions = { ...sceneOptions };
        const skipActivate = (i > 0);
        const scene = await this._createScene(skipActivate);
        if (scene) created.push({ data, scene });
    }
    if (created.length > 1) await this._linkScenes(created);
    this.multiLevelResults = null;
    this.multiLevelIndex = 0;
    ui.notifications.info(`Successfully created and linked ${created.length} levels!`);
  }

  async _linkScenes(results) {
    // Get or create a shared portal JournalEntry so notes are visible + clickable in V12/V13
    // (Foundry V12+ ignores clicks on notes with entryId: null)
    let portalEntry = game.journal?.find(j => j.getFlag(MODULE_NAME, "isPortalEntry"));
    if (!portalEntry) {
      try {
        portalEntry = await JournalEntry.create({
          name: "RNK Portal",
          content: "<p>RNK scene link — double-click the stair icon to travel between levels.</p>",
          flags: { [MODULE_NAME]: { isPortalEntry: true } }
        });
      } catch (e) {
        console.warn("RNK | Could not create portal journal entry:", e);
      }
    }

    for (let i = 0; i < results.length - 1; i++) {
        const levelA = results[i];
        const levelB = results[i+1];
        
        // Find Exit in Level A and Entrance in Level B
        const exitPos = this._findTilePosition(levelA.data.geometry.grid, [TILE.EXIT, TILE.STAIRS_DOWN]);
        const entrancePos = this._findTilePosition(levelB.data.geometry.grid, [TILE.ENTRANCE, TILE.STAIRS_UP]);

        if (exitPos && entrancePos) {
            const tileSize = levelA.scene.grid.size;
            const tileSizeB = levelB.scene.grid.size;

            const xA = exitPos.x * tileSize + (tileSize / 2);
            const yA = exitPos.y * tileSize + (tileSize / 2);
            const xB = entrancePos.x * tileSizeB + (tileSizeB / 2);
            const yB = entrancePos.y * tileSizeB + (tileSizeB / 2);

            // --- Map note: stairs down in Level A ---
            await levelA.scene.createEmbeddedDocuments("Note", [{
                active: true,
                entryId: portalEntry?.id ?? null,
                fontSize: 24,
                icon: "/icons/svg/downstairs.svg",
                iconSize: tileSize,
                text: `▼ Level ${i + 2}`,
                textColor: "#FFDD88",
                x: xA,
                y: yA,
                global: false,
                flags: {
                    [MODULE_NAME]: {
                        type: "sceneLink",
                        targetScene: levelB.scene.id,
                        targetX: xB,
                        targetY: yB,
                    }
                }
            }]);

            // --- Map note: stairs up in Level B ---
            await levelB.scene.createEmbeddedDocuments("Note", [{
                active: true,
                entryId: portalEntry?.id ?? null,
                fontSize: 24,
                icon: "/icons/svg/upstairs.svg",
                iconSize: tileSizeB,
                text: `▲ Level ${i + 1}`,
                textColor: "#AADDFF",
                x: xB,
                y: yB,
                global: false,
                flags: {
                    [MODULE_NAME]: {
                        type: "sceneLink",
                        targetScene: levelA.scene.id,
                        targetX: xA,
                        targetY: yA,
                    }
                }
            }]);

            // --- Stair tiles for visual overlay ---
            await levelA.scene.createEmbeddedDocuments("Tile", [{
                texture: { src: "/icons/svg/downstairs.svg" },
                x: exitPos.x * tileSize,
                y: exitPos.y * tileSize,
                width: tileSize,
                height: tileSize,
                alpha: 0.85,
                hidden: false,
                flags: { "rnk-free-mapgen": { type: "stairTile", targetScene: levelB.scene.id } }
            }]);

            await levelB.scene.createEmbeddedDocuments("Tile", [{
                texture: { src: "/icons/svg/upstairs.svg" },
                x: entrancePos.x * tileSizeB,
                y: entrancePos.y * tileSizeB,
                width: tileSizeB,
                height: tileSizeB,
                alpha: 0.85,
                hidden: false,
                flags: { "rnk-free-mapgen": { type: "stairTile", targetScene: levelA.scene.id } }
            }]);
        }
    }
  }

  _findTilePosition(grid, tileTypes) {
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            if (tileTypes.includes(grid[y][x])) {
                return { x, y };
            }
        }
    }
    return null;
  }

  _collectSceneOptions(formData) {
    if (!formData) {
      const form = this.element?.querySelector("form");
      if (form) formData = getFormData(form);
    }
    
    if (!formData) return;

    // Preserve form state for UI consistency
    this.formState = {
      ...this.formState,
      grid_size: formData.grid_size || "70",
      create_walls: formData.create_walls || "",
      create_doors: formData.create_doors || "",
      create_lights: formData.create_lights || "",
      create_sounds: formData.create_sounds || "",
      darkness: formData.darkness || "0.5",
      light_color: formData.light_color || "#ffaa55",
      light_intensity: formData.light_intensity || "0.3",
      light_animation: formData.light_animation || "torch",
      sound_ambient: formData.sound_ambient || "none",
      sound_volume: formData.sound_volume || "0.5",
      sound_water: formData.sound_water || "",
      sound_lava: formData.sound_lava || "",
      scene_name: formData.scene_name || "",
      auto_activate: formData.auto_activate || "",
      spawn_mobs: formData.spawn_mobs || "",
      mob_density: formData.mob_density || "normal",
      mob_challenge: formData.mob_challenge || "3",
      mob_type: formData.mob_type || "auto",
      spawn_boss: formData.spawn_boss || "",
      spawn_miniboss: formData.spawn_miniboss || "",
      mob_compendium: formData.mob_compendium || "",
      enable_movement: formData.enable_movement || "",
      movement_speed: formData.movement_speed || "normal",
      movement_interval: formData.movement_interval || "10",
      pause_on_combat: formData.pause_on_combat || "",
      respect_walls: formData.respect_walls || "",
      avoid_players: formData.avoid_players || "",
      generate_waypoints: formData.generate_waypoints || "",
      trap_count: Number(formData.trap_count) || 0,
      trap_radius: formData.trap_radius || "5",
      trap_difficulty: formData.trap_difficulty || "15",
      trap_type: formData.trap_type || "random",
      trap_waypoint_visible: formData.trap_waypoint_visible || "",
      trap_scripts_enabled: formData.trap_scripts_enabled || "",
      patrol_count: formData.patrol_count || "0",
    };

    this._sceneOptions = {
      gridSize: Number(formData.grid_size) || 70,
      createWalls: formData.create_walls === "on",
      createDoors: formData.create_doors === "on",
      createLights: formData.create_lights === "on",
      createSounds: formData.create_sounds === "on",
      darkness: Number(formData.darkness) || 0.5,
      lightColor: formData.light_color || "#ffaa55",
      lightIntensity: Number(formData.light_intensity) || 0.3,
      lightAnimation: formData.light_animation || "torch",
      soundAmbient: formData.sound_ambient || "none",
      soundVolume: Number(formData.sound_volume) || 0.5,
      soundWater: formData.sound_water === "on",
      soundLava: formData.sound_lava === "on",
      sceneName: formData.scene_name || "",
      autoActivate: formData.auto_activate === "on",
      spawnMobs: formData.spawn_mobs === "on",
      mobDensity: formData.mob_density || "normal",
      mobChallenge: formData.mob_challenge || "3",
      mobType: formData.mob_type || "auto",
      mobCompendium: formData.mob_compendium || "",
      mobFolder: formData.mob_folder || "",
      mobCount: Number(formData.mob_count) || 0,
      spawnBoss: formData.spawn_boss === "on",
      spawnMiniboss: formData.spawn_miniboss === "on",
      enableMovement: formData.enable_movement === "on",
      movementSpeed: formData.movement_speed || "normal",
      movementInterval: Number(formData.movement_interval) || 10,
      pauseOnCombat: formData.pause_on_combat === "on",
      respectWalls: formData.respect_walls === "on",
      avoidPlayers: formData.avoid_players === "on",
      generateWaypoints: formData.generate_waypoints === "on",
      trapCount: Number(formData.trap_count) || 0,
      trapRadius: Number(formData.trap_radius) || 5, // ft
      trapDifficulty: formData.trap_difficulty || "15",
      trapType: formData.trap_type || "random",
      trapWaypointVisible: formData.trap_waypoint_visible === "on",
      trapScriptsEnabled: formData.trap_scripts_enabled === "on",
      patrolCount: Number(formData.patrol_count) || 0,
      // Loot
      lootCompendium: formData.loot_compendium || "",
      lootFolder: formData.loot_folder || "",
      lootCount: Number(formData.loot_count) || 0,
      lootRarity: formData.mob_loot_rarity || "common",
      treasureDensity: Number(formData.treasure_density) || 5,
    };
  }

  async _toggleSentinelPatrol(patrolId) {
    if (!game.rnkSentinel) return;
    const scene = canvas.scene;
    if (!scene) return;

    const patrols = duplicate(scene.getFlag(MODULE_NAME, "scenePatrolData") || []);
    const patrol = patrols.find(p => p.id === patrolId);
    
    if (patrol) {
      patrol.active = !patrol.active;
      await scene.setFlag(MODULE_NAME, "scenePatrolData", patrols);
      ui.notifications.info(`${patrol.name} is now ${patrol.active ? 'Active' : 'Paused'}`);
      this.render();
    }
  }

  async _fetchPresets() {
    if (this._didFetchPresets) return;
    this._didFetchPresets = true;

    const url = this._presetsEndpoint();
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status === 404) {
        console.warn("RNK Free MapGen: presets endpoint unavailable; using bundled presets.");
        return;
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      
      // Smart merging: Keep our rich hardcoded list but add anything new from the server
      const merge = (local, remote) => {
        const merged = [...new Set([...(local || []), ...(remote || [])])];
        // Ensure procedural_ and asset_ prefixes are handled or added if missing from server
        return merged;
      };
      
      this.presets.intent = merge(this.presets.intent, data.intent);
      this.presets.context = merge(this.presets.context, data.context);
      this.presets.constraints = merge(this.presets.constraints, data.constraints);
      this.presets.output_formats = merge(this.presets.output_formats, data.output_formats);
      
      // Special handling for texture styles to ensure grouping logic works
      if (data.texture_styles) {
        const serverStyles = data.texture_styles.map(s => {
          if (!s.startsWith("procedural_") && !s.startsWith("asset_")) {
             return "procedural_" + s; // Default naked server styles to procedural
          }
          return s;
        });
        this.presets.texture_styles = merge(this.presets.texture_styles, serverStyles);
      }
      
      this.render();
    } catch (err) {
      console.warn("RNK Free MapGen: Failed to fetch presets; using bundled presets.", err);
    }
  }

  async _testConnection() {
    const html = $(this.element);
    const statusElem = html.find("[data-status]");
    const indicator = html.find(".status-indicator");
    const url = this._generateEndpoint();

    statusElem?.text("Checking...");
    indicator?.removeClass("online offline").addClass("checking");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.status === 404) throw new Error("Generator unreachable");
      this.serverStatus = "Online";
      statusElem?.text("Online");
      indicator?.removeClass("checking offline").addClass("online");
    } catch (err) {
      console.error("Generator test failed", err);
      this.serverStatus = "Offline";
      statusElem?.text("Offline");
      indicator?.removeClass("checking online").addClass("offline");

      // Specific advice for PNA (Private Network Access) errors in secure contexts
      if (window.location.protocol === "https:" && (url.includes("192.168.") || url.includes("127.0.0.1") || url.includes("localhost"))) {
        ui.notifications.error(`<b>RNK MapGen: Connection blocked.</b><br>You are accessing Foundry via HTTPS, but the generator is on a local IP (${url}). Browsers block this for security.<br><br><b>Recommended Fix:</b> Set "Generator API URL" to <code>https://mapgen-api.rnkstudios.uk/api/generate</code> in Module Settings.`, {permanent: true});
      }
    }
  }

  _resolveApiEndpoint(kind = "generate") {
    try {
      let raw = game.settings.get(MODULE_NAME, "apiEndpoint") || DEFAULT_ENDPOINT;

      const isLocalIp = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(raw);
      if (window.location.protocol === "https:" && raw.startsWith("http://") && !isLocalIp) {
        raw = raw.replace("http://", "https://");
      }

      const url = new URL(raw);
      const route = kind === "presets" ? "presets" : "generate";
      const pathname = url.pathname.replace(/\/+$/, "");

      if (!pathname || pathname === "/") {
        url.pathname = `/api/${route}`;
      } else if (/\/api\/(generate|presets)$/.test(pathname)) {
        url.pathname = pathname.replace(/\/api\/(generate|presets)$/, `/api/${route}`);
      } else if (/\/api$/.test(pathname)) {
        url.pathname = `${pathname}/${route}`;
      } else if (pathname.includes("/api/")) {
        url.pathname = pathname.replace(/\/api\/[^/]+$/, `/api/${route}`);
      } else {
        url.pathname = `${pathname}/api/${route}`;
      }

      return url.toString().replace(/\/$/, "");
    } catch {
      const base = DEFAULT_ENDPOINT.replace(/\/api\/generate$/, "");
      return `${base}/api/${kind === "presets" ? "presets" : "generate"}`;
    }
  }

  _generateEndpoint() {
    return this._resolveApiEndpoint("generate");
  }

  _baseApiUrl() {
    try {
      const configured = this._resolveApiEndpoint("generate");
      const url = new URL(configured);
      return url.origin;
    } catch {
      return "";
    }
  }

  _presetsEndpoint() {
    return this._resolveApiEndpoint("presets");
  }

  _getDailyGenStatus() {
    const FREE_LIMIT = 3;
    // The 3/day cap only applies to unauthenticated free access. Any
    // authenticated Patreon tier (alpha/core/architect) is unlimited here —
    // the free module's local cap should never override real Patreon access.
    const hasPaidAccess = (this.patreonAuth?.getTierRank?.() ?? 0) > 0;
    if (hasPaidAccess) {
      return { used: 0, remaining: FREE_LIMIT, limit: FREE_LIMIT, unlimited: true, stored: null };
    }
    const now = Date.now();
    let stored = game.settings.get(MODULE_NAME, "dailyGenerations");
    if (!stored || now > stored.resetAt) {
      stored = { count: 0, resetAt: now + 86400000 };
      game.settings.set(MODULE_NAME, "dailyGenerations", stored);
    }
    return { used: stored.count, remaining: FREE_LIMIT - stored.count, limit: FREE_LIMIT, unlimited: false, stored };
  }

  _incrementDailyGen() {
    const status = this._getDailyGenStatus();
    if (status.unlimited) return;
    game.settings.set(MODULE_NAME, "dailyGenerations", { count: status.used + 1, resetAt: status.stored.resetAt });
  }

  async _requestDungeon(payload) {
    const html = $(this.element);
    const statusBar = html.find(".rnk-status-bar");
    const progressFill = statusBar.find(".progress-fill");
    const statusText = statusBar.find(".status-text");

    statusBar.addClass("active");
    progressFill.css("width", "30%");
    statusText.text("Generating dungeon...");

    try {
      const endpoint = this._generateEndpoint();
      const authToken = this.patreonAuth?.getToken?.() || "";
      const headers = { "Content-Type": "application/json" };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      progressFill.css("width", "70%");

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 401 || response.status === 403) {
          ui.notifications.warn("RNK Free MapGen: Patreon access is required for this generation.");
        } else if (response.status === 429) {
          ui.notifications.warn("RNK Free MapGen: Daily quota reached. Try again tomorrow or upgrade tiers.");
        }
        throw new Error(`${response.status}: ${text}`);
      }

      const data = await response.json();

      progressFill.css("width", "100%");
      const patrolCount = data.patrols ? (Array.isArray(data.patrols) ? data.patrols.length : Object.keys(data.patrols).length) : 0;
      let statusMsg = `Generated! ${data.rooms.length} rooms, ${data.passages.length} passages`;
      if (patrolCount > 0) statusMsg += `, ${patrolCount} patrols`;
      if (data.ai_analysis) {
        const clusters = data.ai_analysis.clusters?.length || 0;
        const suggestions = data.ai_analysis.optimization_suggestions?.length || 0;
        statusMsg += ` | AI: ${clusters} clusters, ${suggestions} suggestions`;
      }
      statusText.text(statusMsg);

      return data;

    } catch (err) {
      console.error(err);
      progressFill.css("width", "100%").addClass("error");
      statusText.text("Generation failed");
      ui.notifications.error("RNK Free MapGen: " + err.message);
      return null;
    } finally {
      setTimeout(() => {
        const h = $(this.element);
        h.find(".rnk-status-bar").removeClass("active");
        h.find(".progress-fill").css("width", "0%").removeClass("error");
      }, 2000);
    }
  }

  _showAIAnalysis() {
    const analysis = this.lastResult?.ai_analysis;
    if (!analysis) return;

    let content = `<h2>AI Dungeon Analysis</h2>`;

    if (analysis.clusters && analysis.clusters.length > 0) {
      content += `<h3>Room Clustering (${analysis.clusters.length} clusters found)</h3>`;
      content += `<p>Rooms have been grouped by size and position similarity.</p>`;
    }

    if (analysis.optimization_suggestions && analysis.optimization_suggestions.length > 0) {
      content += `<h3>Optimization Suggestions</h3>`;
      content += `<ul>`;
      analysis.optimization_suggestions.forEach(suggestion => {
        content += `<li>${suggestion}</li>`;
      });
      content += `</ul>`;
    }

    if (analysis.room_features) {
      content += `<h3>Room Statistics</h3>`;
      content += `<p>Analyzed ${analysis.room_features.length} rooms with features: size, position, and area.</p>`;
    }

    rnkDialog({
      title: "AI Dungeon Analysis",
      content: content,
      buttons: {
        close: {
          label: "Close",
          callback: () => {}
        }
      },
      default: "close"
    }).render(true);
  }

  /**
   * Allocate loot items to players/actors.
   */
  async _allocateLoot(lootId, allocateAll = false) {
    const scene = canvas.scene;
    const genData = scene.getFlag(MODULE_NAME, "generationData");
    if (!genData || !genData.rooms) return;

    // Find items to allocate
    let itemsToAllocate = [];
    if (allocateAll) {
      itemsToAllocate = genData.rooms.reduce((acc, r) => acc.concat(r.loot || []), []).filter(l => !l.allocated);
    } else {
      const item = genData.rooms.reduce((acc, r) => acc.concat(r.loot || []), []).find(l => l.id === lootId);
      if (item) itemsToAllocate = [item];
    }

    if (itemsToAllocate.length === 0) {
      ui.notifications.warn("No unallocated loot found.");
      return;
    }

    // Select recipient
    const actors = game.actors.filter(a => a.hasPlayerOwner);
    if (actors.length === 0) {
      ui.notifications.warn("No player-owned actors found to receive loot.");
      return;
    }

    const actorOptions = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    
    const dialogContent = `
      <form>
        <div class="form-group">
          <label>Recipient:</label>
          <select name="actorId">${actorOptions}</select>
        </div>
        <p>Assigning ${itemsToAllocate.length} item(s) to the selected character.</p>
      </form>
    `;

    rnkDialog({
      title: "Allocate Loot",
      content: dialogContent,
      buttons: {
        allocate: {
          icon: '<i class="fas fa-check"></i>',
          label: "Confirm Allocation",
          callback: async (html) => {
            const actorId = html.find('[name="actorId"]').val();
            const actor = game.actors.get(actorId);

            // Update flags
            const updatedRooms = JSON.parse(JSON.stringify(genData.rooms));
            for (const room of updatedRooms) {
              if (!room.loot) continue;
              for (const item of room.loot) {
                if (allocateAll) {
                  if (!item.allocated) {
                    item.allocated = true;
                    item.allocatedTo = actor.name;
                  }
                } else if (item.id === lootId) {
                  item.allocated = true;
                  item.allocatedTo = actor.name;
                }
              }
            }

            await scene.setFlag(MODULE_NAME, "generationData", { ...genData, rooms: updatedRooms });
            
            // Re-render hub to show changes
            this.render();
            ui.notifications.info(`Allocated ${itemsToAllocate.length} items to ${actor.name}`);
          }
        },
        cancel: { label: "Cancel" }
      }
    }).render(true);
  }

  // =========================================================================
  // SCENE CREATION
  // =========================================================================

  async _createScene(skipActivate = false) {
    const result = this.lastResult;
    if (!result) return;

    const opts = this._sceneOptions;
    const html = $(this.element);
    const statusBar = html.find(".rnk-status-bar");
    const progressFill = statusBar.find(".progress-fill");
    const statusText = statusBar.find(".status-text");

    statusBar.addClass("active");
    let progress = 0;

    const updateProgress = (pct, msg) => {
      progress = pct;
      progressFill.css("width", `${pct}%`);
      statusText.text(msg);
    };

    try {
      const tileSize = opts.gridSize;
      const geometry = result.geometry;
      const gridWidth = geometry.width;
      const gridHeight = geometry.height;
      const gridType = geometry.grid_type || 'square';

      // 1. Upload image
      updateProgress(10, "Uploading image...");
      const imagePath = await this._uploadImage(result.image_png, result.seed);

      // 2. Create scene
      updateProgress(30, "Creating scene...");
      const sceneName = opts.sceneName || `RNK Dungeon ${result.seed || Date.now()}`;
      const sceneData = {
        name: sceneName,
        width: gridWidth * tileSize,
        height: gridHeight * tileSize,
        grid: { size: tileSize, type: gridType === 'hex' ? 2 : 1 },
        background: { src: imagePath },
        padding: 0,
        initial: {
          x: (gridWidth * tileSize) / 2,
          y: (gridHeight * tileSize) / 2,
          scale: 0.5,
        },
        globalLight: false,
        darkness: opts.darkness,
      };

      const scene = await Scene.create(sceneData);

      // 3. Create walls
      if (opts.createWalls) {
        updateProgress(50, "Creating walls...");
        const walls = this._generateWalls(geometry.grid, tileSize, geometry.grid_type || 'square');
        if (walls.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < walls.length; i += chunkSize) {
            const chunk = walls.slice(i, i + chunkSize);
            await scene.createEmbeddedDocuments("Wall", chunk);
            updateProgress(50 + (i / walls.length) * 15, `Creating walls... ${Math.min(i + chunkSize, walls.length)}/${walls.length}`);
          }
        }
      }

      // 4. Create doors
      if (opts.createDoors) {
        updateProgress(70, "Creating doors...");
        const doors = this._generateDoors(geometry.grid, tileSize);
        if (doors.length > 0) {
          await scene.createEmbeddedDocuments("Wall", doors);
        }
      }

      // 5. Create lights
      if (opts.createLights) {
        updateProgress(80, "Creating lights...");
        const lights = this._generateLights(geometry.rooms, tileSize, opts);
        if (lights.length > 0) {
          await scene.createEmbeddedDocuments("AmbientLight", lights);
        }
      }

      // 6. Create sounds
      if (opts.createSounds) {
        updateProgress(90, "Creating sounds...");
        const sounds = await this._generateSounds(geometry, tileSize, opts);
        if (sounds.length > 0) {
          await scene.createEmbeddedDocuments("AmbientSound", sounds);
        }
      }

      // 6.75 Generate Traps
      if (opts.trapCount > 0) {
        updateProgress(91, "Placing traps...");
        const traps = await this._generateTraps(result, geometry, tileSize, opts);
        if (traps.length > 0) {
          // Store as high-fidelity Waypoints in Scene Flags
          await scene.setFlag(MODULE_NAME, "traps", traps);

          // Also create real (hidden) Tile documents so GMs can see and drag traps to reposition them.
          // hidden:true → visible to GM (dimmed), invisible to players.  locked:false → draggable.
          const trapTileData = traps.map(t => ({
            texture: { src: this._getTrapIcon(t.type) },
            x: t.x - tileSize / 2,
            y: t.y - tileSize / 2,
            width: tileSize,
            height: tileSize,
            alpha: 0.75,
            hidden: true,
            locked: false,
            overhead: false,
            flags: {
              [MODULE_NAME]: {
                isTrapMarker: true,
                trapId: t.id ?? (t.x + "_" + t.y),
              }
            }
          }));
          await scene.createEmbeddedDocuments("Tile", trapTileData);

          // If this is the active scene, load and render the PIXI overlay immediately
          if (canvas.scene?.id === scene.id) {
            loadSceneTraps();
            renderSceneTraps();
          }
        }
      }

      // 6.85 Generate Sentinel Patrols
      const patrolsDataRaw = result.patrols || geometry.patrols;
      if (patrolsDataRaw) {
        const patrolsData = Array.isArray(patrolsDataRaw) ? patrolsDataRaw : Object.values(patrolsDataRaw);
        
        if (patrolsData.length > 0) {
          updateProgress(91.2, "Initializing sentinel patrols...");
          const waypoints = {};
          const patrols = {};

          for (const pData of patrolsData) {
            const waypointIds = [];
            
            // Create waypoints for this patrol
            for (let i = 0; i < pData.waypoints.length; i++) {
              const wp = pData.waypoints[i];
              
              // Validate waypoint is within grid and on valid floor tile
              const gridX = wp.x;
              const gridY = wp.y;
              
              // Check bounds first
              if (gridX < 0 || gridY < 0 || gridX >= geometry.grid[0].length || gridY >= geometry.grid.length) {
                console.warn(`RNK Free MapGen: Waypoint out of bounds at (${gridX}, ${gridY}), skipping.`);
                continue;
              }
              
              // Check if tile is walkable (not void/wall/door)
              const tileType = geometry.grid[gridY][gridX];
              const validTiles = [
                TILE.FLOOR,
                TILE.WATER,
                TILE.LAVA,
                TILE.PIT,
                TILE.STAIRS_UP,
                TILE.STAIRS_DOWN,
                TILE.ENTRANCE,
                TILE.EXIT
              ];
              
              if (!validTiles.includes(tileType)) {
                console.warn(`RNK Free MapGen: Waypoint on invalid tile (${tileType}) at (${gridX}, ${gridY}), skipping.`);
                continue;
              }
              
              const wpId = foundry.utils.randomID();
              waypointIds.push(wpId);
              
              waypoints[wpId] = {
                id: wpId,
                name: `${pData.name} - Point ${i + 1}`,
                x: wp.x * tileSize,
                y: wp.y * tileSize,
                sceneId: scene.id,
                flags: { "rnk-free-mapgen": { patrolId: pData.id } }
              };
            }

            // Define the patrol linking these waypoints
            patrols[pData.id] = {
              id: pData.id,
              name: pData.name,
              waypoints: waypointIds,
              mode: pData.mode || "teleport", // teleport or walk
              active: true,
              currentPoint: 0,
              waitTime: 3000,
              tokenImg: "/icons/svg/eye.svg" // Default sentinel eye icon
            };
          }

          // Save to RNK Sentinel via Scene Flags
          if (Object.keys(waypoints).length > 0) {
            await scene.setFlag(MODULE_NAME, "waypoints", waypoints);
            await scene.setFlag(MODULE_NAME, "scenePatrolData", patrols);
            
            ui.notifications.info(`Initialized ${Object.keys(patrols).length} Sentinel rituals for this scene.`);
          }
        }
      }

      // 7. Create Room Labels (GM Only)
      updateProgress(91.5, "Creating room labels...");
      const drawings = [];
      for (const room of geometry.rooms) {
        if (!room.name) continue;
        
        drawings.push({
          type: "t",
          x: room.center.x * tileSize,
          y: room.center.y * tileSize,
          shape: {
            width: 200,
            height: 40
          },
          text: room.name,
          fontSize: 32,
          textColor: "#ffffff",
          textAlpha: 0.8,
          fillColor: "#000000",
          fillAlpha: 0.4,
          strokeColor: "#000000",
          strokeAlpha: 1,
          strokeWidth: 2,
          hidden: true  // This makes it GM-only by default in some views, but better to use flags if needed
        });
      }
      if (drawings.length > 0) {
        await scene.createEmbeddedDocuments("Drawing", drawings);
      }

      // 7.5 Store generation data for GM Hub Tracker
      await scene.setFlag(MODULE_NAME, "generationData", {
        rooms: geometry.rooms,
        traps: result.traps || [],
        loot: geometry.rooms.reduce((acc, r) => acc.concat(r.loot || []), [])
      });

      // 8. Create tokens (MOB GENERATION) and props
      updateProgress(92, "Creating tokens and props...");
      if (result.props && result.props.length > 0) {
        const tokens = [];
        const tiles = [];
        
        for (const prop of result.props) {
          // Centered in tile
          // Grid coordinates are 0-indexed tiles. Token/Tile coords are pixels.
          const x = prop.position.x * tileSize;
          const y = prop.position.y * tileSize;
          
          if (prop.category === "NPC") {
            // Use tiles for ambient NPCs to avoid system crashes in V13 D&D 5e 
            // where tokens without valid actors can fail activation.
            const npcImg = prop.metadata?.token_img || "/icons/svg/mystery-man.svg";
            const npcValid = await this._validateAsset(npcImg);
            
            tiles.push({
              texture: { src: npcValid ? npcImg : "/icons/svg/mystery-man.svg" },
              x: x,
              y: y,
              width: (prop.metadata?.size?.[0] || 1) * tileSize,
              height: (prop.metadata?.size?.[1] || 1) * tileSize,
              alpha: 1,
              hidden: false,
              flags: { "rnk-free-mapgen": { propId: prop.id, data: prop, isAmbientNPC: true } }
            });
          } else if (["FURNITURE", "CONTAINER", "DECORATION", "LIGHTING", "TRAP", "REMAINS", "LORE", "ENVIRONMENTAL", "INTERACTIVE", "TREASURE"].includes(prop.category)) {
            const img = prop.metadata?.img || prop.metadata?.token_img;
            // Only create tile if image exists
            if (img) {
              // Quick check for asset existence to avoid 404 spam
              const isValid = await this._validateAsset(img);
              if (isValid) {
                tiles.push({
                  texture: { src: img },
                  x: x,
                  y: y,
                  width: (prop.metadata?.size?.[0] || 1) * tileSize,
                  height: (prop.metadata?.size?.[1] || 1) * tileSize,
                  flags: { "rnk-free-mapgen": { propId: prop.id, data: prop } }
                });
              }
            }
          }
        }
        
        if (tokens.length > 0) await scene.createEmbeddedDocuments("Token", tokens);
        if (tiles.length > 0) await scene.createEmbeddedDocuments("Tile", tiles);
      }

      // 6.5 / 6.6 — shared Actor folder for this scene
      let sceneActorFolderId = null;
      if (opts.spawnMobs || (opts.lootRarity !== "none" && (opts.lootCount > 0 || opts.lootCompendium || opts.lootFolder || (opts.treasureDensity || 0) > 0))) {
        try {
          let folder = game.folders.find(f => f.name === sceneName && f.type === "Actor");
          if (!folder) {
            folder = await Folder.create({ name: sceneName, type: "Actor", parent: null });
          }
          sceneActorFolderId = folder.id;
        } catch (folderErr) {
          console.warn("RNK: could not create actor folder", folderErr);
        }
      }

      // 6.5 Generate additional mobs
      if (opts.spawnMobs) {
        updateProgress(93, "Spawning mobs...");
        try {
          const mobTokens = await this._generateMobs(result, geometry, tileSize, opts, sceneActorFolderId);
          if (mobTokens.length > 0) {
            await scene.createEmbeddedDocuments("Token", mobTokens);
            ui.notifications.info(`Spawned ${mobTokens.length} mobs into folder: ${sceneName}`);
          }
        } catch (mobErr) {
          console.error("Mob generation failed:", mobErr);
          ui.notifications.warn("Mob generation encountered an error. Scene created without mobs.");
        }
      }

      // 6.6 Spawn loot piles from compendium/folder items
      if (opts.lootRarity !== "none" && (opts.lootCount > 0 || opts.lootCompendium || opts.lootFolder || (opts.treasureDensity || 0) > 0)) {
        updateProgress(94, "Placing loot...");
        try {
          await this._spawnLootTokens(scene, geometry, tileSize, opts, sceneActorFolderId);
        } catch (lootErr) {
          console.error("Loot generation failed:", lootErr);
          ui.notifications.warn("Loot generation encountered an error. Scene created without loot.");
        }
      }

      // 7. Activate scene
      updateProgress(95, "Finalizing...");
      if (opts.autoActivate && !skipActivate) {
        try {
          // Small delay to let Foundry finish processing embedded document creation
          await new Promise(r => setTimeout(r, 250));
          await scene.activate();
        } catch (err) {
          console.error("RNK Free MapGen: Scene activation sequence failed", err);
          // Fallback: just navigate without activation
          try { await scene.view(); } catch (_) { /* ignore */ }
        }
      }

      updateProgress(100, "Done!");
      return scene;
    } catch (err) {
      console.error(err);
      statusText.text("Scene creation failed");
      ui.notifications.error("RNK Free MapGen: " + err.message);
      return null;
    } finally {
      setTimeout(() => {
        const h = $(this.element);
        h.find(".rnk-status-bar").removeClass("active");
        h.find(".progress-fill").css("width", "0%");
      }, 2000);
    }
  }

  async _uploadImage(base64Data, seed) {
    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: "image/png" });
    const filename = `rnk-dungeon-${seed || Date.now()}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const folder = "rnk-free-mapgen";

    const picker = foundry.applications.apps.FilePicker.implementation;
    await picker.createDirectory("data", folder).catch(() => {});
    const response = await picker.upload("data", folder, file);
    return response.path;
  }

  _generateWalls(grid, tileSize, gridType = 'square') {
    const walls = [];
    const height = grid.length;
    const width = grid[0].length;
    const segments = new Set();

    const addWallSegment = (x1, y1, x2, y2) => {
      const key = `${x1},${y1}-${x2},${y2}`;
      const reverseKey = `${x2},${y2}-${x1},${y1}`;
      if (segments.has(key) || segments.has(reverseKey)) return;
      segments.add(key);
      walls.push({
        c: [x1 * tileSize, y1 * tileSize, x2 * tileSize, y2 * tileSize],
        move: 20,
        sense: 20,
        light: 20,
        sound: 20,
      });
    };

    const isFloor = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      const tile = grid[y][x];
      return [TILE.FLOOR, TILE.ENTRANCE, TILE.EXIT, TILE.STAIRS_UP, TILE.STAIRS_DOWN, TILE.WATER, TILE.PIT].includes(tile);
    };

    const isDoor = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return [TILE.DOOR, TILE.HIDDEN_DOOR].includes(grid[y][x]);
    };

    if (gridType === 'hex') {
      // odd-r offset neighbors for pointy-top hexes
      const oddrNeighbors = (x, y) => {
        if ((y & 1) === 0) {
          return [[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]];
        } else {
          return [[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]];
        }
      };

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!isFloor(x, y) && !isDoor(x, y)) continue;
          const neigh = oddrNeighbors(x, y);
          for (let i = 0; i < neigh.length; i++) {
            const dx = neigh[i][0];
            const dy = neigh[i][1];
            const nx = x + dx;
            const ny = y + dy;
            if (isFloor(nx, ny) || isDoor(nx, ny)) continue;

            // Create a short wall segment centered on the edge between hexes.
            // Use tile centers in pixel space then convert back to grid units (tileSize per unit).
            const ax = (x + 0.5) * tileSize;
            const ay = (y + 0.5) * tileSize;
            const bx = (nx + 0.5) * tileSize;
            const by = (ny + 0.5) * tileSize;

            // If neighbor is out of bounds, approximate neighbor center by offset
            let cx = bx;
            let cy = by;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              cx = ax + dx * tileSize;
              cy = ay + dy * tileSize;
            }

            const mx = (ax + cx) / 2.0;
            const my = (ay + cy) / 2.0;
            let vx = cx - ax;
            let vy = cy - ay;
            const vlen = Math.hypot(vx, vy) || 1.0;
            vx /= vlen; vy /= vlen;
            // perpendicular
            const pxv = -vy;
            const pyv = vx;
            const halfLen = tileSize * 0.35;

            const e1x = mx + pxv * halfLen;
            const e1y = my + pyv * halfLen;
            const e2x = mx - pxv * halfLen;
            const e2y = my - pyv * halfLen;

            addWallSegment(e1x / tileSize, e1y / tileSize, e2x / tileSize, e2y / tileSize);
          }
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!isFloor(x, y) && !isDoor(x, y)) continue;
          if (!isFloor(x, y - 1) && !isDoor(x, y - 1)) addWallSegment(x, y - 1, x + 1, y - 1);
          if (!isFloor(x, y + 1) && !isDoor(x, y + 1)) addWallSegment(x, y + 2, x + 1, y + 2);
          if (!isFloor(x - 1, y) && !isDoor(x - 1, y)) addWallSegment(x - 1, y, x - 1, y + 1);
          if (!isFloor(x + 1, y) && !isDoor(x + 1, y)) addWallSegment(x + 2, y, x + 2, y + 1);
        }
      }
    }
    return walls;
  }

  _generateDoors(grid, tileSize) {
    const doors = [];
    const height = grid.length;
    const width = grid[0].length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile !== TILE.DOOR && tile !== TILE.HIDDEN_DOOR) continue;

        const hasFloorNS = this._isPassable(grid, x, y - 1, width, height) &&
                          this._isPassable(grid, x, y + 1, width, height);
        const hasFloorEW = this._isPassable(grid, x - 1, y, width, height) &&
                          this._isPassable(grid, x + 1, y, width, height);

        let doorData;
        if (hasFloorNS) {
          doorData = { c: [x * tileSize, (y + 0.5) * tileSize, (x + 1) * tileSize, (y + 0.5) * tileSize] };
        } else if (hasFloorEW) {
          doorData = { c: [(x + 0.5) * tileSize, y * tileSize, (x + 0.5) * tileSize, (y + 1) * tileSize] };
        } else {
          doorData = { c: [x * tileSize, (y + 0.5) * tileSize, (x + 1) * tileSize, (y + 0.5) * tileSize] };
        }

        doorData.door = tile === TILE.HIDDEN_DOOR ? 2 : 1;
        doorData.move = 20;
        doorData.sense = 20;
        doorData.light = 20;
        doorData.sound = 20;
        doors.push(doorData);
      }
    }
    return doors;
  }

  _isPassable(grid, x, y, width, height) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const tile = grid[y][x];
    return [TILE.FLOOR, TILE.ENTRANCE, TILE.EXIT, TILE.STAIRS_UP, TILE.STAIRS_DOWN, TILE.DOOR, TILE.HIDDEN_DOOR].includes(tile);
  }

  _generateLights(rooms, tileSize, opts = {}) {
    const lights = [];
    // Resource scaling: 50% baseline, 25% for maps with 100+ rooms
    const spawnRate = rooms.length > 100 ? 0.25 : 0.5;
    const roomsToLight = Math.ceil(rooms.length * spawnRate);
    const roomIndices = Array.from({length: rooms.length}, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, roomsToLight);
    
    for (const idx of roomIndices) {
      const room = rooms[idx];
      if (!room.center) continue;
      const x = (room.center.x + 0.5) * tileSize;
      const y = (room.center.y + 0.5) * tileSize;
      const roomSize = Math.max(room.bounds.width, room.bounds.height);
      const radius = Math.min(roomSize * tileSize * 0.6, tileSize * 8);

      // Foundry V13 compatible light structure
      lights.push({
        x, y,
        config: {
          dim: radius,
          bright: radius * 0.5,
          color: opts.lightColor || "#ffaa55",
          alpha: opts.lightIntensity || 0.3,
          angle: 360,
          luminosity: 0.5,
          attenuation: 0.5,
          contrast: 0,
          saturation: 0,
          shadows: 0,
          coloration: 1,
          animation: (opts.lightAnimation === "none") ? null : {
            type: opts.lightAnimation || "torch",
            speed: 5,
            intensity: 5,
            reverse: false
          },
        },
        walls: true,
        vision: false,
        hidden: false,  // V13: false means visible to all, true means GM only
      });
    }
    return lights;
  }

  async _generateSounds(geometry, tileSize, opts = {}) {
    const sounds = [];
    const SOUND_BASE = "modules/rnk-free-mapgen/assets/sounds";

    const AMBIENT_SOUNDS = {
      cave: `${SOUND_BASE}/cave-drip.mp3`,
      underwater: `${SOUND_BASE}/underwater.mp3`,
      whispering: `${SOUND_BASE}/whispering.mp3`,
      creepy_whispering: `${SOUND_BASE}/creepy-whispering.mp3`,
      eerie: `${SOUND_BASE}/eerie.mp3`,
      ominous: `${SOUND_BASE}/ominous.mp3`,
      ominous_drum: `${SOUND_BASE}/ominous-drum.mp3`,
      explosion: `${SOUND_BASE}/explosion.mp3`
    };

    // Curated pool for composite/random modes - atmospheric sounds only (not explosion)
    const ATMOSPHERIC_POOL = ["cave", "whispering", "creepy_whispering", "eerie", "ominous", "ominous_drum"];

    // Thematic groupings for "dungeon" composite mode
    const DUNGEON_LAYERS = {
      base: ["cave", "eerie"],           // background ambience
      accent: ["whispering", "ominous"], // scattered accents
      tension: ["creepy_whispering", "ominous_drum"] // rare tension spots
    };

    if (!geometry.rooms || geometry.rooms.length === 0) return sounds;

    const ambientType = opts.soundAmbient || "none";
    if (ambientType === "none") return sounds;

    const volume = (opts.soundVolume || 0.5) * 0.5;

    // Helper to create a sound entry for a room
    const makeSound = (room, path, vol = volume) => ({
      x: (room.center.x + 0.5) * tileSize,
      y: (room.center.y + 0.5) * tileSize,
      radius: Math.max(room.bounds.width, room.bounds.height) * tileSize * 0.8,
      easing: true,
      volume: vol,
      path: path,
      repeat: true,
      walls: true,
    });

    // Shuffle helper
    const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

    // Filter rooms that have center data
    const validRooms = geometry.rooms.filter(r => r.center && r.bounds);

    if (ambientType === "dungeon") {
      // COMPOSITE MODE: layer multiple sound types across the map
      const shuffled = shuffle(validRooms);
      const totalRooms = shuffled.length;

      // Base layer: ~40% of rooms get background ambience
      const baseCount = Math.ceil(totalRooms * 0.4);
      for (let i = 0; i < baseCount && i < shuffled.length; i++) {
        const pick = DUNGEON_LAYERS.base[Math.floor(Math.random() * DUNGEON_LAYERS.base.length)];
        const path = AMBIENT_SOUNDS[pick];
        if (await this._validateAsset(path)) {
          sounds.push(makeSound(shuffled[i], path, volume * 0.8));
        }
      }

      // Accent layer: ~20% of rooms get accent sounds
      const accentStart = baseCount;
      const accentCount = Math.ceil(totalRooms * 0.2);
      for (let i = accentStart; i < accentStart + accentCount && i < shuffled.length; i++) {
        const pick = DUNGEON_LAYERS.accent[Math.floor(Math.random() * DUNGEON_LAYERS.accent.length)];
        const path = AMBIENT_SOUNDS[pick];
        if (await this._validateAsset(path)) {
          sounds.push(makeSound(shuffled[i], path, volume * 0.6));
        }
      }

      // Tension layer: ~10% of rooms get tension sounds (boss rooms prioritized)
      const tensionStart = accentStart + accentCount;
      const tensionCount = Math.max(1, Math.ceil(totalRooms * 0.1));
      // Put boss/arena rooms first for tension sounds
      const tensionRooms = shuffled.slice(tensionStart).sort((a, b) => {
        const ap = (a.purpose || "").toUpperCase();
        const bp = (b.purpose || "").toUpperCase();
        const aIsBoss = ap.includes("BOSS") || ap.includes("ARENA") ? 0 : 1;
        const bIsBoss = bp.includes("BOSS") || bp.includes("ARENA") ? 0 : 1;
        return aIsBoss - bIsBoss;
      });
      for (let i = 0; i < tensionCount && i < tensionRooms.length; i++) {
        const pick = DUNGEON_LAYERS.tension[Math.floor(Math.random() * DUNGEON_LAYERS.tension.length)];
        const path = AMBIENT_SOUNDS[pick];
        if (await this._validateAsset(path)) {
          sounds.push(makeSound(tensionRooms[i], path, volume * 0.7));
        }
      }
    } else if (ambientType === "random") {
      // RANDOM MODE: each room gets a random atmospheric sound
      const spawnRate = validRooms.length > 100 ? 0.25 : 0.5;
      const roomsToSound = Math.ceil(validRooms.length * spawnRate);
      const shuffled = shuffle(validRooms).slice(0, roomsToSound);

      for (const room of shuffled) {
        const pick = ATMOSPHERIC_POOL[Math.floor(Math.random() * ATMOSPHERIC_POOL.length)];
        const path = AMBIENT_SOUNDS[pick];
        if (await this._validateAsset(path)) {
          sounds.push(makeSound(room, path));
        }
      }
    } else if (AMBIENT_SOUNDS[ambientType]) {
      // SINGLE MODE: one sound type across selected rooms
      const soundPath = AMBIENT_SOUNDS[ambientType];
      if (!(await this._validateAsset(soundPath))) {
        console.warn(`RNK Free MapGen: Sound file missing at ${soundPath}`);
        return [];
      }

      const spawnRate = validRooms.length > 100 ? 0.25 : 0.5;
      const roomsToSound = Math.ceil(validRooms.length * spawnRate);
      const shuffled = shuffle(validRooms).slice(0, roomsToSound);

      for (const room of shuffled) {
        sounds.push(makeSound(room, soundPath));
      }
    }

    // AUTO water/lava sounds: place sounds on tiles with water or lava
    const grid = geometry.grid;
    if (grid) {
      const waterTiles = [];
      const lavaTiles = [];
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
          if (grid[y][x] === TILE.WATER) waterTiles.push({ x, y });
          else if (grid[y][x] === TILE.LAVA) lavaTiles.push({ x, y });
        }
      }

      // Cluster water/lava tiles into sound sources (one per ~8x8 area)
      const clusterSize = 8;
      const placeTileSounds = async (tiles, path, vol) => {
        if (tiles.length === 0) return;
        if (!(await this._validateAsset(path))) return;
        const placed = new Set();
        for (const tile of tiles) {
          const key = `${Math.floor(tile.x / clusterSize)},${Math.floor(tile.y / clusterSize)}`;
          if (placed.has(key)) continue;
          placed.add(key);
          sounds.push({
            x: (tile.x + 0.5) * tileSize,
            y: (tile.y + 0.5) * tileSize,
            radius: clusterSize * tileSize * 0.6,
            easing: true,
            volume: vol,
            path: path,
            repeat: true,
            walls: true,
          });
        }
      };

      await placeTileSounds(waterTiles, AMBIENT_SOUNDS.underwater, volume * 0.4);
      await placeTileSounds(lavaTiles, AMBIENT_SOUNDS.explosion, volume * 0.3);
    }

    return sounds;
  }

  async _generateTraps(result, geometry, tileSize, opts = {}) {
    const traps = [];
    const grid = geometry.grid;
    const trapCount = opts.trapCount || 0;
    
    if (trapCount === 0) return [];
    
    const floorTiles = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        if (grid[y][x] === TILE.FLOOR) {
          // Check for nearby entrance/exit/stairs
          let isSafe = true;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (this._isSpecialTile(grid, x + dx, y + dy)) {
                isSafe = false;
                break;
              }
            }
            if (!isSafe) break;
          }
          if (isSafe) floorTiles.push({ x, y });
        }
      }
    }
    
    const trapTypes = [
      "spike", "flame", "acid", "scythe", 
      "teleport_random", "teleport_linked", "gravity", "web",
      "silence", "alarm", "drain"
    ];
    
    const linkedPairs = [];

    for (let i = 0; i < trapCount && floorTiles.length > 0; i++) {
      const idx = Math.floor(Math.random() * floorTiles.length);
      const pos = floorTiles.splice(idx, 1)[0];
      
      let type = opts.trapType === "random" 
        ? trapTypes[Math.floor(Math.random() * trapTypes.length)]
        : opts.trapType;
        
      const trapData = {
        id: foundry.utils.randomID(),
        x: (pos.x + 0.5) * tileSize,
        y: (pos.y + 0.5) * tileSize,
        radius: opts.trapRadius || 5,
        type: type,
        dc: parseInt(opts.trapDifficulty) || 15,
        scriptsEnabled: opts.trapScriptsEnabled,
        triggeredBy: []
      };

      if (type === "teleport_linked") {
        linkedPairs.push(trapData);
      } else {
        traps.push(trapData);
      }
    }

    // Link pairs
    for (let i = 0; i < linkedPairs.length; i += 2) {
      const a = linkedPairs[i];
      const b = linkedPairs[i+1];
      if (a && b) {
        a.targetX = b.x;
        a.targetY = b.y;
        b.targetX = a.x;
        b.targetY = a.y;
        traps.push(a, b);
      } else if (a) {
        // Fallback to random if single
        a.type = "teleport_random";
        traps.push(a);
      }
    }
    
    return traps;
  }

  _isSpecialTile(grid, x, y) {
    if (x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return false;
    return [TILE.ENTRANCE, TILE.EXIT, TILE.STAIRS_UP, TILE.STAIRS_DOWN].includes(grid[y][x]);
  }

  _getTrapIcon(type) {
    const icons = {
      spike: "/icons/svg/trap.svg",
      flame: "/icons/svg/fire.svg",
      acid: "/icons/svg/acid.svg",
      scythe: "/icons/svg/sword.svg",
      teleport_random: "/icons/svg/daze.svg",
      teleport_linked: "/icons/svg/portal.svg",
      gravity: "/icons/svg/net.svg",
      web: "/icons/svg/web.svg",
      silence: "/icons/svg/mute.svg",
      alarm: "/icons/svg/bell.svg",
      drain: "/icons/svg/skull.svg"
    };
    return icons[type] || "/icons/svg/trap.svg";
  }

  async _generateMobs(result, geometry, tileSize, opts = {}, folderId = null) {
    const mobs = [];
    const grid = geometry.grid;
    
    // Search terms for different mob types and CRs
    const MOB_SEARCH_TERMS = {
      undead: {
        1: ["zombie", "skeleton", "ghoul"],
        3: ["wight", "shadow", "mummy", "specter"],
        6: ["wraith", "ghost", "vampire spawn", "bodak"],
        9: ["bone devil", "death knight", "banshee"],
        13: ["beholder zombie", "lich", "nightwalker", "vampire"],
        boss: ["lich", "vampire lord", "death knight", "dracolich"]
      },
      humanoid: {
        1: ["goblin", "kobold", "bandit", "guard"],
        3: ["orc", "hobgoblin", "bugbear", "scout", "thug"],
        6: ["ogre", "troll", "ettin", "veteran", "gladiator"],
        9: ["giant", "mind flayer", "assassin", "mage", "champion"],
        13: ["warlord", "archmage", "star spawn", "githyanki supreme"],
        boss: ["giant chief", "warlord", "archmage", "storm giant"]
      },
      beast: {
        1: ["wolf", "giant rat", "giant spider", "hyena"],
        3: ["dire wolf", "giant scorpion", "brown bear", "owlbear"],
        6: ["wyvern", "mammoth", "chimera", "manticore"],
        9: ["t-rex", "behir", "giant ape", "roc"],
        13: ["ancient", "purple worm", "kraken"],
        boss: ["ancient dragon", "tarrasque", "kraken"]
      },
      aberration: {
        1: ["chuul", "gibbering mouther", "intellect devourer"],
        3: ["spectator", "otyugh", "grell", "hook horror"],
        6: ["aboleth", "cloaker", "slaad", "beholder kin"],
        9: ["mind flayer", "beholder", "neothelid"],
        13: ["elder brain", "beholder", "death tyrant"],
        boss: ["elder brain", "beholder", "death tyrant"]
      },
      fiend: {
        1: ["imp", "quasit", "dretch"],
        3: ["hell hound", "bearded devil", "nightmare", "succubus"],
        6: ["barbed devil", "vrock", "chasme", "hezrou"],
        9: ["bone devil", "chain devil", "glabrezu", "nalfeshnee"],
        13: ["pit fiend", "balor", "ice devil", "marilith"],
        boss: ["pit fiend", "balor", "demon lord", "archdevil"]
      },
      elemental: {
        1: ["magmin", "mephit", "elemental chunk"],
        3: ["fire snake", "water weird", "gargoyle"],
        6: ["salamander", "air elemental", "earth elemental", "fire elemental", "water elemental"],
        9: ["fire giant", "djinni", "efreeti", "invisible stalker"],
        13: ["elder elemental", "phoenix", "leviathan"],
        boss: ["elder elemental", "phoenix", "zaratan", "elder tempest"]
      },
      construct: {
        1: ["animated armor", "flying sword", "homunculus"],
        3: ["animated object", "flesh golem", "rug of smothering"],
        6: ["shield guardian", "helmed horror", "clay golem"],
        9: ["stone golem", "iron golem", "marut"],
        13: ["iron golem", "adamantine golem", "cadaver collector"],
        boss: ["iron golem", "adamantine golem", "warforged titan"]
      },
      dragon: {
        1: ["guard drake", "pseudodragon", "wyrmling"],
        3: ["young", "wyrmling", "dragonnel"],
        6: ["young dragon", "wyvern", "dragon servitor"],
        9: ["adult dragon", "dragon turtle"],
        13: ["ancient dragon", "dragon turtle"],
        boss: ["ancient dragon", "greatwyrm"]
      }
    };

    // Get density multiplier - "none" means no mobs at all
    if (opts.mobDensity === "none") return [];
    const densityMultipliers = { sparse: 0.5, normal: 1.0, dense: 1.5, swarm: 2.5 };
    const densityMult = densityMultipliers[opts.mobDensity] || 1.0;
    
    // Determine mob type
    let mobType = opts.mobType;
    if (mobType === "auto") {
      const context = this.lastResult?.params?.context || "dwarven";
      if (context.includes("tomb") || context.includes("crypt") || context.includes("grave")) mobType = "undead";
      else if (context.includes("cave") || context.includes("natural")) mobType = "beast";
      else if (context.includes("temple") || context.includes("cult")) mobType = "fiend";
      else mobType = "humanoid";
    }
    if (mobType === "mixed") {
      const types = ["undead", "humanoid", "beast", "aberration", "fiend", "elemental", "construct", "dragon"];
      mobType = types[Math.floor(Math.random() * types.length)];
    }
    
    // Get CR level
    const crLevel = parseInt(opts.mobChallenge) || 3;
    let crKey = 1;
    if (crLevel >= 13) crKey = 13;
    else if (crLevel >= 9) crKey = 9;
    else if (crLevel >= 6) crKey = 6;
    else if (crLevel >= 3) crKey = 3;
    
    const searchTerms = MOB_SEARCH_TERMS[mobType] || MOB_SEARCH_TERMS.humanoid;
    
    // Search compendiums for monsters
    // Wider range for regular monsters to ensure we find SOMETHING
    let regularMonsters, bossMonsters;

    // If a world Actor folder is selected, pull actors directly from it
    if (opts.mobFolder) {
      const folderActors = (game.actors ?? []).filter(
        a => a.folder?.id === opts.mobFolder || a.folder?._id === opts.mobFolder
      );
      regularMonsters = folderActors.map(a => ({
        name: a.name,
        pack: null,
        id: a.id,
        cr: a.system?.details?.cr ?? 0,
        worldActor: true
      }));
      bossMonsters = regularMonsters;
    } else {
      const compFilter = opts.mobCompendium || "";
      [regularMonsters, bossMonsters] = await Promise.all([
        this._findMonstersInCompendiums(searchTerms[crKey], Math.max(0, crLevel - 3), crLevel + 3, compFilter),
        this._findMonstersInCompendiums(searchTerms.boss || searchTerms[13] || searchTerms[crKey], crLevel, crLevel + 8, compFilter)
      ]);
    }
    
    if (regularMonsters.length === 0) {
      ui.notifications.warn("No suitable monsters found in compendiums. Install a monster compendium.");
      return mobs;
    }
    
    // Sort monsters by CR to separate regular and boss-tier creatures
    regularMonsters.sort((a, b) => (a.cr || 0) - (b.cr || 0));
    
    // Identify boss rooms and regular rooms
    const bossRooms = [];
    const regularRooms = [];
    
    for (const room of geometry.rooms || []) {
      const roomPurpose = room.purpose?.toUpperCase() || "";
      if (roomPurpose.includes("BOSS") || roomPurpose.includes("ARENA")) {
        bossRooms.push(room);
      } else if (!roomPurpose.includes("ENTRANCE") && !roomPurpose.includes("SAFE")) {
        regularRooms.push(room);
      }
    }
    
    // Spawn boss in boss rooms - use higher tier monsters from regular pool
    if (opts.spawnBoss && bossRooms.length > 0 && regularMonsters.length > 0) {
      for (const room of bossRooms) {
        // Pick from top 30% of sorted monsters (highest CR) for boss encounters
        const bossPool = regularMonsters.slice(Math.max(0, regularMonsters.length - Math.ceil(regularMonsters.length * 0.3)));
        const boss = bossPool[Math.floor(Math.random() * bossPool.length)];
        const center = this._getRoomCenter(room, grid);
        if (center) {
          mobs.push({
            monster: boss,
            x: center.x * tileSize,
            y: center.y * tileSize,
            room: room,
            isBoss: true,
            opts: opts
          });
        }
      }
    }
    
    // Spawn regular mobs in rooms
    const roomsToPopulate = regularRooms.slice();
    const exactMobCap = (opts.mobCount > 0) ? opts.mobCount : Infinity;
    const hasExplicitCap = isFinite(exactMobCap);
    let spawnedMobCount = 0;

    if (hasExplicitCap) {
      // ── EXACT COUNT MODE ──────────────────────────────────────────
      // Place exactly opts.mobCount mobs. Round-robin across all rooms,
      // cycling as many times as needed. No per-room cap — user asked for
      // this number, they get this number.
      const allFloorTiles = roomsToPopulate.map(room =>
        this._getFloorTilesInRoom(room, grid).slice()
      );
      let roomIdx = 0;
      let safetyBreak = 0;
      while (spawnedMobCount < exactMobCap) {
        // Cycle through rooms until we hit the target
        const tiles = allFloorTiles[roomIdx % allFloorTiles.length];
        roomIdx++;
        if (!tiles || tiles.length === 0) {
          // All tiles in this room used — pick a random position inside it anyway
          // (stacking is fine for an epic crawl)
          const room = roomsToPopulate[(roomIdx - 1) % roomsToPopulate.length];
          const center = this._getRoomCenter(room, grid);
          if (!center) { if (++safetyBreak > exactMobCap * 3) break; continue; }
          const monster = regularMonsters[Math.floor(Math.random() * regularMonsters.length)];
          const jitter = (tileSize * 0.3);
          mobs.push({
            monster, isBoss: false, opts,
            x: center.x * tileSize + (Math.random() * jitter - jitter / 2),
            y: center.y * tileSize + (Math.random() * jitter - jitter / 2),
            room
          });
          spawnedMobCount++;
          continue;
        }
        const tileIdx = Math.floor(Math.random() * tiles.length);
        const tile = tiles.splice(tileIdx, 1)[0];
        const monster = regularMonsters[Math.floor(Math.random() * regularMonsters.length)];
        mobs.push({
          monster, isBoss: false, opts,
          x: tile.x * tileSize,
          y: tile.y * tileSize,
          room: roomsToPopulate[(roomIdx - 1) % roomsToPopulate.length]
        });
        spawnedMobCount++;
      }
    } else {
      // ── DENSITY MODE (no explicit count set) ─────────────────────
      const totalRoomsToSpawn = Math.ceil(roomsToPopulate.length * 0.6);
      const mobsPerRoom = Math.ceil(densityMult * 2);
      for (let i = 0; i < totalRoomsToSpawn && i < roomsToPopulate.length; i++) {
        const room = roomsToPopulate[i];
        const floorTiles = this._getFloorTilesInRoom(room, grid).slice();
        if (floorTiles.length < 3) continue;
        const roomMobCount = Math.min(mobsPerRoom, Math.floor(floorTiles.length / 4));
        for (let j = 0; j < roomMobCount; j++) {
          if (floorTiles.length === 0) break;
          const tileIdx = Math.floor(Math.random() * floorTiles.length);
          const tile = floorTiles.splice(tileIdx, 1)[0];
          const monster = regularMonsters[Math.floor(Math.random() * regularMonsters.length)];
          mobs.push({ monster, isBoss: false, opts, x: tile.x * tileSize, y: tile.y * tileSize, room });
          spawnedMobCount++;
        }
      }
    }
    
    // Spawn mini-bosses if requested
    if (opts.spawnMiniboss && regularRooms.length > 3 && bossMonsters.length > 0) {
      const miniBossCount = Math.max(1, Math.floor(regularRooms.length / 10));
      for (let i = 0; i < miniBossCount; i++) {
        const roomIdx = Math.floor(Math.random() * regularRooms.length);
        const room = regularRooms[roomIdx];
        const center = this._getRoomCenter(room, grid);
        
        if (center) {
          const miniBoss = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
          mobs.push({
            monster: miniBoss,
            x: center.x * tileSize,
            y: center.y * tileSize,
            room: room,
            isBoss: false,
            isMiniBoss: true,
            opts: opts
          });
        }
      }
    }
    
    // Now create actors and tokens from the mob data
    const tokens = [];
    for (const mobData of mobs) {
      try {
        const actor = await this._createActorFromCompendium(mobData.monster, mobData.isBoss || mobData.isMiniBoss, folderId);
        if (actor) {
          // Determine movement behavior based on mob type
          let behavior = "stationary";
          if (mobData.opts.enableMovement) {
            if (mobData.isBoss) {
              behavior = Math.random() < 0.7 ? "stationary" : "idle";
            } else if (mobData.isMiniBoss) {
              const rand = Math.random();
              if (rand < 0.6) behavior = "room_patrol";
              else if (rand < 0.9) behavior = "waypoint_patrol";
              else behavior = "idle";
            } else {
              const rand = Math.random();
              if (rand < 0.4) behavior = "room_patrol";
              else if (rand < 0.7) behavior = "waypoint_patrol";
              else if (rand < 0.9) behavior = "room_wander";
              else behavior = "idle";
            }
          }
          
          // Generate waypoints if needed
          let waypoints = [];
          if (behavior === "waypoint_patrol" && mobData.opts.generateWaypoints && mobData.room) {
            waypoints = this._generateWaypointsForRoom(mobData.room, tileSize);
          }
          
          // Use actor's prototype token data as base
          const protoToken = actor.prototypeToken.toObject();
          
          // Ensure texture path is not empty — prefer actor portrait as fallback
          if (!protoToken.texture?.src) {
            const fallback = actor.img || "/icons/svg/mystery-man.svg";
            console.warn(`Token for ${actor.name} has no texture, using ${fallback}`);
            protoToken.texture = { src: fallback };
          }

          const tokenData = foundry.utils.mergeObject(protoToken, {
            actorId: actor.id,
            actorLink: false,
            x: mobData.x,
            y: mobData.y,
            disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
            displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
            flags: {
              "rnk-free-mapgen": {
                mobType: mobData.isBoss ? "boss" : (mobData.isMiniBoss ? "miniboss" : "regular"),
                roomId: mobData.room?.id ?? null
              }
            }
          });
          tokens.push(tokenData);
        }
      } catch (err) {
        console.warn("Failed to create mob:", err);
      }
    }
    
    return tokens;
  }

  _generateWaypointsForRoom(room, tileSize, count = 4) {
    if (!room.bounds) return [];
    
    const waypoints = [];
    const { x, y, width, height } = room.bounds;
    
    // Create waypoints around room perimeter
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.4;
      const centerX = (x + width / 2) * tileSize;
      const centerY = (y + height / 2) * tileSize;
      
      waypoints.push({
        x: centerX + Math.cos(angle) * radius * tileSize,
        y: centerY + Math.sin(angle) * radius * tileSize
      });
    }
    
    return waypoints;
  }

  async _findMonstersInCompendiums(searchTerms, minCR = 0, maxCR = 30, compendiumFilter = "") {
    let monsters = [];
    const seen = new Set();
    
    // First pass: searching with specific terms
    monsters = await this._doCompendiumSearch(searchTerms, minCR, maxCR, seen, compendiumFilter);
    
    // Fallback: If no results, try broader terms (e.g., if "beholder zombie" fails, try "beholder")
    if (monsters.length === 0) {
        const broadTerms = searchTerms.map(t => t.split(" ").pop()); // take the last word e.g. "zombie"
        monsters = await this._doCompendiumSearch(broadTerms, minCR, maxCR, seen, compendiumFilter);
    }

    return monsters;
  }

  async _doCompendiumSearch(searchTerms, minCR, maxCR, seen, compendiumFilter = "") {
    const results = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Actor") continue;
      if (compendiumFilter && pack.collection !== compendiumFilter) continue;
      
      try {
        // Optimize: request CR and level in index if possible
        const index = await pack.getIndex({ fields: ["system.details.cr", "system.cr", "system.details.level"] });
        
        for (const entry of index) {
          const nameLower = entry.name.toLowerCase();
          const matches = searchTerms.some(term => nameLower.includes(term.toLowerCase()));
          if (!matches) continue;
          
          const key = `${pack.collection}.${entry._id}`;
          if (seen.has(key)) continue;
          
          let rawCr = entry.system?.details?.cr ?? entry.system?.cr ?? entry.system?.details?.level ?? 0;
          let cr = 0;
          if (typeof rawCr === "string") {
            if (rawCr.includes("/")) {
              const parts = rawCr.split("/");
              cr = parseInt(parts[0]) / parseInt(parts[1]);
            } else {
              cr = parseFloat(rawCr) || 0;
            }
          } else {
            cr = Number(rawCr) || 0;
          }
          
          if (cr >= minCR && cr <= maxCR) {
            seen.add(key);
            // We still need to get the document later for full data, but we can delay that
            results.push({
              name: entry.name,
              pack: pack.collection,
              id: entry._id,
              cr: cr
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to search pack ${pack.collection}:`, err);
      }
    }
    return results;
  }

  async _createActorFromCompendium(monsterData, isElite = false, folderId = null) {
    if (!monsterData || !monsterData.id) return null;

    try {
      // World actor (from a selected folder) — use directly, no compendium import needed
      if (monsterData.worldActor) {
        const worldActor = game.actors.get(monsterData.id);
        if (!worldActor) return null;
        if (isElite) await worldActor.update({ name: `Elite ${worldActor.name}` });
        return worldActor;
      }

      const pack = game.packs.get(monsterData.pack);
      if (!pack) return null;

      let actor = null;

      // Try multiple import methods for cross-version Foundry compatibility
      if (typeof game.actors.importFromCompendium === "function") {
        // Foundry V10-V12
        actor = await game.actors.importFromCompendium(pack, monsterData.id, {
          folder: folderId
        });
      } else {
        // Foundry V13+ fallback: get document then create world actor
        const doc = await pack.getDocument(monsterData.id);
        if (!doc) return null;
        const data = doc.toObject();
        data.folder = folderId;
        actor = await Actor.create(data);
      }

      if (!actor) return null;
      if (isElite) await actor.update({ name: `Elite ${actor.name}` });
      return actor;
    } catch (err) {
      console.error(`Failed to create actor:`, err);
      return null;
    }
  }

  // ── Loot Spawning ────────────────────────────────────────────────────────────
  async _spawnLootTokens(scene, geometry, tileSize, opts, folderId = null) {
    if (!scene || !geometry?.rooms?.length) return;

    const rarity = opts.lootRarity || "common";
    const itemsPerRoom = opts.lootCount > 0 ? opts.lootCount : Math.max(1, Math.ceil((opts.treasureDensity || 5) / 3));

    // Rarity keyword filters for generic compendium searches
    const RARITY_TERMS = {
      none:     [],
      common:   ["potion", "oil", "candle", "torch", "ration", "rope", "arrow", "bolt"],
      uncommon: ["uncommon", "+1", "potion of flying", "bag of holding"],
      rare:     ["rare", "+2", "cloak of protection", "ring of protection"],
      epic:     ["very rare", "legendary", "epic", "+3", "staff", "holy avenger"]
    };

    // Build item pool ──────────────────────────────────────────────────────────
    let itemPool = []; // [{name, id, pack|null, isWorldItem}]

    if (opts.lootFolder) {
      // Pull directly from a world Item folder
      (game.items ?? [])
        .filter(item => item.folder?.id === opts.lootFolder || item.folder?._id === opts.lootFolder)
        .forEach(item => itemPool.push({ name: item.name, id: item.id, pack: null, isWorldItem: true }));
    } else {
      // Search Item compendiums
      const packFilter = opts.lootCompendium || "";
      const rarityTerms = RARITY_TERMS[rarity] ?? [];

      for (const pack of (game.packs ?? [])) {
        if (pack.documentName !== "Item") continue;
        if (packFilter && pack.collection !== packFilter) continue;
        try {
          const index = await pack.getIndex({ fields: ["name"] });
          for (const entry of index) {
            const nl = entry.name.toLowerCase();
            if (rarityTerms.length === 0 || rarityTerms.some(t => nl.includes(t))) {
              itemPool.push({ name: entry.name, id: entry._id, pack: pack.collection, isWorldItem: false });
            }
          }
        } catch(e) {
          console.warn(`RNK Loot: failed to index pack ${pack.collection}`, e);
        }
      }
    }

    if (itemPool.length === 0) {
      console.warn("RNK Loot: item pool is empty — skipping loot spawn");
      return;
    }

    // Determine loot rooms ────────────────────────────────────────────────────
    const lootRooms = (geometry.rooms || []).filter(room => {
      const rp = (room.purpose || "").toUpperCase();
      return !rp.includes("ENTRANCE") && !rp.includes("START") && !rp.includes("SAFE");
    });

    const grid = geometry.grid || [];
    if (!grid.length) return;

    // Shuffle so loot is spread unpredictably
    const shuffled = lootRooms.slice().sort(() => Math.random() - 0.5);
    // treasure_density 1-10 → 10%-20% of rooms. Hard cap: 8 piles per scene max.
    const densityFraction = Math.min(0.20, (opts.treasureDensity || 5) / 50);
    const rawCount = Math.max(1, Math.ceil(shuffled.length * densityFraction));
    const roomsWithLoot = shuffled.slice(0, Math.min(rawCount, 8));

    const tokenCreations = [];
    const lootActorsToDelete = []; // track for scene cleanup later if needed

    for (const room of roomsWithLoot) {
      const floorTiles = this._getFloorTilesInRoom(room, grid);
      if (floorTiles.length < 2) continue;

      // Pick random items for this pile
      const pickedItems = [];
      for (let i = 0; i < itemsPerRoom; i++) {
        const src = itemPool[Math.floor(Math.random() * itemPool.length)];
        let itemData = null;

        if (src.isWorldItem) {
          const wi = game.items?.get(src.id);
          if (wi) itemData = wi.toObject();
        } else {
          try {
            const pack = game.packs.get(src.pack);
            if (pack) {
              const doc = await pack.getDocument(src.id);
              if (doc) itemData = doc.toObject();
            }
          } catch (e) { /* skip this item */ }
        }

        if (itemData) pickedItems.push(itemData);
      }

      if (pickedItems.length === 0) continue;

      // Create world loot-pile actor ─────────────────────────────────────────
      const roomLabel = room.name || room.purpose || `Room ${room.id || "?"}`;
      const actorData = {
        name: `Loot: ${roomLabel}`,
        type: "npc",
        img: "icons/containers/chest/chest-wooden-brown-red.webp",
        items: pickedItems,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }
      };

      if (folderId) actorData.folder = folderId;

      let lootActor = null;
      try {
        lootActor = await Actor.create(actorData);
      } catch(e) {
        // Some systems reject "npc"; fall back to "character"
        try {
          actorData.type = "character";
          lootActor = await Actor.create(actorData);
        } catch(e2) {
          console.warn("RNK Loot: could not create loot actor", e2);
        }
      }
      if (!lootActor) continue;
      lootActorsToDelete.push(lootActor.id);

      // Place token on a random floor tile in the room ───────────────────────
      const tileIdx = Math.floor(Math.random() * floorTiles.length);
      const tile = floorTiles[tileIdx];
      tokenCreations.push({
        name: lootActor.name,
        actorId: lootActor.id,
        x: tile.x * tileSize,
        y: tile.y * tileSize,
        width: 1,
        height: 1,
        img: actorData.img,
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
        actorLink: true,
        hidden: false
      });
    }

    if (tokenCreations.length > 0) {
      await scene.createEmbeddedDocuments("Token", tokenCreations);
      ui.notifications.info(`RNK: Placed ${tokenCreations.length} loot piles. Players can open and drag items to their sheets.`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  _getRoomCenter(room, grid) {
    if (room.center) return room.center;
    if (room.bounds) {
      return {
        x: Math.floor(room.bounds.x + room.bounds.width / 2),
        y: Math.floor(room.bounds.y + room.bounds.height / 2)
      };
    }
    return null;
  }

  _getFloorTilesInRoom(room, grid) {
    const tiles = [];
    if (!room.bounds) return tiles;
    
    const { x, y, width, height } = room.bounds;
    for (let ry = y; ry < y + height && ry < grid.length; ry++) {
      for (let rx = x; rx < x + width && rx < grid[0].length; rx++) {
        if (grid[ry][rx] === TILE.FLOOR) {
          tiles.push({ x: rx, y: ry });
        }
      }
    }
    return tiles;
  }

  async _validateAsset(path) {
    if (!path) return false;
    
    // /icons/svg/ are guaranteed to ship with Foundry — skip the fetch
    if (path.startsWith("/icons/svg/")) return true;

    // All other paths (including icons/creatures/, icons/commodities/, module paths, etc.)
    // must be validated via a HEAD request
    try {
      const response = await fetch(path, { 
        method: 'HEAD',
        cache: 'no-cache'
      }).catch(() => ({ ok: false }));
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Scene control button removed; the GM Hub is now accessed only via the Scene Directory button.

// Also keep the Scene Directory button for convenience
Hooks.on("renderSceneDirectory", (app, html) => {
  if (!game.user.isGM) return;
  
  // Ensure html is a jQuery object
  const $html = html instanceof jQuery ? html : $(html);
  
  const createButton = $html.find(".create-entry");

  // Add RNK Free MapGen button next to the create button for quick access
  if (createButton.length && !$html.find(".rnk-free-mapgen-scene-button").length) {
    const btn = $(`
      <button class="rnk-free-mapgen-scene-button rnk-free-mapgen-button" type="button" title="RNK Free MapGen">
        <i class="fas fa-map"></i> RNK Free MapGen
      </button>
    `);
    btn.on("click", (ev) => {
      ev.preventDefault();
      RnkDungeonGmHub.instance.render({force: true});
    });
    createButton.after(btn);
  }
});

// Clear stale scene-control state so Foundry doesn't hide the restored group.
Hooks.once("init", () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.includes("SceneControls") || key.includes("sceneControls")) {
        const val = localStorage.getItem(key);
        if (val && (val.includes("rnk-dimdraft") || val.includes("rnk-free-mapgen"))) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}
});

// Add a Scene Control button group for all RNK Free MapGen tools.
Hooks.on("getSceneControlButtons", (controls) => {
  try {
    if (!game.user?.isGM) return;

    const gmHubTool = {
      name: "gm-hub-open",
      title: "RNK Free MapGen: GM Hub",
      icon: "fas fa-dungeon",
      button: true,
      toggle: false,
      onChange: (active) => {
        if (!active) return;
        const hub = window.RnkDungeonGmHub || game.rnkMapper?.RnkDungeonGmHub;
        if (hub) {
          hub.instance.render({ force: true });
        } else {
          ui.notifications.error("RNK Free MapGen: GM Hub not initialized.");
        }
      }
    };

    const openHub = () => {
      const hub = window.RnkDungeonGmHub || game.rnkMapper?.RnkDungeonGmHub;
      if (hub) {
        hub.instance.render({ force: true });
      } else {
        ui.notifications.error("RNK Free MapGen: GM Hub not initialized.");
      }
    };

    const control = {
      name: "rnk-free-mapgen",
      title: "RNK Free MapGen",
      icon: "fas fa-dungeon",
      order: 100,
      layer: "tokens",
      visible: game.user.isGM,
      activeTool: "gm-hub-open",
      onChange: (event, active) => { if (active) openHub(); },
      onClick: () => openHub(),
      tools: Array.isArray(controls) ? [gmHubTool] : {
        "gm-hub-open": gmHubTool
      }
    };

    if (Array.isArray(controls)) {
      controls.push(control);
    } else if (controls && typeof controls === "object") {
      controls["rnk-free-mapgen"] = control;
    }

  } catch (err) {
    console.error("RNK Free MapGen: Failed to register scene control group", err);
  }
});

// Bind a direct click listener to the scene-control tab so clicking the
// main RNK Free MapGen button in the left sidebar opens the GM Hub immediately
// (Foundry v13+ onChange only fires on state transitions, not on re-clicks).
Hooks.on("renderSceneControls", (app, html) => {
  try {
    if (!game.user?.isGM) return;
    const root = html instanceof HTMLElement ? html : (html?.[0] || html);
    if (!root || !root.querySelector) return;
    const btn = root.querySelector('[data-control="rnk-free-mapgen"]');
    if (!btn || btn.dataset.rnkHubBound === "1") return;
    btn.dataset.rnkHubBound = "1";
    btn.addEventListener("click", () => {
      const hub = window.RnkDungeonGmHub || game.rnkMapper?.RnkDungeonGmHub;
      if (hub) hub.instance.render({ force: true });
      else ui.notifications.error("RNK Free MapGen: GM Hub not initialized.");
    });
  } catch (err) {
    console.error("RNK Free MapGen: Failed to bind scene-control click", err);
  }
});

// Register settings
Hooks.once("init", () => {
  game.settings.register(MODULE_NAME, "apiEndpoint", {
    name: "Generator API URL",
    hint: "URL where the RNK Free MapGen server listens (e.g. https://mapgen-api.rnkstudios.uk/api/generate)",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_ENDPOINT,
  });

  game.settings.register(MODULE_NAME, "patreonAuthUrl", {
    name: "Patreon Auth URL",
    hint: "URL where the RNK Patreon auth server listens (e.g. https://mapgen-api.rnkstudios.uk)",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_AUTH_ENDPOINT,
  });

  // World-scoped so a single Patreon login (by any GM) is shared with every
  // GM/Assistant GM in this world, and survives page reloads.
  game.settings.register(MODULE_NAME, "patreonSharedToken", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_NAME, "globalAnalytics", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      totalRolls: 0,
      crits: 0,
      fumbles: 0,
      totalDamage: 0
    }
  });

  game.settings.register(MODULE_NAME, "dailyGenerations", {
    scope: "client",
    config: false,
    type: Object,
    default: { count: 0, resetAt: 0 }
  });


  // Register Handlebars helpers
  if (typeof Handlebars !== "undefined") {
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
    Handlebars.registerHelper("subtract", (a, b) => Number(a) - Number(b));
    Handlebars.registerHelper("getPresetLabel", (key) => getPresetLabel(key));
    Handlebars.registerHelper("getPresetIcon", (key) => getPresetIcon(key));
    Handlebars.registerHelper("patrolCount", (patrols) => {
      if (!patrols) return 0;
      if (Array.isArray(patrols)) return patrols.length;
      if (typeof patrols === "object") return Object.keys(patrols).length;
      return 0;
    });

    Handlebars.registerHelper("gt", (a, b) => a > b);
  }
});

// Trap Waypoint Hooks
Hooks.on("ready", () => {
  loadSceneTraps();
  renderSceneTraps();
});

// ── Scene-link warp helper (used by note patches + activateNote fallback) ───
function rnkWarpToScene(targetSceneId, targetX, targetY) {
  if (!game.user?.isGM) return;
  const targetScene = game.scenes?.get(targetSceneId);
  if (!targetScene) {
    ui.notifications?.warn("RNK™: Linked scene not found — it may have been deleted.");
    return;
  }
  ui.notifications?.info(`RNK™: Warping to ${targetScene.name}…`);
  targetScene.view().then(() => {
    if (targetX !== undefined && targetY !== undefined) {
      // Small delay to let the canvas initialise before panning
      setTimeout(() => canvas.animatePan({ x: targetX, y: targetY, duration: 600 }), 400);
    }
  }).catch(err => {
    console.error("RNK | Scene warp failed:", err);
    ui.notifications?.error("RNK™: Could not warp to linked scene.");
  });
}

/**
 * Patch _onClickLeft2 on a Note placeable so it warps instead of opening a journal.
 * This works in V11/V12/V13 regardless of entryId.
 */
function rnkPatchNote(note) {
  const flags = note.document?.flags?.[MODULE_NAME];
  if (flags?.type !== "sceneLink" || !flags?.targetScene) return;
  note._onClickLeft2 = function (event) {
    event?.stopPropagation?.();
    rnkWarpToScene(flags.targetScene, flags.targetX, flags.targetY);
  };
  // Also handle single-click for players who may not double-click
  note._onClickLeft = function (event) {
    event?.stopPropagation?.();
    rnkWarpToScene(flags.targetScene, flags.targetX, flags.targetY);
  };
}

/** Patch all RNK scene-link notes currently on the canvas. */
function rnkPatchSceneLinkNotes() {
  for (const note of canvas.notes?.placeables ?? []) {
    rnkPatchNote(note);
  }
}

Hooks.on("canvasReady", () => {
  // Reload traps for the newly active scene
  loadSceneTraps();
  renderSceneTraps();

  // Patch all RNK scene-link notes so they warp without needing a journal entry
  setTimeout(rnkPatchSceneLinkNotes, 500);

  if (RnkDungeonGmHub.instance.rendered) {
    // Defer GM Hub re-render to avoid UI layout shift cascade during scene activation
    setTimeout(() => {
      if (RnkDungeonGmHub.instance.rendered) {
        RnkDungeonGmHub.instance.render();
      }
    }, 300);
  }
});

// Patch notes as they are created (e.g. right after _linkScenes runs)
Hooks.on("createNote", (noteDoc, options, userId) => {
  // Wait a tick for the placeable to be added to the layer
  setTimeout(() => {
    const placeable = canvas.notes?.get(noteDoc.id);
    if (placeable) rnkPatchNote(placeable);
  }, 200);
});

Hooks.on("updateToken", async (tokenDoc, update, options, userId) => {
  if (!update.x && !update.y) return;
  // Only the active GM processes triggers to avoid multiple executions
  if (game.user.id !== game.users.find(u => u.isGM && u.active)?.id) return;

  await checkTraps(tokenDoc);
});

// Sync trap tile drag → scene flag so the PIXI overlay stays in position
Hooks.on("updateTile", async (tileDoc, update, options, userId) => {
  if (!game.user.isGM) return;
  if (!tileDoc.getFlag?.(MODULE_NAME, "isTrapMarker")) return;
  if (update.x === undefined && update.y === undefined) return;

  const scene = tileDoc.parent;
  if (!scene) return;
  const traps = scene.getFlag(MODULE_NAME, "traps");
  if (!traps?.length) return;

  const trapId = tileDoc.getFlag(MODULE_NAME, "trapId");
  const tileSize = scene.grid.size;
  // Tile x/y is top-left; trap x/y is center
  const newX = (update.x ?? tileDoc.x) + tileSize / 2;
  const newY = (update.y ?? tileDoc.y) + tileSize / 2;

  const updated = traps.map(t => {
    const tid = t.id ?? (t.x + "_" + t.y);
    if (tid !== trapId) return t;
    return { ...t, x: newX, y: newY };
  });

  await scene.setFlag(MODULE_NAME, "traps", updated);

  // Re-render PIXI overlay if this is the active scene
  if (canvas.scene?.id === scene.id) {
    loadSceneTraps();
    renderSceneTraps();
  }
});

// ─────────────────────────────────────────────────────────────────
//  Scene-Link Note Handler
//  V11 fallback: activateNote fires when a note with a journal entry
//  is clicked. The primary mechanism is _onClickLeft2 patched above.
// ─────────────────────────────────────────────────────────────────
Hooks.on("activateNote", (note, options) => {
  try {
    const flags = note.document?.flags?.[MODULE_NAME];
    if (flags?.type !== "sceneLink" || !flags?.targetScene) return;
    rnkWarpToScene(flags.targetScene, flags.targetX, flags.targetY);
    // Close any journal window that opened for our portal entry
    for (const app of Object.values(ui.windows ?? {})) {
      if (app.object?.getFlag?.(MODULE_NAME, "isPortalEntry")) app.close();
    }
  } catch (err) {
    console.error("RNK | activateNote hook error:", err);
  }
});

// Global Exports
window.RnkDungeonGmHub = RnkDungeonGmHub;
window.RNKSceneTracker = RNKSceneTracker;
game.rnkMapper = game.rnkMapper || {};
game.rnkMapper.RnkDungeonGmHub = RnkDungeonGmHub;
game.rnkMapper.RNKSceneTracker = RNKSceneTracker;
game.rnkMapper.RnkMobMovement = window.RnkMobMovement;
game.rnkMapper.RNK_TRAPS_VISIBLE = window.RNK_TRAPS_VISIBLE;
game.rnkMapper.renderSceneTraps = renderSceneTraps;

// ─────────────────────────────────────────────────────────────────
//  DEATH LOOT DROP SYSTEM
//  When any NPC/monster hits 0 HP:
//    1. Mark actor as processed (prevent re-triggers)
//    2. Pull physical items from the actor's inventory
//    3. Randomly select up to (active player count) items
//    4. Always add a gold-coin item (CR-scaled)
//    5. Create a loot-pile Actor + chest Token at the dead token's position
//    6. Delete the original monster token
//    7. Auto-delete the loot Actor + Token when all items are removed
// ─────────────────────────────────────────────────────────────────

/** Item types we consider non-physical / not lootable */
const RNK_NON_LOOT_TYPES = new Set([
  "spell", "feat", "feature", "class", "subclass", "race", "background",
  "trait", "action", "passive", "lore", "npc-feature", "classFeature",
  "racialFeature", "specialAbility", "monsterFeature", "heritage",
  "ancestry", "archetype", "practice", "condition", "effect",
  "talent", "ability", "species", "power", "psychicPower", "prayer",
  "skill", "proficiency", "sense", "itemType"
]);

/**
 * System-agnostic HP read — probes common paths across game systems.
 * Returns numeric HP or null if not found.
 */
function rnkGetActorHP(actor) {
  const s = actor?.system;
  if (!s) return null;
  const val =
    s?.attributes?.hp?.value ??
    s?.hp?.value ??
    s?.health?.value ??
    s?.vitals?.hp?.value ??
    s?.stats?.hp?.value ??
    s?.characteristics?.wounds?.value ??
    s?.wounds?.value ??
    s?.damage?.value ??
    null;
  return val;
}

/**
 * Returns all lootable (physical) items from an actor.
 * Excludes non-physical types and zero-quantity items.
 */
function rnkGetLootableItems(actor) {
  return (actor?.items ?? []).filter(item => {
    if (RNK_NON_LOOT_TYPES.has(item.type)) return false;
    const qty = item.system?.quantity ?? item.system?.amount ?? 1;
    return Number(qty) > 0;
  });
}

/**
 * Core death-loot handler. Spawns a chest token in place of the
 * dead actor's token and populates it with randomised loot.
 */
async function rnkHandleDeathLoot(actor) {
  // Only the leading active GM processes this to avoid duplication
  if (!game.user?.isGM) return;
  const leadGM = game.users?.find(u => u.isGM && u.active);
  if (game.user.id !== leadGM?.id) return;

  // Skip our own loot-pile actors (prevent loops)
  if (actor.getFlag?.(MODULE_NAME, "isLootPile")) return;

  // Skip player characters
  if (actor.hasPlayerOwner) return;

  // Guard: HP must be 0 or below right now
  const currentHP = rnkGetActorHP(actor);
  if (currentHP === null || currentHP > 0) return;

  // Guard: already processed this death
  if (actor.getFlag?.(MODULE_NAME, "lootDropped")) return;

  // Find the token for this actor on the current scene
  const scene = canvas?.scene;
  if (!scene) return;
  const tokenDoc = scene.tokens?.find(
    t => t.actorId === actor.id || t.actor?.id === actor.id
  ) ?? null;
  if (!tokenDoc) return; // No visible token = ignore (linked actor with no placed token)

  const tokenX = tokenDoc.x;
  const tokenY = tokenDoc.y;
  const actorName = actor.name;
  const gridSize = canvas.grid?.size ?? 100;

  // Immediately mark processed to prevent concurrent triggers
  await actor.setFlag(MODULE_NAME, "lootDropped", true);

  // ── Build item pool ──────────────────────────────────────────────
  const lootableItems = rnkGetLootableItems(actor);
  const activePlayers = Math.max(1, (game.users ?? []).filter(u => u.active && !u.isGM).length);

  // Shuffle, cap to activePlayers, each has 65% drop chance
  const shuffled = lootableItems.slice().sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, activePlayers);
  let dropped = candidates.filter(() => Math.random() < 0.65).map(i => {
    const data = i.toObject();
    // Normalise quantity to 1 so each player gets a distinct pickup feel
    if (data.system?.quantity !== undefined) data.system.quantity = 1;
    return data;
  });
  // If random eliminated everything but there were candidates, keep at least one
  if (dropped.length === 0 && candidates.length > 0) {
    const data = candidates[0].toObject();
    if (data.system?.quantity !== undefined) data.system.quantity = 1;
    dropped.push(data);
  }

  // ── Gold bonus item ─────────────────────────────────────────────
  const cr = Number(
    actor.system?.details?.cr ??
    actor.system?.cr ??
    actor.system?.attributes?.cr ??
    1
  ) || 1;
  const goldAmount = Math.max(1, Math.floor(cr * (Math.random() * 8 + 4)));
  const goldItem = {
    name: `Gold Coins (${goldAmount} gp)`,
    type: "loot",
    img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
    system: {
      description: { value: `${goldAmount} gp looted from ${actorName}.` },
      quantity: goldAmount,
      price: { value: goldAmount, denomination: "gp" },
      weight: Math.round(0.02 * goldAmount * 100) / 100
    }
  };

  // Try pushing the gold item; if the system rejects the "loot" type we skip it
  dropped.push(goldItem);

  if (dropped.length === 0) return; // Nothing at all to place

  // ── Create the loot-pile Actor ───────────────────────────────────
  // Grant all active non-GM players OBSERVER access so they can open the sheet
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
  for (const u of (game.users ?? []).filter(u => !u.isGM && u.active)) {
    ownership[u.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  }

  const CHEST_IMG = "icons/containers/chest/chest-wooden-brown-red.webp";

  // Put loot actor in the same folder as this scene's mobs (or a fallback "RNK Loot" folder)
  let lootFolderId = null;
  try {
    const activeSceneName = game.scenes?.active?.name;
    let lootFolder = activeSceneName
      ? game.folders.find(f => f.name === activeSceneName && f.type === "Actor")
      : null;
    if (!lootFolder) {
      lootFolder = game.folders.find(f => f.name === "RNK Loot" && f.type === "Actor")
        ?? await Folder.create({ name: "RNK Loot", type: "Actor", parent: null });
    }
    lootFolderId = lootFolder?.id ?? null;
  } catch (_) { /* non-fatal: folder is optional */ }

  const actorCreateData = {
    name: `Loot: ${actorName}`,
    type: "npc",
    img: CHEST_IMG,
    items: dropped,
    ownership,
    folder: lootFolderId,
    flags: { [MODULE_NAME]: { isLootPile: true, sourceActorName: actorName } }
  };

  let lootActor = null;
  try {
    lootActor = await Actor.create(actorCreateData);
  } catch (_) {
    // Some systems don't support "npc" type — fall back to "character"
    try {
      actorCreateData.type = "character";
      lootActor = await Actor.create(actorCreateData);
    } catch (e2) {
      // If even gold "loot" type fails, retry without it
      actorCreateData.type = "npc";
      actorCreateData.items = dropped.filter(i => i.type !== "loot");
      try {
        lootActor = await Actor.create(actorCreateData);
      } catch (e3) {
        console.warn("RNK DeathLoot | Could not create loot actor:", e3);
      }
    }
  }

  if (!lootActor) {
    // Roll back the flag so the GM can try again manually if needed
    await actor.unsetFlag(MODULE_NAME, "lootDropped");
    return;
  }

  // ── Place chest Token at dead monster's position ────────────────
  await scene.createEmbeddedDocuments("Token", [{
    name: `Loot: ${actorName}`,
    actorId: lootActor.id,
    x: tokenX,
    y: tokenY,
    width: 1,
    height: 1,
    img: CHEST_IMG,
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
    actorLink: true,
    hidden: false,
    lockRotation: true,
    flags: { [MODULE_NAME]: { isLootToken: true } }
  }]);

  // ── Delete the original monster token ───────────────────────────
  await tokenDoc.delete().catch(err =>
    console.warn("RNK DeathLoot | Could not delete monster token:", err)
  );

  ui.notifications?.info(
    `RNK™: ${actorName} dropped ${dropped.length} item(s). Loot chest placed!`
  );
}

// ── Hook: Detect actor HP reaching 0 ─────────────────────────────
Hooks.on("updateActor", async (actor, diff, options, userId) => {
  try {
    await rnkHandleDeathLoot(actor);
  } catch (err) {
    console.error("RNK DeathLoot | updateActor hook error:", err);
  }
});

// Also catch systems that store HP on the Token document (not the linked actor)
Hooks.on("updateToken", async (tokenDoc, diff, options, userId) => {
  try {
    // Check if the delta contains HP-like data at the token/delta level
    const deltaSystem =
      diff?.actorData?.system ??
      diff?.delta?.system ??
      diff?.system ??
      null;
    if (!deltaSystem) return;

    const deltaHP =
      deltaSystem?.attributes?.hp?.value ??
      deltaSystem?.hp?.value ??
      deltaSystem?.health?.value ??
      null;
    if (deltaHP === null || deltaHP > 0) return;

    const actor = tokenDoc?.actor;
    if (!actor) return;
    await rnkHandleDeathLoot(actor);
  } catch (err) {
    console.error("RNK DeathLoot | updateToken (hp) hook error:", err);
  }
});

// ── Hook: Auto-delete loot pile when all items have been taken ────
Hooks.on("deleteItem", async (item, options, userId) => {
  try {
    if (!game.user?.isGM) return;
    const leadGM = game.users?.find(u => u.isGM && u.active);
    if (game.user.id !== leadGM?.id) return;

    const actor = item.parent;
    if (!actor) return;
    if (!actor.getFlag?.(MODULE_NAME, "isLootPile")) return;

    // Wait one tick for the delete to fully propagate
    await new Promise(r => setTimeout(r, 100));

    if ((actor.items?.size ?? 0) === 0) {
      // Remove all tokens for this actor across all scenes
      for (const scene of (game.scenes ?? [])) {
        const tokens = scene.tokens?.filter(t => t.actorId === actor.id) ?? [];
        for (const t of tokens) await t.delete().catch(() => {});
      }
      await actor.delete().catch(() => {});
      ui.notifications?.info("RNK™: Loot pile emptied — chest removed.");
    }
  } catch (err) {
    console.error("RNK DeathLoot | deleteItem hook error:", err);
  }
});

// Analytics Hooks
Hooks.on("createChatMessage", (msg, options, userId) => {
  if (!RNKSceneTracker.instance.rendered && !RNKSceneTracker.instance._shouldTrack) return;
  
  // Track rolls
  if (msg.rolls?.length) {
    const roll = msg.rolls[0];
    RNKSceneTracker.instance.analytics.totalRolls++;
    
    // Check for Nat 20 / Nat 1 on d20s
    const d20 = roll.terms.find(t => t.faces === 20);
    if (d20) {
      const result = d20.results[0].result;
      if (result === 20) {
        RNKSceneTracker.instance.analytics.crits++;
        RNKSceneTracker.instance.addEvent(`${game.users.get(userId).name} ROLLED A CRITICAL SUCCESS!`, "success");
      } else if (result === 1) {
        RNKSceneTracker.instance.analytics.fumbles++;
        RNKSceneTracker.instance.addEvent(`${game.users.get(userId).name} FUMBLED! Fate is cruel.`, "danger");
      }
    }
    
    // Estimate Damage
    if (msg.style === 1 || msg.flavor?.toLowerCase().includes("damage")) {
      RNKSceneTracker.instance.analytics.totalDamage += roll.total;
    }
    
    // Save to flags and trigger refresh
    RNKSceneTracker.instance._savePersistedData();
    RNKSceneTracker.instance.render();
  }
});
