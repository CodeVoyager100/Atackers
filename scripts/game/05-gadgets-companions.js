        function activateSuper(p, targetX, targetY) {
            if (!p || p.currentHp <= 0) return;
            if (p.superCharge < 100) return;
            if (p.superCooldown > 0) return;

            const type = p.superType || 'burst';
            p.superCharge = 0;
            p.superCooldown = 300; // 5-second lockout before charge can fill again

            const cx = p.x + p.size / 2;
            const cy = p.y + p.size / 2;

            switch (type) {
                case 'burst': {
                    // 8 lasers in all directions
                    fireRadialBurst(p, 8, p.laserDamage * 3, 14, 100);
                    break;
                }
                case 'piercebeam': {
                    // Long beam toward target (or nearest enemy for bots)
                    const tx = targetX ?? cx + 1;
                    const ty = targetY ?? cy;
                    const dist = Math.hypot(tx - cx, ty - cy) || 1;
                    const vx = (tx - cx) / dist * 18;
                    const vy = (ty - cy) / dist * 18;
                    // Fire 3 staggered beams for a thick visual
                    for (let o = -1; o <= 1; o++) {
                        const perp = { x: -vy / 18 * (o * 8), y: vx / 18 * (o * 8) };
                        lasers.push({ x: cx + perp.x, y: cy + perp.y, vx, vy, life: 160, damage: p.laserDamage * 4, shooter: p, isSuperLaser: true, piercing: true });
                    }
                    break;
                }
                case 'firezone': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    superEffects.push({ type: 'firezone', x: tx, y: ty, radius: 120, timer: 180, tickTimer: 0, tickInterval: 30, damage: p.laserDamage * 2, shooter: p });
                    break;
                }
                case 'bigshot': {
                    const tx = targetX ?? cx + 1;
                    const ty = targetY ?? cy;
                    const dist = Math.hypot(tx - cx, ty - cy) || 1;
                    superEffects.push({ type: 'bigshot', x: cx, y: cy, vx: (tx - cx) / dist * 7, vy: (ty - cy) / dist * 7, radius: 30, damage: p.laserDamage * 6, shooter: p, life: 200 });
                    break;
                }
                case 'meteorstorm': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI * 2 / 6) * i;
                        const sx = tx + Math.cos(angle) * 90;
                        const sy = ty + Math.sin(angle) * 90;
                        const dist = Math.hypot(tx - sx, ty - sy) || 1;
                        superEffects.push({
                            type: 'bigshot',
                            x: sx,
                            y: sy,
                            vx: (tx - sx) / dist * 7,
                            vy: (ty - sy) / dist * 7,
                            radius: 18,
                            damage: p.laserDamage * 2,
                            shooter: p,
                            life: 140
                        });
                    }
                    superEffects.push({ type: 'screamflash', x: tx, y: ty, radius: 110, timer: 20, shooter: p });
                    break;
                }
                case 'firedash': {
                    // Dash toward target, stopping at first obstacle
                    const tx = targetX ?? cx + 1;
                    const ty = targetY ?? cy;
                    const dist = Math.hypot(tx - cx, ty - cy) || 1;
                    const dashDist = 300;
                    const dirX = (tx - cx) / dist;
                    const dirY = (ty - cy) / dist;
                    const stepSize = p.size;
                    const totalSteps = Math.ceil(dashDist / stepSize);
                    let lastSafeX = p.x;
                    let lastSafeY = p.y;
                    for (let s = 1; s <= totalSteps; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + dirX * stepSize * s));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + dirY * stepSize * s));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) {
                                blocked = true; break;
                            }
                        }
                        if (blocked) break;
                        lastSafeX = nx;
                        lastSafeY = ny;
                    }
                    const newX = lastSafeX;
                    const newY = lastSafeY;
                    superEffects.push({ type: 'firezone', x: (cx + newX + p.size / 2) / 2, y: (cy + newY + p.size / 2) / 2, radius: 80, timer: 90, tickTimer: 0, tickInterval: 20, damage: p.laserDamage * 2, shooter: p });
                    p.x = newX;
                    p.y = newY;
                    break;
                }
                case 'tornado': {
                    superEffects.push({ type: 'tornado', x: cx, y: cy, radius: 150, timer: 240, tickTimer: 0, tickInterval: 20, damage: p.laserDamage, shooter: p, angle: 0 });
                    break;
                }
                case 'berserk': {
                    p.superActive = true;
                    p.superTimer = 300; // 5 s
                    p._baseLaserDamage = p.laserDamage;
                    p.laserDamage = p.laserDamage * 2;
                    p._baseShootMult = 1;
                    p.superBuffType = 'berserk';
                    break;
                }
                case 'selfexplode': {
                    const radius = 170;
                    dealAoeDamage(cx, cy, radius, p.laserDamage * 5.5, p);
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius, timer: 28, shooter: p });
                    break;
                }
                case 'punchflurry': {
                    p.superActive = true;
                    p.superTimer = 150;
                    p._speedTimer = Math.max(p._speedTimer || 0, 150);
                    p._damageTimer = Math.max(p._damageTimer || 0, 140);
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            if (!gameStarted || p.currentHp <= 0) return;
                            const px = p.x + p.size / 2;
                            const py = p.y + p.size / 2;
                            dealAoeDamage(px, py, 95, p.laserDamage * 2.2, p);
                            superEffects.push({ type: 'screamflash', x: px, y: py, radius: 95, timer: 16, shooter: p });
                        }, i * 120);
                    }
                    break;
                }
                case 'coffeerush': {
                    p.superActive = true;
                    p.superTimer = 240; // 4 s
                    p._baseSpeed = p.speed;
                    p.speed = p.speed * 3;
                    p._baseLaserDamage = p.laserDamage;
                    p.laserDamage = p.laserDamage * 2;
                    p.superBuffType = 'coffeerush';
                    break;
                }
                case 'scream': {
                    // Immediate AoE around self
                    dealAoeDamage(cx, cy, 180, p.laserDamage * 5, p);
                    // Slow nearby enemies
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        if (Math.hypot(t.x + t.size / 2 - cx, t.y + t.size / 2 - cy) <= 180) {
                            t._slowTimer = (t._slowTimer || 0);
                            t._slowTimer = 150; // 2.5 s slow
                        }
                    }
                    // Visual flash
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 180, timer: 30, shooter: p });
                    break;
                }
                case 'megazord': {
                    // Brief invincibility + 12-laser burst
                    p.superInvincible = true;
                    p.superActive = true;
                    p.superTimer = 120; // 2 s
                    p.superBuffType = 'megazord';
                    fireRadialBurst(p, 12, p.laserDamage * 4, 15, 130);
                    break;
                }
                case 'rockshield': {
                    p.superInvincible = true;
                    p.superActive = true;
                    p.superTimer = 180; // 3 s
                    p.superBuffType = 'rockshield';
                    break;
                }
                case 'shadowburst': {
                    // Shadow dash that respects walls, then burst at landing
                    const tx = targetX ?? cx + 200;
                    const ty = targetY ?? cy;
                    const dist = Math.hypot(tx - cx, ty - cy) || 1;
                    const dashDist = 280;
                    const dirX = (tx - cx) / dist;
                    const dirY = (ty - cy) / dist;
                    const steps = Math.max(1, Math.floor(dashDist / 14));
                    const stepX = (dirX * dashDist) / steps;
                    const stepY = (dirY * dashDist) / steps;
                    let lastSafeX = p.x;
                    let lastSafeY = p.y;

                    for (let s = 0; s < steps; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, lastSafeX + stepX));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, lastSafeY + stepY));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) {
                                blocked = true;
                                break;
                            }
                        }
                        if (blocked) break;
                        lastSafeX = nx;
                        lastSafeY = ny;
                    }

                    p.x = lastSafeX;
                    p.y = lastSafeY;
                    p.shadowPhaseTimer = Math.max(p.shadowPhaseTimer || 0, 55);
                    // Burst at landing spot
                    fireRadialBurst(p, 10, p.laserDamage * 3, 13, 110);
                    superEffects.push({ type: 'screamflash', x: p.x + p.size / 2, y: p.y + p.size / 2, radius: 90, timer: 25, shooter: p });
                    break;
                }
                case 'pickpocket': {
                    const radius = 145;
                    dealAoeDamage(cx, cy, radius, p.laserDamage * 2.4, p);
                    const hitEnemies = players.filter(t => t !== p && t.currentHp > 0 && (!p.team || t.team !== p.team) && Math.hypot((t.x + t.size / 2) - cx, (t.y + t.size / 2) - cy) <= radius).length;
                    if (hitEnemies > 0) {
                        const gain = hitEnemies * 8;
                        playerCredits += gain;

                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: radius, timer: 22, shooter: p });
                    break;
                }
                case 'bananastorm': {
                    fireRadialBurst(p, 12, p.laserDamage * 2.2, 12, 95);
                    for (let i = 0; i < 4; i++) {
                        const a = (Math.PI * 2 / 4) * i;
                        superEffects.push({ type: 'smokezone', x: cx + Math.cos(a) * 55, y: cy + Math.sin(a) * 55, radius: 50, timer: 110, tickTimer: 0, tickInterval: 26, damage: Math.max(1, Math.round(p.laserDamage * 0.7)), shooter: p });
                    }
                    break;
                }
                case 'smokezone': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    // Large slow+damage zone at target position
                    superEffects.push({ type: 'smokezone', x: tx, y: ty, radius: 160, timer: 300, tickTimer: 0, tickInterval: 40, damage: p.laserDamage, shooter: p });
                    break;
                }
                case 'snakeswarm': {
                    for (let i = 0; i < 3; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spawnDist = 24 + Math.random() * 18;
                        const snakeHp = 5 * COMBAT_STAT_SCALE;
                        snakeMinions.push({
                            id: `snake_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
                            owner: p,
                            x: cx + Math.cos(angle) * spawnDist,
                            y: cy + Math.sin(angle) * spawnDist,
                            size: 20,
                            hp: snakeHp,
                            maxHp: snakeHp,
                            damage: 2 * COMBAT_STAT_SCALE,
                            speed: 3.5,
                            life: 1080,
                            attackCooldown: Math.floor(Math.random() * 20)
                        });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 70, timer: 24, shooter: p });
                    break;
                }
                case 'bubbleburst': {
                    // Create 5 floating bubble zones around player
                    for (let i = 0; i < 5; i++) {
                        const angle = (Math.PI * 2 / 5) * i;
                        const offsetDist = 100;
                        superEffects.push({
                            type: 'bubbleburst',
                            x: cx + Math.cos(angle) * offsetDist,
                            y: cy + Math.sin(angle) * offsetDist,
                            radius: 60,
                            timer: 200,
                            tickTimer: 0,
                            tickInterval: 35,
                            damage: Math.max(1, Math.round(p.laserDamage * 1.8)),
                            shooter: p,
                            angle: angle,
                            orbitSpeed: 2
                        });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 100, timer: 24, shooter: p });
                    break;
                }
                case 'pompquake': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    const radius = 170;
                    dealAoeDamage(tx, ty, radius, p.laserDamage * 3, p);
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        const tcx = t.x + t.size / 2;
                        const tcy = t.y + t.size / 2;
                        const dx = tcx - tx;
                        const dy = tcy - ty;
                        const d = Math.hypot(dx, dy);
                        if (d > 0 && d < radius) {
                            const push = (1 - d / radius) * 140;
                            displaceEntitySafely(t, (dx / d) * push, (dy / d) * push);
                        }
                    }
                    superEffects.push({ type: 'tornado', x: tx, y: ty, radius: radius, timer: 22, tickTimer: 999, tickInterval: 999, damage: 0, shooter: p, angle: 0 });
                    break;
                }
                case 'cardcage': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    const radius = 150;
                    dealAoeDamage(tx, ty, radius, p.laserDamage * 3.2, p);
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        const d = Math.hypot((t.x + t.size / 2) - tx, (t.y + t.size / 2) - ty);
                        if (d < radius) t._slowTimer = Math.max(t._slowTimer || 0, 120);
                    }
                    for (let i = 0; i < 10; i++) {
                        const a = (Math.PI * 2 / 10) * i;
                        const vx = Math.cos(a) * 9.2;
                        const vy = Math.sin(a) * 9.2;
                        lasers.push({ x: tx, y: ty, vx, vy, life: 78, damage: Math.max(1, Math.round(p.laserDamage * 1.2)), shooter: p, attackType: 'cardslash', boomerang: true, returnTimer: 24, origVx: vx, origVy: vy, isSuperLaser: true });
                    }
                    superEffects.push({ type: 'tornado', x: tx, y: ty, radius: radius, timer: 24, tickTimer: 999, tickInterval: 999, damage: 0, shooter: p, angle: 0 });
                    break;
                }
                case 'rockrush': {
                    // Charge in facing direction, stopping at first obstacle
                    const tx2 = targetX ?? cx + 1;
                    const ty2 = targetY ?? cy;
                    const d2 = Math.hypot(tx2 - cx, ty2 - cy) || 1;
                    const stepX = (tx2 - cx) / d2 * 20;
                    const stepY = (ty2 - cy) / d2 * 20;
                    const steps = 20;
                    for (let s = 0; s < steps; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + stepX));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + stepY));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) {
                                blocked = true; break;
                            }
                        }
                        if (blocked) break;
                        p.x = nx;
                        p.y = ny;
                    }
                    dealAoeDamage(p.x + p.size / 2, p.y + p.size / 2, 100, p.laserDamage * 6, p);
                    superEffects.push({ type: 'screamflash', x: p.x + p.size / 2, y: p.y + p.size / 2, radius: 100, timer: 25, shooter: p });
                    break;
                }
                case 'traplayer': {
                    // Activate trap-laying mode for 5 seconds (300 frames)
                    p.superActive = true;
                    p.superTimer = 300;
                    p.superBuffType = 'traplayer';
                    p._trapLayCooldown = 0;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 60, timer: 20, shooter: p });
                    break;
                }
                case 'magnetswap': {
                    // Transform into "-" form; spawn "+" companion at current position
                    const compHp = Math.max(10, Math.ceil(p.currentHp * 0.55));
                    p._magnetPlus = {
                        id: `${p.id || p.characterId || 'magnets'}_plus_clone`,
                        characterId: 'magnets',
                        name: `${p.name} +`,
                        x: p.x + p.size / 2 - 23,
                        y: p.y + p.size / 2 - 23,
                        size: 46,
                        team: p.team,
                        owner: p,
                        isMagnetClone: true,
                        _magnetsMinus: false,
                        color: p.color || '#ef4444',
                        img: 'images/plus.png',
                        currentHp: compHp,
                        hp: compHp,
                        maxHp: compHp,
                        speed: (p.speed || 5) + 0.5,
                        damage: Math.max(1, p.laserDamage || 3),
                        attackCooldown: 0,
                        _orbitAngle: Math.random() * Math.PI * 2
                    };
                    p._magnetsMinus = true;
                    p.superActive = true;
                    p.superTimer = 900; // 15 s max
                    p.superBuffType = 'magnetswap';
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 70, timer: 22, shooter: p });
                    break;
                }
                case 'bubbleburst': {
                    // Create 5 floating bubble zones around player that expand and contract
                    for (let i = 0; i < 5; i++) {
                        const angle = (Math.PI * 2 / 5) * i;
                        const offsetDist = 100;
                        superEffects.push({
                            type: 'bubbleburst',
                            x: cx + Math.cos(angle) * offsetDist,
                            y: cy + Math.sin(angle) * offsetDist,
                            radius: 60,
                            timer: 200,
                            tickTimer: 0,
                            tickInterval: 35,
                            damage: Math.max(1, Math.round(p.laserDamage * 1.8)),
                            shooter: p,
                            angle: angle,
                            orbitSpeed: 2.5
                        });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 100, timer: 24, shooter: p });
                    break;
                }
                case 'groundslam': {
                    const radius = 130;
                    dealAoeDamage(cx, cy, radius, p.laserDamage * 4.8, p);
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        const dx = (t.x + t.size / 2) - cx;
                        const dy = (t.y + t.size / 2) - cy;
                        const d = Math.hypot(dx, dy);
                        if (d > 0 && d < radius) {
                            t._stunTimer = Math.max(t._stunTimer || 0, 70);
                            const push = (1 - d / radius) * 120;
                            displaceEntitySafely(t, (dx / d) * push, (dy / d) * push);
                        }
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius, timer: 24, shooter: p });
                    break;
                }
                case 'icestorm': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    const radius = 190;
                    // Deal moderate damage + slow all enemies in zone
                    dealAoeDamage(tx, ty, radius, p.laserDamage * 2.5, p);
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        const d = Math.hypot((t.x + t.size / 2) - tx, (t.y + t.size / 2) - ty);
                        if (d < radius) t._slowTimer = Math.max(t._slowTimer || 0, 180); // 3 s freeze slow
                    }
                    // Ice zone visual â€” reuse smokezone for the denial field
                    superEffects.push({ type: 'smokezone', x: tx, y: ty, radius: radius, timer: 240, tickTimer: 0, tickInterval: 50, damage: Math.max(1, Math.round(p.laserDamage * 0.6)), shooter: p, iceZone: true });
                    superEffects.push({ type: 'screamflash', x: tx, y: ty, radius: 120, timer: 20, shooter: p });
                    break;
                }
                case 'darkrift': {
                    const tx = targetX ?? cx;
                    const ty = targetY ?? cy;
                    const radius = 200;
                    // Pull all enemies toward the rift center, then deal heavy damage
                    for (const t of players) {
                        if (t === p || (p.team && t.team === p.team) || t.currentHp <= 0) continue;
                        const tcx = t.x + t.size / 2;
                        const tcy = t.y + t.size / 2;
                        const dx = tx - tcx;
                        const dy = ty - tcy;
                        const d = Math.hypot(dx, dy);
                        if (d > 0 && d < radius) {
                            const pull = (1 - d / radius) * 160;
                            displaceEntitySafely(t, (dx / d) * pull, (dy / d) * pull);
                        }
                    }
                    dealAoeDamage(tx, ty, radius, p.laserDamage * 4, p);
                    // Brief stun on nearest enemy in range
                    const nearestInRift = players.filter(t => t !== p && t.currentHp > 0 && (!p.team || t.team !== p.team) && Math.hypot((t.x + t.size / 2) - tx, (t.y + t.size / 2) - ty) < 80);
                    if (nearestInRift.length > 0) nearestInRift[0]._stunTimer = 75;
                    superEffects.push({ type: 'tornado', x: tx, y: ty, radius: radius, timer: 35, tickTimer: 999, tickInterval: 999, damage: 0, shooter: p, angle: 0 });
                    superEffects.push({ type: 'screamflash', x: tx, y: ty, radius: 100, timer: 22, shooter: p });
                    break;
                }
                default:
                    fireRadialBurst(p, 8, p.laserDamage * 3, 14, 100);
            }
        }

        // â”€â”€ Gadget activation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function activateGadget(p, aimX, aimY) {
            const gdKey = getEquippedGadgetKey(p);
            if (!gdKey) {
                if (p.isHuman) showLootboxPopup('ðŸ”’ Gadget locked! Buy one from player details or win one from chest drops.');
                return;
            }
            const gd = gadgetData[gdKey] || gadgetData['default'];
            p.gadgetCooldown = gd.cooldown;
            const cx = p.x + p.size / 2, cy = p.y + p.size / 2;

            let dirX = p.vx || 0, dirY = p.vy || 0;
            const dirLen = Math.hypot(dirX, dirY);
            if (dirLen > 0) { dirX /= dirLen; dirY /= dirLen; }
            else { dirX = 1; dirY = 0; }

            let aimDx = (aimX || cx + 100) - cx, aimDy = (aimY || cy) - cy;
            const aimLen = Math.hypot(aimDx, aimDy) || 1;
            aimDx /= aimLen; aimDy /= aimLen;

            switch (gdKey) {
                case 'default':
                    p._speedTimer = 120; p._damageTimer = 120;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 40, timer: 20, shooter: p });
                    break;
                case 'lazerman': {
                    for (let s = 0; s < 25; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + dirX * 10));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + dirY * 10));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) { blocked = true; break; }
                        }
                        if (blocked) break;
                        p.x = nx; p.y = ny;
                    }
                    gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: p.x + p.size/2, ey: p.y + p.size/2, timer: 20, color: '#4ae8ff' });
                    break;
                }
                case 'fournakis':
                    superEffects.push({ type: 'firezone', x: cx, y: cy, radius: 90, timer: 150, tickTimer: 0, tickInterval: 25, damage: p.laserDamage * 2, shooter: p });
                    break;
                case 'baklavasbazookos':
                    p._damageTimer = 180;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 35, timer: 18, shooter: p });
                    break;
                case 'firekoupepy':
                    p._speedTimer = 90;
                    superEffects.push({ type: 'firezone', x: cx, y: cy, radius: 70, timer: 120, tickTimer: 0, tickInterval: 20, damage: p.laserDamage, shooter: p });
                    break;
                case 'tornader': {
                    for (const other of players) {
                        if (other === p || other.currentHp <= 0) continue;
                        if (p.team && other.team === p.team) continue;
                        const dx = other.x + other.size/2 - cx, dy = other.y + other.size/2 - cy;
                        const d = Math.hypot(dx, dy);
                        if (d < 200 && d > 0) {
                            const force = (1 - d/200) * 220;
                            displaceEntitySafely(other, dx/d * force, dy/d * force);
                            if (other._slowTimer !== undefined) other._slowTimer = 60;
                        }
                    }
                    superEffects.push({ type: 'tornado', x: cx, y: cy, radius: 200, timer: 40, tickTimer: 999, tickInterval: 999, damage: 0, shooter: p, angle: 0 });
                    break;
                }
                case 'boboshiros':
                    p._shieldHp = (p._shieldHp || 0) + 20 * COMBAT_STAT_SCALE;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 45, timer: 20, shooter: p });
                    break;
                case 'kafekauboy':
                    p._speedTimer = 180; p._damageTimer = 180; p._fireBoostTimer = 180;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 40, timer: 18, shooter: p });
                    break;
                case 'megagrinos': {
                    let nearest = null, minD = 350;
                    for (const other of players) {
                        if (other === p || other.currentHp <= 0) continue;
                        if (p.team && other.team === p.team) continue;
                        const d = Math.hypot(other.x - p.x, other.y - p.y);
                        if (d < minD) { minD = d; nearest = other; }
                    }
                    if (nearest) {
                        nearest._stunTimer = 90;
                        superEffects.push({ type: 'screamflash', x: nearest.x + nearest.size/2, y: nearest.y + nearest.size/2, radius: 50, timer: 22, shooter: p });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 55, timer: 20, shooter: p });
                    break;
                }
                case 'kleftikomegazord':
                    p.gadgetInvisibleTimer = 120;
                    gadgetEffects.push({ type: 'cloak', x: cx, y: cy, timer: 18, color: '#8844ff' });
                    break;
                case 'petras':
                    superEffects.push({ type: 'bigshot', x: cx, y: cy, vx: aimDx * 6, vy: aimDy * 6, radius: 22, damage: p.laserDamage * 4, shooter: p, life: 180 });
                    break;
                case 'rocky': {
                    for (let s = 0; s < 20; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + dirX * 12));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + dirY * 12));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) { blocked = true; break; }
                        }
                        if (blocked) break;
                        p.x = nx; p.y = ny;
                    }
                    dealAoeDamage(p.x + p.size/2, p.y + p.size/2, 80, p.laserDamage * 3, p);
                    gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: p.x + p.size/2, ey: p.y + p.size/2, timer: 20, color: '#ff8844' });
                    superEffects.push({ type: 'screamflash', x: p.x + p.size/2, y: p.y + p.size/2, radius: 60, timer: 20, shooter: p });
                    break;
                }
                case 'timor':
                    superEffects.push({ type: 'bigshot', x: cx, y: cy, vx: aimDx * 7, vy: aimDy * 7, radius: 18, damage: p.laserDamage * 5, shooter: p, life: 120 });
                    break;
                case 'timor_mine':
                    superEffects.push({ type: 'firezone', x: cx + aimDx * 40, y: cy + aimDy * 40, radius: 65, timer: 120, tickTimer: 0, tickInterval: 15, damage: Math.max(1, Math.round(p.laserDamage * 1.6)), shooter: p });
                    break;
                case 'timor_rocket': {
                    for (let s = 0; s < 20; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + aimDx * 12));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + aimDy * 12));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x && ny < obs.y + obs.height && ny + p.size > obs.y) { blocked = true; break; }
                        }
                        if (blocked) break;
                        p.x = nx;
                        p.y = ny;
                    }
                    dealAoeDamage(p.x + p.size / 2, p.y + p.size / 2, 75, p.laserDamage * 2.5, p);
                    gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: p.x + p.size / 2, ey: p.y + p.size / 2, timer: 20, color: '#ff8844' });
                    break;
                }
                case 'kleftros': {
                    const tx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + dirX * 300));
                    const ty = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + dirY * 300));
                    let blocked = false;
                    for (const obs of obstacles) {
                        if (!isBlockingObstacleForEntity(p, obs)) continue;
                        if (tx < obs.x + obs.width && tx + p.size > obs.x &&
                            ty < obs.y + obs.height && ty + p.size > obs.y) { blocked = true; break; }
                    }
                    if (!blocked) {
                        gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: tx + p.size/2, ey: ty + p.size/2, timer: 20, color: '#cc44ff' });
                        p.x = tx; p.y = ty;
                    }
                    break;
                }
                case 'kapnas':
                    superEffects.push({ type: 'smokezone', x: cx, y: cy, radius: 110, timer: 180, tickTimer: 0, tickInterval: 40, damage: 0, shooter: p });
                    break;
                case 'fidas':
                    for (let i = 0; i < 2; i++) {
                        const a = (Math.PI * 2 / 2) * i;
                        superEffects.push({ type: 'smokezone', x: cx + Math.cos(a) * 45, y: cy + Math.sin(a) * 45, radius: 55, timer: 120, tickTimer: 0, tickInterval: 30, damage: COMBAT_STAT_SCALE, shooter: p });
                    }
                    p._speedTimer = 120;
                    break;
                case 'pompakis':
                    p._shieldHp = (p._shieldHp || 0) + 25 * COMBAT_STAT_SCALE;
                    p._speedTimer = 120;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 50, timer: 20, shooter: p });
                    break;
                case 'freze': {
                    // Ice dash: dash forward, leave a small ice slow zone at starting position
                    for (let s = 0; s < 22; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + dirX * 11));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + dirY * 11));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x &&
                                ny < obs.y + obs.height && ny + p.size > obs.y) { blocked = true; break; }
                        }
                        if (blocked) break;
                        p.x = nx; p.y = ny;
                    }
                    // Leave ice slow zone at start position
                    superEffects.push({ type: 'smokezone', x: cx, y: cy, radius: 80, timer: 150, tickTimer: 0, tickInterval: 35, damage: 0, shooter: p, iceZone: true });
                    gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: p.x + p.size/2, ey: p.y + p.size/2, timer: 22, color: '#7dd3fc' });
                    break;
                }
                case 'kara': {
                    // Dark Barrier: gain shield + stun nearest enemy in range
                    p._shieldHp = (p._shieldHp || 0) + 22 * COMBAT_STAT_SCALE;
                    let nearestEnemy = null, minDE = 300;
                    for (const other of players) {
                        if (other === p || other.currentHp <= 0) continue;
                        if (p.team && other.team === p.team) continue;
                        const d = Math.hypot(other.x - p.x, other.y - p.y);
                        if (d < minDE) { minDE = d; nearestEnemy = other; }
                    }
                    if (nearestEnemy) {
                        nearestEnemy._stunTimer = Math.max(nearestEnemy._stunTimer || 0, 80);
                        superEffects.push({ type: 'screamflash', x: nearestEnemy.x + nearestEnemy.size/2, y: nearestEnemy.y + nearestEnemy.size/2, radius: 45, timer: 20, shooter: p });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 55, timer: 22, shooter: p });
                    gadgetEffects.push({ type: 'cloak', x: cx, y: cy, timer: 14, color: '#c084fc' });
                    break;
                }
                case 'punchpunch': {
                    for (let s = 0; s < 16; s++) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - p.size, p.x + aimDx * 10));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - p.size, p.y + aimDy * 10));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (!isBlockingObstacleForEntity(p, obs)) continue;
                            if (nx < obs.x + obs.width && nx + p.size > obs.x && ny < obs.y + obs.height && ny + p.size > obs.y) { blocked = true; break; }
                        }
                        if (blocked) break;
                        p.x = nx;
                        p.y = ny;
                    }
                    p._shieldHp = (p._shieldHp || 0) + 14 * COMBAT_STAT_SCALE;
                    dealAoeDamage(p.x + p.size / 2, p.y + p.size / 2, 70, p.laserDamage * 2.2, p);
                    gadgetEffects.push({ type: 'dashtrail', x: cx, y: cy, ex: p.x + p.size / 2, ey: p.y + p.size / 2, timer: 18, color: '#fb923c' });
                    break;
                }
                case 'cardon': {
                    p._shieldHp = (p._shieldHp || 0) + 14 * COMBAT_STAT_SCALE;
                    for (const angle of [-0.35, -0.12, 0.12, 0.35]) {
                        const c = Math.cos(angle), s = Math.sin(angle);
                        const vx = (aimDx * c - aimDy * s) * 7.8;
                        const vy = (aimDx * s + aimDy * c) * 7.8;
                        superEffects.push({ type: 'bigshot', x: cx, y: cy, vx, vy, radius: 12, damage: Math.max(1, Math.round(p.laserDamage * 1.25)), shooter: p, life: 65 });
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 48, timer: 18, shooter: p });
                    break;
                }
                case 'slamforge': {
                    p._shieldHp = (p._shieldHp || 0) + 20 * COMBAT_STAT_SCALE;
                    p._speedTimer = Math.max(p._speedTimer || 0, 95);
                    dealAoeDamage(cx, cy, 110, p.laserDamage * 1.8, p);
                    for (const other of players) {
                        if (other === p || other.currentHp <= 0) continue;
                        if (p.team && other.team === p.team) continue;
                        const d = Math.hypot((other.x + other.size / 2) - cx, (other.y + other.size / 2) - cy);
                        if (d < 110) other._slowTimer = Math.max(other._slowTimer || 0, 80);
                    }
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 72, timer: 18, shooter: p });
                    break;
                }
                case 'bubl': {
                    // Bubble Shield: create protective bubble zones around player
                    for (let i = 0; i < 3; i++) {
                        const angle = (Math.PI * 2 / 3) * i;
                        const offsetDist = 60;
                        superEffects.push({
                            type: 'bubbleburst',
                            x: cx + Math.cos(angle) * offsetDist,
                            y: cy + Math.sin(angle) * offsetDist,
                            radius: 45,
                            timer: 160,
                            tickTimer: 0,
                            tickInterval: 40,
                            damage: Math.max(1, Math.round(p.laserDamage * 1.3)),
                            shooter: p,
                            angle: angle,
                            orbitSpeed: 2
                        });
                    }
                    p._shieldHp = (p._shieldHp || 0) + 15 * COMBAT_STAT_SCALE;
                    superEffects.push({ type: 'screamflash', x: cx, y: cy, radius: 50, timer: 18, shooter: p });
                    break;
                }
                default:
                    p._speedTimer = 90;
                    break;
            }

            // Timor cycles through owned gadgets each use.
            if ((p.characterId || p.id) === 'timor') {
                const owned = getOwnedGadgetKeysForPlayer('timor');
                if (owned.length > 0) p._timorGadgetCycle = ((p._timorGadgetCycle || 0) + 1) % owned.length;
            }
        }

        // â”€â”€ Magnets helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function getLivingMagnetsCompanions() {
            const list = [];
            for (const owner of players) {
                const comp = owner._magnetPlus;
                if (!comp) continue;
                const compHp = comp.currentHp !== undefined ? comp.currentHp : comp.hp;
                if (compHp <= 0) continue;
                list.push({ owner, companion: comp });
            }
            return list;
        }

        function tryHandleCompanionDeath(target, killer) {
            if (!target || !target.isMagnetClone) return false;
            const owner = target.owner || players.find(p => p._magnetPlus === target);
            if (owner) {
                owner._magnetPlus = null;
                owner._magnetsMinus = false;
                owner.superActive = false;
                owner.superTimer = 0;
                owner.superBuffType = null;
            }
            if (killer) {
                killer.kills = (killer.kills || 0) + 1;
                killFeed.push({ killerName: killer.name, victimName: `${owner?.name || 'Magnets'} (+)`, ts: Date.now(), isHumanKill: killer.isHuman });
                if (killer.isHuman) {
                    awardMedals(1);
                    registerKill();
                    progressDaily('kills', 1);
                }
            }
            return true;
        }

        // Returns true if the player was saved by their "+" companion (HP swapped),
        // so the caller should skip the normal death logic.
        function tryMagnetsRespawn(p) {
            if (!p._magnetsMinus || !p._magnetPlus) return false;
            const comp = p._magnetPlus;
            const compHp = comp.currentHp !== undefined ? comp.currentHp : comp.hp;
            if (compHp <= 0) return false;
            p.x = comp.x;
            p.y = comp.y;
            p.currentHp = Math.max(1, compHp);
            p._magnetsMinus = false;
            p._magnetPlus = null;
            p.superActive = false;
            p.superTimer = 0;
            p.superBuffType = null;
            superEffects.push({ type: 'screamflash', x: p.x + p.size / 2, y: p.y + p.size / 2, radius: 55, timer: 20, shooter: p });
            return true;
        }

        function healMagnetsCompanion(comp) {
            if (!comp || (comp.currentHp !== undefined ? comp.currentHp : comp.hp) <= 0) return;
            if (comp.maxHp <= 0) return;

            let hpNow = comp.currentHp !== undefined ? comp.currentHp : comp.hp;

            // Direct heal packs
            for (let i = healthPacks.length - 1; i >= 0; i--) {
                const pack = healthPacks[i];
                if (comp.x < pack.x + pack.size && comp.x + comp.size > pack.x &&
                    comp.y < pack.y + pack.size && comp.y + comp.size > pack.y) {
                    const amount = pack.healAmount || Math.round(8 * COMBAT_STAT_SCALE);
                    const before = hpNow;
                    hpNow = Math.min(comp.maxHp, hpNow + amount);
                    const healed = Math.max(0, hpNow - before);
                    if (healed > 0) {
                        spawnHealPickupEffect(comp.x + comp.size / 2, comp.y + comp.size / 2, 1);
                    }
                    healthPacks.splice(i, 1);
                    setTimeout(() => {
                        if (!gameStarted) return;
                        const pos = getSpawnPosition(26);
                        healthPacks.push({ x: pos.x, y: pos.y, size: 26, healAmount: Math.round(8 * COMBAT_STAT_SCALE) });
                    }, 14000);
                }
            }

            // Ground heal pickups dropped from crates
            for (let i = pickupItems.length - 1; i >= 0; i--) {
                const item = pickupItems[i];
                if (item.type !== 'heal') continue;
                if (comp.x < item.x + item.size && comp.x + comp.size > item.x &&
                    comp.y < item.y + item.size && comp.y + comp.size > item.y) {
                    const amount = ITEM_HEAL_AMOUNT;
                    const before = hpNow;
                    hpNow = Math.min(comp.maxHp, hpNow + amount);
                    const healed = Math.max(0, hpNow - before);
                    if (healed > 0) {
                        spawnHealPickupEffect(comp.x + comp.size / 2, comp.y + comp.size / 2, 2);
                    }
                    pickupItems.splice(i, 1);
                }
            }

            comp.currentHp = hpNow;
            comp.hp = hpNow;
        }

        function updateMagnetsCompanions() {
            for (const owner of players) {
                const comp = owner._magnetPlus;
                if (!comp) continue;
                // End super if timer expired or owner lost minus form
                if (!owner._magnetsMinus || owner.superTimer <= 0) {
                    owner._magnetPlus = null;
                    owner._magnetsMinus = false;
                    continue;
                }
                const compHp = comp.currentHp !== undefined ? comp.currentHp : comp.hp;
                if (compHp <= 0) {
                    owner._magnetPlus = null;
                    owner._magnetsMinus = false;
                    owner.superActive = false;
                    owner.superTimer = 0;
                    continue;
                }
                healMagnetsCompanion(comp);
                // Find target
                let target = null, bestDist = 520;
                for (const p of players) {
                    if (p === owner || p.currentHp <= 0) continue;
                    if (owner.team && p.team === owner.team) continue;
                    const d = Math.hypot((p.x + p.size / 2) - comp.x, (p.y + p.size / 2) - comp.y);
                    if (d < bestDist) { bestDist = d; target = p; }
                }
                if (target) {
                    const tx = target.x + target.size / 2, ty = target.y + target.size / 2;
                    const dx = tx - comp.x, dy = ty - comp.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const reach = target.size / 2 + comp.size / 2 + 8;
                    if (d > reach) {
                        const nx = Math.max(0, Math.min(MAP_WIDTH - comp.size, comp.x + (dx / d) * comp.speed));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT - comp.size, comp.y + (dy / d) * comp.speed));
                        // Clone must obey all normal movement blocking: walls and lakes.
                        if (canEntityMoveTo(comp, nx, comp.y)) comp.x = nx;
                        if (canEntityMoveTo(comp, comp.x, ny)) comp.y = ny;
                    }
                    if (d <= reach + comp.speed && comp.attackCooldown <= 0) {
                        if (!hasDamageShield(target)) {
                            const dmg = comp.damage;
                            const actual = Math.min(dmg, Math.max(0, target.currentHp));
                            target.currentHp -= dmg;
                            if (actual > 0) registerDamageFeedback(target, actual, '#f87171');
                            owner.damageDealt = (owner.damageDealt || 0) + actual;
                            target.bushRevealTimer = 60;
                            comp.attackCooldown = 28;
                            // Kill handling (FFA only, simplified)
                            if (target.currentHp <= 0 && !tryMagnetsRespawn(target)) {
                                target.currentHp = 0;
                                owner.kills = (owner.kills || 0) + 1;
                                killFeed.push({ killerName: owner.name, victimName: target.name, ts: Date.now(), isHumanKill: owner.isHuman });
                                if (owner.isHuman) { awardMedals(1); registerKill(); progressDaily('kills', 1); }
                                checkBountyWin();
                                const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                                if (isTeamMode) { target.respawnTimer = getRespawnFramesForMode(); target.dead = true; dropPlayerItems(target); }
                                else {
                                    if (target.isBot && getRespawnFramesForMode() > 0) { target.respawnTimer = getRespawnFramesForMode(); target.dead = true; dropPlayerItems(target); }
                                    else { dropPlayerItems(target); matchStatsList.push({ name: target.name, kills: target.kills, damageDealt: target.damageDealt, healingReceived: target.healingReceived, team: target.team, isHuman: target.isHuman }); const idx = players.indexOf(target); if (idx !== -1) players.splice(idx, 1); if (target.isBot) { const bi = bots.findIndex(b => b.id === target.id); if (bi !== -1) bots.splice(bi, 1); } if (target.isHuman) endGame('Game Over! You were defeated!', false); }
                                }
                            }
                        } else { comp.attackCooldown = 16; }
                    }
                } else {
                    // Orbit the owner
                    comp._orbitAngle = (comp._orbitAngle || 0) + 0.07;
                    const ox = owner.x + owner.size / 2 + Math.cos(comp._orbitAngle) * 54;
                    const oy = owner.y + owner.size / 2 + Math.sin(comp._orbitAngle) * 54;
                    comp.x += (ox - comp.x) * 0.12;
                    comp.y += (oy - comp.y) * 0.12;
                }
                if (comp.attackCooldown > 0) comp.attackCooldown--;
            }
        }

        function drawMagnetsCompanions() {
            for (const owner of players) {
                const comp = owner._magnetPlus;
                if (!comp || (comp.currentHp !== undefined ? comp.currentHp : comp.hp) <= 0) continue;
                const cx = comp.x - camera.x;
                const cy = comp.y - camera.y;
                ctx.save();
                const spriteSrc = getPlayerPreferredImageSrc(comp);
                const imgEntry = spriteSrc ? loadImage(spriteSrc) : null;
                if (imgEntry && imgEntry.complete && !imgEntry._failed && imgEntry.naturalWidth > 0) {
                    ctx.drawImage(imgEntry, cx, cy, comp.size, comp.size);
                } else {
                    // Fallback to owner color if sprite fails
                    ctx.fillStyle = comp.color || owner.color || '#ef4444';
                    ctx.fillRect(cx, cy, comp.size, comp.size);
                }
                // HP bar
                const barW = comp.size;
                const hpRatio = Math.max(0, (comp.currentHp !== undefined ? comp.currentHp : comp.hp) / comp.maxHp);
                ctx.fillStyle = '#333';
                ctx.fillRect(cx, cy - 10, barW, 5);
                ctx.fillStyle = hpRatio > 0.6 ? '#00ff00' : hpRatio > 0.3 ? '#ffff00' : '#ff4444';
                ctx.fillRect(cx, cy - 10, barW * hpRatio, 5);
                ctx.restore();
            }
        }

