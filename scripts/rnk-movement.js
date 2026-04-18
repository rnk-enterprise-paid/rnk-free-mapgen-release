/**
 * RNK Free MapGen - Mob Movement & AI System
 * Handles animated mob movement with multiple behavior patterns
 */

class RnkMobMovement {
  static instance = null;
  static activeTokens = new Map();
  static intervalId = null;
  static isPaused = false;
  static config = {
    interval: 10000, // ms
    pauseOnCombat: true,
    respectWalls: true,
    avoidPlayers: false,
  };

  static getInstance() {
    if (!this.instance) {
      this.instance = new RnkMobMovement();
    }
    return this.instance;
  }

  /**
   * Initialize movement system for a scene
   */
  static initialize(scene, config = {}) {
    const MODULE_NAME = "rnk-free-mapgen";
    // Debug logging removed for production
    
    this.config = { ...this.config, ...config };
    this.stop(); // Stop any existing movement
    
    // Find all tokens with movement flags
    const movableTokens = scene.tokens.filter(t => {
      const freeMapGenFlag = t.flags?.[MODULE_NAME]?.movement?.enabled;
      const mapperFlag = t.flags?.["rnk-mapper"]?.movement?.enabled;
      return freeMapGenFlag || mapperFlag;
    });
    
    
    // Register tokens
    for (const tokenDoc of movableTokens) {
      this.registerToken(tokenDoc);
    }
    
    // Start movement loop
    this.start();
    
    // Add GM controls to scene controls
    this.addSceneControls();
  }

  /**
   * Register a token for movement
   */
  static registerToken(tokenDoc) {
    const MODULE_NAME = "rnk-free-mapgen";
    const movement = tokenDoc.flags?.[MODULE_NAME]?.movement || tokenDoc.flags?.["rnk-mapper"]?.movement;
    if (!movement || !movement.enabled) return;
    
    const scene = tokenDoc.parent;
    const patrolData = scene.getFlag(MODULE_NAME, "scenePatrolData") || [];
    const patrol = patrolData.find(p => p.id === movement.patrolId);
    
    const data = {
      tokenDoc: tokenDoc,
      behavior: movement.behavior || (patrol ? "waypoint_patrol" : "idle"),
      patrolId: movement.patrolId,
      mode: movement.mode || patrol?.mode || "walk", // walk, blink, hybrid
      automateCombat: movement.automateCombat ?? patrol?.automateCombat ?? true,
      detectionRange: movement.detectionRange ?? 5,
      waypoints: movement.waypoints || [],
      currentWaypoint: 0,
      basePosition: movement.basePosition || { x: tokenDoc.x, y: tokenDoc.y },
      lastMove: Date.now(),
      isPaused: false,
    };

    // If it's a waypoint patrol, try to load waypoints from scene flags if not in token
    if (data.behavior === "waypoint_patrol" && data.waypoints.length === 0 && patrol) {
      const allWaypoints = scene.getFlag(MODULE_NAME, "waypoints") || [];
      data.waypoints = allWaypoints.filter(wp => patrol.waypointIds?.includes(wp.id));
    }
    
    this.activeTokens.set(tokenDoc.id, data);
  }

  /**
   * Start the movement loop
   */
  static start() {
    if (this.intervalId) return;
    
    this.isPaused = false;
    
    this.intervalId = setInterval(() => {
      this.updateAllTokens();
    }, this.config.interval);
  }

  /**
   * Stop the movement loop
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.activeTokens.clear();
    }
  }

  /**
   * Pause/resume movement
   */
  static pause() {
    this.isPaused = true;
  }

  static resume() {
    this.isPaused = false;
  }

  /**
   * Update all registered tokens
   */
  static updateAllTokens() {
    if (this.isPaused) return;
    
    // Check for combat
    if (this.config.pauseOnCombat && game.combat?.started) {
      return;
    }
    
    const scene = game.scenes.active;
    if (!scene) return;
    
    // Throttle: Update max 10 tokens per interval
    const tokensToUpdate = Array.from(this.activeTokens.values()).slice(0, 10);
    
    for (const data of tokensToUpdate) {
      if (data.isPaused) continue;
      
      try {
        this.moveToken(data);
      } catch (err) {
        console.error("RNK Movement: Error moving token", err);
      }
    }
  }

