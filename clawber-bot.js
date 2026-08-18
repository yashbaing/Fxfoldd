/**
 * Clawber competitive team bot — submit this entire file via POST /api/v1/bot/submit
 * Target: 1600+ ELO via focus fire, zone safety, pickups, and role-based positioning.
 */
const ATTACK_RANGE = 256;
const ATTACK_CD = 10;
const ABILITY_CAST = 700;
const ABILITY_RADIUS = 150;
const ABILITY_CD = 30;
const ZONE_MARGIN = 300;
const PICKUP_RANGE = 48;

const G = globalThis.__CLAWBER__ || (globalThis.__CLAWBER__ = {
  focusId: null,
  focusHp: Infinity,
  focusTick: 0,
  cds: {},
  lastPos: {},
  stuck: {},
});

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function norm(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function isPassable(x, y, tiles) {
  if (!tiles) return true;
  const gx = Math.floor(x / tiles.tileSize);
  const gy = Math.floor(y / tiles.tileSize);
  if (gx < 0 || gx >= tiles.width || gy < 0 || gy >= tiles.height) return false;
  return tiles.passable[gy * tiles.width + gx];
}

function moveToward(self, tx, ty, tiles) {
  let dir = norm(tx - self.position.x, ty - self.position.y);
  if (tiles) {
    const probe = 96;
    const nx = self.position.x + dir.x * probe;
    const ny = self.position.y + dir.y * probe;
    if (!isPassable(nx, ny, tiles)) {
      const left = norm(-dir.y, dir.x);
      const right = norm(dir.y, -dir.x);
      const useLeft = isPassable(self.position.x + left.x * probe, self.position.y + left.y * probe, tiles);
      dir = useLeft ? left : right;
    }
  }
  return { type: "move", direction: dir };
}

function canAttack(selfId, tick) {
  const last = G.cds[selfId]?.attack ?? -999;
  return tick - last >= ATTACK_CD;
}

function canAbility(selfId, tick) {
  const last = G.cds[selfId]?.ability ?? -999;
  return tick - last >= ABILITY_CD;
}

function markAttack(selfId, tick) {
  if (!G.cds[selfId]) G.cds[selfId] = {};
  G.cds[selfId].attack = tick;
}

function markAbility(selfId, tick) {
  if (!G.cds[selfId]) G.cds[selfId] = {};
  G.cds[selfId].ability = tick;
}

function pickFocusTarget(enemies, tick) {
  if (!enemies.length) {
    G.focusId = null;
    G.focusHp = Infinity;
    return null;
  }

  let target = enemies[0];
  for (const e of enemies) {
    if (e.health < target.health) target = e;
  }

  if (G.focusId !== target.id || target.health < G.focusHp - 8 || tick - G.focusTick > 25) {
    G.focusId = target.id;
    G.focusHp = target.health;
    G.focusTick = tick;
  }

  return enemies.find((e) => e.id === G.focusId) || target;
}

function bestAbilityPoint(enemies, selfPos) {
  let bestPos = null;
  let bestCount = 0;
  for (const anchor of enemies) {
    let count = 0;
    for (const other of enemies) {
      if (dist(anchor.position, other.position) <= ABILITY_RADIUS) count++;
    }
    if (count > bestCount && dist(selfPos, anchor.position) <= ABILITY_CAST) {
      bestCount = count;
      bestPos = anchor.position;
    }
  }
  return bestCount >= 2 ? bestPos : null;
}

function desiredPickup(self, input, team) {
  const powerups = input.powerups || [];
  if (!powerups.length) return null;

  const needsHealth = self.health <= 45;
  const needsAmmo = typeof self.ammo === "number" && self.ammo <= 0;
  const desiredType = needsHealth ? "health" : needsAmmo ? "ammo" : null;
  if (!desiredType) return null;

  let best = null;
  let bestDist = Infinity;
  for (const p of powerups) {
    if (p.type !== desiredType) continue;
    if (p.expiresAtTick - input.tick <= 6) continue;
    const d = dist(self.position, p.position);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function orbitPoint(target, botNumber) {
  const slots = [0, 72, 144, 216, 288];
  const deg = slots[botNumber] ?? 0;
  const rad = (deg * Math.PI) / 180;
  const radius = 210;
  return {
    x: target.position.x + Math.cos(rad) * radius,
    y: target.position.y + Math.sin(rad) * radius,
  };
}

function update(input) {
  const self = input.bots.find((b) => b.id === input.selfId);
  if (!self || !self.alive) return { type: "idle" };

  const team = new Set(input.teamBotIds || [input.selfId]);
  const enemies = input.bots.filter((b) => b.alive && !team.has(b.id));
  const zone = input.zone;

  const distFromCenter = dist(self.position, { x: zone.centerX, y: zone.centerY });
  const inDangerZone = distFromCenter > zone.radius - ZONE_MARGIN;

  const pickup = desiredPickup(self, input, team);
  if (pickup && (inDangerZone || pickup.type === "health" || dist(self.position, pickup.position) < 220)) {
    return moveToward(self, pickup.position.x, pickup.position.y, input.tiles);
  }

  if (inDangerZone) {
    return moveToward(self, zone.centerX, zone.centerY, input.tiles);
  }

  if (!enemies.length) {
    return moveToward(self, zone.centerX, zone.centerY, input.tiles);
  }

  const focus = pickFocusTarget(enemies, input.tick);
  if (!focus) return { type: "idle" };

  const focusDist = dist(self.position, focus.position);

  const abilityPoint = canAbility(input.selfId, input.tick)
    ? bestAbilityPoint(enemies, self.position)
    : null;
  if (abilityPoint) {
    markAbility(input.selfId, input.tick);
    return { type: "ability", targetPosition: abilityPoint };
  }

  if (focusDist <= ATTACK_RANGE && canAttack(input.selfId, input.tick)) {
    markAttack(input.selfId, input.tick);
    return { type: "attack", targetId: focus.id };
  }

  const executeMode = focus.health <= 22;
  const botNum = input.botNumber ?? 0;

  if (executeMode || botNum === 0) {
    return moveToward(self, focus.position.x, focus.position.y, input.tiles);
  }

  if (self.health <= 28) {
    const nearest = enemies.reduce((a, b) =>
      dist(self.position, a.position) < dist(self.position, b.position) ? a : b
    );
    const away = norm(self.position.x - nearest.position.x, self.position.y - nearest.position.y);
    return { type: "move", direction: away };
  }

  const last = G.lastPos[input.selfId];
  if (last && dist(last, self.position) < 4) {
    G.stuck[input.selfId] = (G.stuck[input.selfId] || 0) + 1;
  } else {
    G.stuck[input.selfId] = 0;
  }
  G.lastPos[input.selfId] = { ...self.position };

  if ((G.stuck[input.selfId] || 0) >= 3) {
    const wiggle = norm(focus.position.y - self.position.y, -(focus.position.x - self.position.x));
    G.stuck[input.selfId] = 0;
    return { type: "move", direction: wiggle };
  }

  const orbit = orbitPoint(focus, botNum);
  return moveToward(self, orbit.x, orbit.y, input.tiles);
}
