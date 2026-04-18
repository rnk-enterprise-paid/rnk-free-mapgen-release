/**
 * RNK™ Free MapGen Dungeon Trap Waypoint System
 * Handles PIXI rendering, proximity detection, and effect application for traps.
 */

const MODULE_NAME = "rnk-free-mapgen";

// Global state for trap visibility
// Traps are GM-only by default; GMs can toggle visibility
window.RNK_TRAPS_VISIBLE = false;

export class DungeonTrapWaypoint {
  constructor(data) {
    this.id = data.id || foundry.utils.randomID();
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.radius = data.radius || 5; 
    this.type = data.type || "spike";
    this.dc = data.dc || 15;
    this.scriptsEnabled = data.scriptsEnabled ?? true;
    this.triggeredBy = new Set(data.triggeredBy || []); 
    this.targetX = data.targetX || null;
    this.targetY = data.targetY || null;
    this.graphics = null;
  }

  render() {
    if (!game.user.isGM) return;
    const size = canvas.dimensions.size;
    const distance = canvas.dimensions.distance;
    const radiusPx = (this.radius / distance) * size;
    
    let color = 0xff0000;
    if (this.type.startsWith("teleport")) color = 0x00ffff;
    if (this.type === "alarm") color = 0xffaa00;
    if (this.type === "gravity") color = 0x6600ff;
    if (this.type === "web") color = 0xffffff;
    
    const circle = new PIXI.Graphics();
    circle.lineStyle(2, color, 0.8);
    circle.drawCircle(0, 0, radiusPx);
    circle.lineStyle(1, color, 0.4);
    circle.moveTo(-10, 0); circle.lineTo(10, 0);
    circle.moveTo(0, -10); circle.lineTo(0, 10);
    circle.position.set(this.x, this.y);
    circle.alpha = 0.4;
    
    const style = new PIXI.TextStyle({
      fontFamily: 'Courier New',
      fontSize: 12,
      fill: color,
      fontWeight: 'bold'
    });
    const text = new PIXI.Text(this.getLabel().toUpperCase(), style);
    text.anchor.set(0.5, 0);
    text.position.set(0, 15);
    circle.addChild(text);

    if (canvas.controls) {
      canvas.controls.addChild(circle);
      this.graphics = circle;
    }
  }

  getLabel() {
    // Falls back to key if PRESET_LABELS not available
    return (window.PRESET_LABELS && window.PRESET_LABELS[this.type]) || this.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  destroy() {
    if (this.graphics && !this.graphics.destroyed) {
      if (this.graphics.parent) this.graphics.parent.removeChild(this.graphics);
      this.graphics.destroy({children: true});
    }
    this.graphics = null;
  }

  isInside(token) {
    if (!token) return false;
    const center = token.center || { x: token.x + (canvas.grid.size / 2), y: token.y + (canvas.grid.size / 2) };
    const dx = center.x - this.x;
    const dy = center.y - this.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const radiusPx = (this.radius / canvas.dimensions.distance) * canvas.dimensions.size;
    return distPx <= radiusPx;
  }

  async trigger(tokenDoc) {
    if (this.triggeredBy.has(tokenDoc.id)) return;
    this.triggeredBy.add(tokenDoc.id);
    saveSceneTraps();

    const actor = tokenDoc.actor;
    if (!actor) return;

    // Visual feedback in VTT
    if (canvas.interface) {
      canvas.interface.createScrollingText(tokenDoc.object?.center || tokenDoc, "TRAP SPRUNG!", {
        anchor: PIXI.ScrollingText.ANCHORS.TOP,
        direction: PIXI.ScrollingText.DIRECTIONS.UP,
        distance: 40,
        fontSize: 28,
        stroke: 0x000000,
        strokeThickness: 4,
        fill: 0xff0000
      });
    }

    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({token: tokenDoc}),
      content: `<div class="rnk-trap-card rnk-apocalyptic">
                  <h3><i class="fas fa-biohazard"></i> Trap Sprung!</h3>
                  <p>A <strong>${this.getLabel()}</strong> has been triggered by ${tokenDoc.name}!</p>
                </div>`,
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });

    // Sound effect
    const soundSrc = this.type === "alarm" ? "sounds/bell.wav" : (["spike", "scythe"].includes(this.type) ? "sounds/lock.wav" : "sounds/fire.wav");
    AudioHelper.play({src: soundSrc, volume: 0.8}, true);