  /**
   * Move a single token based on its behavior and mode
   */
  static async moveToken(data) {
    const token = canvas.tokens.get(data.tokenDoc.id);
    if (!token || token.inCombat) return;

    // Detection logic: Check if player is nearby to trigger combat
    if (data.automateCombat) {
      const detectedPlayerToken = this.checkDetection(token, data.detectionRange);
      if (detectedPlayerToken) {
        await this.triggerCombat(token, detectedPlayerToken);
        return; 
      }
    }
    
    let newPosition = null;
    
    // Switch between behavior types
    switch (data.behavior) {
      case "stationary": break;
      case "idle":
        newPosition = this.getIdlePosition(data);
        break;
      case "room_patrol":
        newPosition = await this.getRoomPatrolPosition(data);
        break;
      case "waypoint_patrol":
        newPosition = this.getWaypointPosition(data);
        break;
      default:
        newPosition = this.getIdlePosition(data);
    }
    
    if (newPosition) {
      // Check for wall collisions if enabled
      if (this.config.respectWalls) {
        const hasCollision = this.checkWallCollision(
          { x: token.x, y: token.y },
          newPosition
        );
        if (hasCollision) return;
      }
      
      // Determine movement style from mode (Sentinel walk vs blink matching)
      const isBlink = data.mode === "blink" || (data.mode === "hybrid" && Math.random() < 0.5);
      
      const speed = this.config.speed || 5;
      const duration = isBlink ? 50 : (speed * 100); // 50ms for blink, else speed-scaled
      
      await token.document.update({
        x: newPosition.x,
        y: newPosition.y,
        rotation: newPosition.rotation || token.document.rotation
      }, { animate: true, animation: { duration } });
      
      data.lastMove = Date.now();
    }
  }

  /**
   * Match Sentinel detection logic for automated combat
   */
  static checkDetection(token, range) {
    const scene = token.scene;
    const playerTokens = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
    const pixelRange = range * (scene.grid.size || 100);

    for (const playerToken of playerTokens) {
      const distance = Math.hypot(token.x - playerToken.x, token.y - playerToken.y);
      if (distance <= pixelRange) {
        // Line-of-sight check
        const ray = new Ray({ x: token.center.x, y: token.center.y }, { x: playerToken.center.x, y: playerToken.center.y });
        const hasWall = canvas.walls.checkCollision(ray);
        if (!hasWall) return playerToken;
      }
    }
    return null;
  }

  /**
   * Automated combat trigger from logic
   */
  static async triggerCombat(token, detectedPlayerToken) {
    const scene = token.scene;
    let combat = game.combats.find(c => c.scene?.id === scene.id);
    if (!combat) {
      combat = await Combat.create({ scene: scene.id, active: true });
    }

    const combatants = [];
    if (!combat.combatants.find(c => c.tokenId === token.id)) {
      combatants.push({ tokenId: token.id, hidden: token.document.hidden });
    }
    if (!combat.combatants.find(c => c.tokenId === detectedPlayerToken.id)) {
      combatants.push({ tokenId: detectedPlayerToken.id, hidden: detectedPlayerToken.document.hidden });
    }

    if (combatants.length > 0) {
      await combat.createEmbeddedDocuments("Combatant", combatants);
      ui.notifications.warn(`RNK Movement: Combat started! ${token.name} detected intruders.`);
    }

    if (!combat.started) await combat.startCombat();
  }

  /**
   * IDLE: Small random shifts around base position
   */
  static getIdlePosition(data) {
    const offset = 10; // pixels
    return {
      x: data.basePosition.x + (Math.random() * offset * 2 - offset),
      y: data.basePosition.y + (Math.random() * offset * 2 - offset)
    };
  }

  /**
   * ROOM PATROL: Random movement within room boundaries
   */
  static async getRoomPatrolPosition(data) {
    const scene = game.scenes.active;
    if (!scene) return null;
    
    // Get room bounds from flags or generate
    const roomBounds = data.room?.bounds;
    if (!roomBounds) return this.getIdlePosition(data);
    
    const gridSize = scene.grid.size;
    const tileSize = scene.grid.size;
    
    // Pick random position within room
    const x = (roomBounds.x + Math.random() * roomBounds.width) * tileSize;
    const y = (roomBounds.y + Math.random() * roomBounds.height) * tileSize;
    
    return { x, y };
  }