    if (this.scriptsEnabled) {
      // Determine Save Type based on Trap Type
      let saveType = "dex";
      if (["drain", "acid", "web"].includes(this.type)) saveType = "con";
      if (["silence", "gravity"].includes(this.type)) saveType = "wis";

      let saveResult = null;
      
      // Attempt automated save roll (DnD5e)
      if (typeof actor.rollAbilitySave === "function") {
        saveResult = await actor.rollAbilitySave(saveType, { chatMessage: true, fastForward: false });
      } else {
        // Generic VTT Fallback
        const roll = await new Roll(`1d20 + @abilities.${saveType}.mod`, actor.getRollData()).evaluate();
        await roll.toMessage({flavor: `${saveType.toUpperCase()} Save vs ${this.getLabel()}`});
        saveResult = roll;
      }

      if (saveResult && saveResult.total >= this.dc) {
        ChatMessage.create({
          user: game.user.id,
          content: `<p><i class="fas fa-running"></i> ${tokenDoc.name} narrowly avoids the impact (Result: ${saveResult.total} vs DC ${this.dc})!</p>`,
          whisper: game.users.filter(u => u.isGM).map(u => u.id)
        });
      } else {
        await this._applyEffect(tokenDoc);
      }
    }
  }

  async _applyEffect(tokenDoc) {
    const actor = tokenDoc.actor;
    const scene = tokenDoc.parent;
    if (!actor) return;

    let damageDice = "";
    let damageType = "none";

    switch (this.type) {
      case "spike":
      case "scythe":
        damageDice = this.type === "spike" ? "2d10" : "3d8";
        damageType = "piercing";
        break;
      case "flame":
        damageDice = "4d6";
        damageType = "fire";
        break;
      case "acid":
        damageDice = "3d6";
        damageType = "acid";
        break;
      case "drain":
        damageDice = "2d6";
        damageType = "necrotic";
        break;
    }

    if (damageDice) {
      const roll = await new Roll(damageDice).evaluate();
      await roll.toMessage({
        speaker: { alias: this.getLabel() },
        flavor: `${this.getLabel()} Damage (${damageType})`
      });

      // VTT Scrolling Damage
      if (canvas.interface) {
        canvas.interface.createScrollingText(tokenDoc.object?.center || tokenDoc, `-${roll.total}`, {
          anchor: PIXI.ScrollingText.ANCHORS.CENTER,
          direction: PIXI.ScrollingText.DIRECTIONS.UP,
          fontSize: 32,
          fill: 0xff3300,
          stroke: 0x000000,
          strokeThickness: 4
        });
      }

      // MECHANICAL IMPACT: Damage Application
      if (typeof actor.applyDamage === "function") {
        // Attempt V12/V13 5e damage array first
        try {
          await actor.applyDamage([{ value: roll.total, type: damageType }]);
        } catch (e) {
          await actor.applyDamage(roll.total);
        }
      } else {
        // Universal HP deduction fallback
        const hpPath = actor.system.attributes?.hp ? "system.attributes.hp.value" : (actor.system.hp ? "system.hp.value" : null);
        if (hpPath) {
          const currentHp = foundry.utils.getProperty(actor, hpPath) || 0;
          await actor.update({ [hpPath]: Math.max(0, currentHp - roll.total) });
        }
      }
    }

    // Special Behavioral Effects
    switch (this.type) {
      case "teleport_random":
        const floors = scene.tiles.filter(t => t.getFlag(MODULE_NAME, "data")?.category === "FLOOR");
        if (floors.length) {
          const dest = floors[Math.floor(Math.random() * floors.length)];
          await tokenDoc.update({x: dest.x, y: dest.y});
          ui.notifications.info(`${tokenDoc.name} was warped to a random location!`);
        }
        break;

      case "teleport_linked":
        if (this.targetX && this.targetY) {
          await tokenDoc.update({x: this.targetX, y: this.targetY});
          ui.notifications.info(`${tokenDoc.name} was pulled through a Void Link!`);
        }
        break;

      case "gravity":
      case "web":
        ui.notifications.warn(`${tokenDoc.name} is ${this.type === "gravity" ? "crushed" : "ensnared"}!`);
        // Toggle condition if supported (5e/Standard)
        if (typeof actor.toggleStatusEffect === "function") {
          await actor.toggleStatusEffect("restrained", {active: true});
        }
        break;

      case "silence":
        if (typeof actor.toggleStatusEffect === "function") {
          await actor.toggleStatusEffect("deafened", {active: true});
        }
        break;
    }
  }
}

let sceneTraps = [];

export function loadSceneTraps() {
  if (!canvas.scene) return;
  const data = canvas.scene.getFlag(MODULE_NAME, "traps") || [];
  sceneTraps.forEach(t => t.destroy());
  sceneTraps = data.map(d => new DungeonTrapWaypoint(d));
}

export function saveSceneTraps() {
  if (!canvas.scene) return;
  const data = sceneTraps.map(t => ({
    id: t.id, x: t.x, y: t.y, radius: t.radius, type: t.type, dc: t.dc,
    scriptsEnabled: t.scriptsEnabled, triggeredBy: Array.from(t.triggeredBy),
    targetX: t.targetX, targetY: t.targetY
  }));
  canvas.scene.setFlag(MODULE_NAME, "traps", data);
}

export function renderSceneTraps() {
  if (window.RNK_TRAPS_VISIBLE === false) {
    sceneTraps.forEach(t => t.destroy());
    return;
  }
  sceneTraps.forEach(t => {
    t.destroy();
    t.render();
  });
}

export async function checkTraps(tokenDoc) {
  for (const trap of sceneTraps) {
    if (trap.isInside(tokenDoc)) {
      await trap.trigger(tokenDoc);
    }
  }
}