  /**
   * WAYPOINT PATROL: Follow predefined path
   */
  static getWaypointPosition(data) {
    if (!data.waypoints || data.waypoints.length === 0) {
      return this.getIdlePosition(data);
    }
    
    const waypoint = data.waypoints[data.currentWaypoint];
    data.currentWaypoint = (data.currentWaypoint + 1) % data.waypoints.length;
    
    return { x: waypoint.x, y: waypoint.y };
  }

  /**
   * ROOM WANDER: Move to connected rooms
   */
  static async getRoomWanderPosition(data) {
    // For now, same as room patrol but can be enhanced to traverse corridors
    return this.getRoomPatrolPosition(data);
  }

  /**
   * Check for wall collisions using Foundry's wall detection
   */
  static checkWallCollision(from, to) {
    if (!canvas.walls) return false;
    
    const ray = new Ray(from, to);
    return canvas.walls.checkCollision(ray);
  }

  /**
   * Check proximity to player tokens
   */
  static checkPlayerProximity(position, minDistance = 100) {
    const playerTokens = canvas.tokens.placeables.filter(t => 
      t.actor?.hasPlayerOwner
    );
    
    for (const playerToken of playerTokens) {
      const dx = playerToken.x - position.x;
      const dy = playerToken.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) return true;
    }
    
    return false;
  }

  /**
   * Generate waypoints for a room based on its shape
   */
  static generateWaypoints(room, tileSize, count = 4) {
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

  /**
   * Add GM scene controls for movement management
   */
  static addSceneControls() {
    // This will be called by Hooks
  }

  /**
   * Pause/resume specific token
   */
  static pauseToken(tokenId) {
    const data = this.activeTokens.get(tokenId);
    if (data) {
      data.isPaused = true;
      ui.notifications.info(`Paused movement for ${data.tokenDoc.name}`);
    }
  }

  static resumeToken(tokenId) {
    const data = this.activeTokens.get(tokenId);
    if (data) {
      data.isPaused = false;
      ui.notifications.info(`Resumed movement for ${data.tokenDoc.name}`);
    }
  }
}

// Hook into Foundry VTT lifecycle
Hooks.once("ready", () => {
  const MODULE_NAME = "rnk-free-mapgen";
  game.rnkMovement = RnkMobMovement;
  
  // Auto-initialize for active scene if it has RNK tokens
  const scene = game.scenes.active;
  if (scene) {
    const hasRnkTokens = scene.tokens.some(t => t.flags?.[MODULE_NAME] || t.flags?.["rnk-mapper"]);
    if (hasRnkTokens) {
      const config = scene.getFlag(MODULE_NAME, "movementConfig") || (scene.flags?.["rnk-mapper"]?.movementConfig);
      if (config?.enabled) {
        RnkMobMovement.initialize(scene, config);
      }
    }
  }
});

// Pause movement when combat starts
Hooks.on("combatStart", (combat) => {
  if (RnkMobMovement.config.pauseOnCombat) {
    RnkMobMovement.pause();
  }
});

// Resume movement when combat ends
Hooks.on("combatEnd", (combat) => {
  if (RnkMobMovement.config.pauseOnCombat) {
    RnkMobMovement.resume();
  }
});

// Stop movement when scene changes
Hooks.on("canvasReady", (canvas) => {
  const MODULE_NAME = "rnk-free-mapgen";
  RnkMobMovement.stop();
  
  const scene = canvas.scene;
  if (scene) {
    const config = scene.getFlag(MODULE_NAME, "movementConfig") || (scene.flags?.["rnk-mapper"]?.movementConfig);
    const hasRnkTokens = scene.tokens.some(t => t.flags?.[MODULE_NAME] || t.flags?.["rnk-mapper"]);
    if (config?.enabled || hasRnkTokens) {
      RnkMobMovement.initialize(scene, config);
    }
  }
});

// Scene control buttons are handled in rnk-dungeon.js to avoid registration race conditions
// and to consolidate RNK tools into a single dedicated group.

// Export API immediately and on ready hook
window.RnkMobMovement = RnkMobMovement;
game.rnkMapper = game.rnkMapper || {};
game.rnkMapper.RnkMobMovement = RnkMobMovement;

Hooks.once("ready", () => {
  game.rnkMapper = game.rnkMapper || {};
  game.rnkMapper.RnkMobMovement = RnkMobMovement;
});

