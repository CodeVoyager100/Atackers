        function updateRespawns() {
            const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
            if (currentGameMode === 'elimination' || currentGameMode === 'showdown' || currentGameMode === 'easyStage') return; // no respawns

            function setSafeRespawnPosition(p, desiredX, desiredY) {
                let x = Math.max(0, Math.min(desiredX, MAP_WIDTH - p.size));
                let y = Math.max(0, Math.min(desiredY, MAP_HEIGHT - p.size));
                if (isValidSpawnPosition(x, y, p.size)) {
                    p.x = x;
                    p.y = y;
                    return;
                }
                for (let attempt = 0; attempt < 40; attempt++) {
                    const rx = x + (Math.random() - 0.5) * 280;
                    const ry = y + (Math.random() - 0.5) * 280;
                    const nx = Math.max(0, Math.min(rx, MAP_WIDTH - p.size));
                    const ny = Math.max(0, Math.min(ry, MAP_HEIGHT - p.size));
                    if (isValidSpawnPosition(nx, ny, p.size)) {
                        p.x = nx;
                        p.y = ny;
                        return;
                    }
                }
                const fallback = getSpawnPosition(p.size);
                p.x = fallback.x;
                p.y = fallback.y;
            }

            for (let p of players) {
                if (p.currentHp > 0 || !p.respawnTimer) continue;

                if (isTeamMode) {
                    const hasLivingTeammate = players.some(t => t !== p && t.team === p.team && t.currentHp > 0);
                    if (!hasLivingTeammate) {
                        // Team wipe: no teammate alive means no respawn.
                        p.respawnTimer = 0;
                        continue;
                    }
                }

                p.respawnTimer--;

                if (p.respawnTimer <= 0) {
                    // Respawn the player
                    if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && ball && ball.carrier === p) {
                        dropBall(p);
                    }
                    p.currentHp = p.maxHp;
                    p.dead = false;
                    p.respawnTimer = 0;
                    p.bushRevealTimer = 0;
                    p.gadgetInvisibleTimer = 0;
                    p._stunTimer = 0;
                    p._slowTimer = 0;
                    p.superInvincible = false;
                    p.shootCooldown = 0;
                    p.hasBall = false;
                    p.spawnShieldTimer = getSpawnShieldFrames();
                    let spawnX = p.x;
                    let spawnY = p.y;
                    // Show respawn message
                    if (p.isHuman) levelUpMessage = { text: 'âœ¨ Respawned!', timer: 90 };

                    // Determine spawn position.
                    // Team respawn modes always spawn near a living teammate.
                    if (isTeamMode) {
                        const livingTeammates = players.filter(t => t !== p && t.team === p.team && t.currentHp > 0);
                        if (livingTeammates.length > 0) {
                            const mate = livingTeammates[Math.floor(Math.random() * livingTeammates.length)];
                            const angle = Math.random() * Math.PI * 2;
                            const dist = 72 + Math.random() * 56;
                            spawnX = mate.x + Math.cos(angle) * dist;
                            spawnY = mate.y + Math.sin(angle) * dist;
                        }
                    } else {
                        const freeSpawn = getSpawnPosition(p.size);
                        spawnX = freeSpawn.x;
                        spawnY = freeSpawn.y;
                    }

                    setSafeRespawnPosition(p, spawnX, spawnY);
                }
            }
        }

        // FIXED LASER COLLISION SYSTEM - AI lasers can damage other AI players AND check obstacle collisions
        function updateLasers() {
            // Update player lasers
            for (let i = lasers.length - 1; i >= 0; i--) {
                const laser = lasers[i];
                if (!laser || typeof laser.x !== 'number' || typeof laser.y !== 'number' || typeof laser.vx !== 'number' || typeof laser.vy !== 'number') {
                    lasers.splice(i, 1);
                    continue;
                }
                if (!laser.shooter) {
                    laser.shooter = { team: null, isHuman: false, superCharge: 0, damageDealt: 0, laserRange: Infinity, _damageTimer: 0 };
                }
                // Store previous position for swept collision detection
                laser._prevX = laser.x;
                laser._prevY = laser.y;
                laser.x += laser.vx;
                laser.y += laser.vy;
                laser.life--;

                // Initialize range metadata for any legacy/projectile-created lasers.
                if (laser.startX === undefined || laser.startY === undefined) {
                    laser.startX = laser.x;
                    laser.startY = laser.y;
                }
                if (laser.maxRange === undefined) {
                    laser.maxRange = laser.shooter?.laserRange || Infinity;
                }

                // Remove projectiles that exceed shown attack range.
                if (Math.hypot(laser.x - laser.startX, laser.y - laser.startY) > laser.maxRange) {
                    lasers.splice(i, 1);
                    continue;
                }

                // Homing: steer toward nearest enemy for a short duration only.
                if (laser.attackType === 'homing' && (laser.homingFrames === undefined || laser.homingFrames > 0)) {
                    if (laser.homingFrames === undefined) laser.homingFrames = 34;
                    laser.homingFrames--;
                    let nearest = null, nearestDist = Infinity;
                    for (const p of players) {
                        if (p === laser.shooter || (laser.shooter.team && p.team === laser.shooter.team) || p.currentHp <= 0) continue;
                        const d = Math.hypot(p.x + p.size / 2 - laser.x, p.y + p.size / 2 - laser.y);
                        if (d < nearestDist) { nearestDist = d; nearest = p; }
                    }
                    for (const { owner: compOwner, companion: comp } of getLivingMagnetsCompanions()) {
                        if (compOwner === laser.shooter || comp === laser.shooter) continue;
                        if (laser.shooter.team && comp.team === laser.shooter.team) continue;
                        const d = Math.hypot(comp.x + comp.size / 2 - laser.x, comp.y + comp.size / 2 - laser.y);
                        if (d < nearestDist) { nearestDist = d; nearest = comp; }
                    }
                    if (nearest) {
                        const tdx = nearest.x + nearest.size / 2 - laser.x;
                        const tdy = nearest.y + nearest.size / 2 - laser.y;
                        const td = Math.hypot(tdx, tdy) || 1;
                        const inLockDistance = nearestDist <= (laser.maxRange || Infinity) * 0.55;
                        if (inLockDistance) {
                            const spd = laser.homingSpeed || 8;
                            const turn = laser.homingTurn || 0.06;
                            const vLen = Math.hypot(laser.vx, laser.vy) || 1;
                            const dot = (laser.vx / vLen) * (tdx / td) + (laser.vy / vLen) * (tdy / td);
                            if (dot > 0.1) {
                                laser.vx += (tdx / td * spd - laser.vx) * turn;
                                laser.vy += (tdy / td * spd - laser.vy) * turn;
                            }
                        }
                    }
                }

                // Boomerang: reverse direction halfway through life
                if (laser.boomerang && laser.returnTimer > 0) {
                    laser.returnTimer--;
                    if (laser.returnTimer <= 0) {
                        laser.vx = -laser.origVx;
                        laser.vy = -laser.origVy;
                    }
                }

                // Bubble bounce off walls
                if (laser.bubbleShot) {
                    let bounced = false;
                    for (const obs of obstacles) {
                        if (!isBlockingObstacleForEntity(laser.shooter, obs)) continue;
                        if (laser.x < obs.x + obs.width && laser.x + 16 > obs.x &&
                            laser.y < obs.y + obs.height && laser.y + 16 > obs.y) {
                            // Hit obstacle - bounce
                            const normX = laser.x - (obs.x + obs.width / 2);
                            const normY = laser.y - (obs.y + obs.height / 2);
                            const nLen = Math.hypot(normX, normY) || 1;
                            const nx2 = normX / nLen, ny2 = normY / nLen;
                            laser.vx = nx2 * Math.hypot(laser.vx, laser.vy) * 0.8;
                            laser.vy = ny2 * Math.hypot(laser.vx, laser.vy) * 0.8;
                            laser.bounceCount = (laser.bounceCount || 0) + 1;
                            bounced = true;
                            break;
                        }
                    }
                    if (bounced) continue;
                }
                // Check collision with brown brick obstacles
                if (checkLaserObstacleCollision(laser)) {
                    if (canLaserBreakEnvironment(laser)) {
                        breakBushesInRadius(laser.x, laser.y, 30);
                        if (laser.aoeRadius) {
                            damageObstaclesInRadius(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5));
                            breakBushesInRadius(laser.x, laser.y, laser.aoeRadius);
                        }
                    }
                    if (laser.aoeRadius) {
                        dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                        superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                    }
                    lasers.splice(i, 1);
                    continue;
                }
                // Check collision with destructible crates
                if (checkLaserCrateCollision(laser)) {
                    lasers.splice(i, 1);
                    continue;
                }

                // Check collisions with all players (except the shooter and teammates)
                let hit = false;
                // For heavy: use radius-based hit detection
                const hitRadius = laser.radius || 0;
                for (let j = 0; j < players.length; j++) {
                    const targetPlayer = players[j];
                    // Don't hit the shooter
                    if (targetPlayer === laser.shooter) continue;
                    // Don't hit teammates in team modes
                    if (laser.shooter.team && targetPlayer.team === laser.shooter.team) continue;
                    // Don't hit dead players
                    if (targetPlayer.currentHp <= 0) continue;

                    const tcx = targetPlayer.x + targetPlayer.size / 2;
                    const tcy = targetPlayer.y + targetPlayer.size / 2;
                    const playerHit = hitRadius > 0
                        ? Math.hypot(laser.x - tcx, laser.y - tcy) < hitRadius + targetPlayer.size / 2
                        : (laser.x >= targetPlayer.x && laser.x <= targetPlayer.x + targetPlayer.size &&
                           laser.y >= targetPlayer.y && laser.y <= targetPlayer.y + targetPlayer.size);

                    if (playerHit) {
                        if (hasDamageShield(targetPlayer)) { hit = true; break; }
                        // Apply damage boost from shooter's buff
                        let dmg = laser.damage;
                        if (laser.shooter._damageTimer > 0) dmg = Math.round(dmg * 1.5);
                        // Apply shield absorption on target
                        if (targetPlayer._shieldHp > 0) {
                            const absorbed = Math.min(targetPlayer._shieldHp, dmg);
                            targetPlayer._shieldHp -= absorbed;
                            dmg -= absorbed;
                        }
                        const actualDamage = Math.min(dmg, Math.max(0, targetPlayer.currentHp));
                        targetPlayer.currentHp -= dmg;
                        if (actualDamage > 0) registerDamageFeedback(targetPlayer, actualDamage);
                        laser.shooter.damageDealt += actualDamage;
                        if (laser.shooter.isHuman && actualDamage > 0) progressDaily('damage', actualDamage);
                        // Dealing damage â€” light hit-confirm shake
                        if (laser.shooter.isHuman && actualDamage > 0) {
                            screenShakeTimer = Math.max(screenShakeTimer, 8);
                            screenShakeStrength = Math.min(10, Math.max(screenShakeStrength, 3 + Math.sqrt(actualDamage) * 0.06));
                        }
                        // Charge super bar (4 damage = 1 charge point, capped at 100)
                        if (laser.shooter.superCharge !== undefined)
                            laser.shooter.superCharge = Math.min(100, laser.shooter.superCharge + actualDamage * 4);
                        // AoE on hit (heavy / aoehit)
                        if (laser.aoeRadius) {
                            dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                            superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                        }
                        // Taking damage reveals from bush
                        targetPlayer.bushRevealTimer = 90;
                        // Drop ball on taking damage in Ball-Goal
                        if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && targetPlayer.hasBall && ball) dropBall(targetPlayer);
                        if (laser.poisonTicks) {
                            targetPlayer._poisonTicks = Math.max(targetPlayer._poisonTicks || 0, laser.poisonTicks);
                            targetPlayer._poisonTickTimer = 45;
                            targetPlayer._poisonBy = laser.shooter;
                        }
                        if (laser.bananaSlow) {
                            targetPlayer._slowTimer = Math.max(targetPlayer._slowTimer || 0, 70);
                        }
                        if (laser.freezeSlow) {
                            targetPlayer._slowTimer = Math.max(targetPlayer._slowTimer || 0, 100);
                        }
                        if (laser.darkPulse && targetPlayer.currentHp < targetPlayer.maxHp * 0.5) {
                            const bonus = Math.round(laser.damage * 0.6);
                            const bonusActual = Math.min(bonus, Math.max(0, targetPlayer.currentHp));
                            targetPlayer.currentHp -= bonusActual;
                            if (bonusActual > 0) registerDamageFeedback(targetPlayer, bonusActual, '#c084fc');
                            laser.shooter.damageDealt = (laser.shooter.damageDealt || 0) + bonusActual;
                        }
                        if (laser.coinSteal && laser.shooter.isHuman && actualDamage > 0) {
                            playerCoins += laser.coinSteal;
                        }
                        hit = true;

                        if (targetPlayer.currentHp <= 0) {
                            if (!tryMagnetsRespawn(targetPlayer)) {
                                targetPlayer.currentHp = 0;
                                if (targetPlayer.isHuman) { currentStreak = 0; streakTimer = 0; }
                                laser.shooter.kills++;
                                killFeed.push({ killerName: laser.shooter.name, victimName: targetPlayer.name, ts: Date.now(), isHumanKill: laser.shooter.isHuman });
                                // Award XP for kill
                                if (laser.shooter.isHuman) {
                                    awardMedals(1);
                                    registerKill();
                                    progressDaily('kills', 1);
                                }
                                // Check bounty 20-star win
                                checkBountyWin();
                                // In team modes: keep player for respawn; in FFA: remove
                                const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                                if (isTeamMode) {
                                    targetPlayer.respawnTimer = getRespawnFramesForMode();
                                    targetPlayer.dead = true;
                                    dropPlayerItems(targetPlayer);
                                } else {
                                    if (targetPlayer.isBot && getRespawnFramesForMode() > 0) {
                                        targetPlayer.respawnTimer = getRespawnFramesForMode();
                                        targetPlayer.dead = true;
                                        dropPlayerItems(targetPlayer);
                                    } else {
                                        dropPlayerItems(targetPlayer);
                                        matchStatsList.push({ name: targetPlayer.name, kills: targetPlayer.kills, damageDealt: targetPlayer.damageDealt, healingReceived: targetPlayer.healingReceived, team: targetPlayer.team, isHuman: targetPlayer.isHuman });
                                        players.splice(j, 1);
                                        if (targetPlayer.isBot) {
                                            const botIndex = bots.findIndex(b => b.id === targetPlayer.id);
                                            if (botIndex !== -1) bots.splice(botIndex, 1);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                }

                if (!hit) {
                    const companionTargets = getLivingMagnetsCompanions();
                    for (let j = 0; j < companionTargets.length; j++) {
                        const targetPlayer = companionTargets[j].companion;
                        const targetOwner = companionTargets[j].owner;
                        if (targetOwner === laser.shooter || targetPlayer === laser.shooter) continue;
                        if (laser.shooter.team && targetPlayer.team === laser.shooter.team) continue;
                        if ((targetPlayer.currentHp || 0) <= 0) continue;

                        const tcx = targetPlayer.x + targetPlayer.size / 2;
                        const tcy = targetPlayer.y + targetPlayer.size / 2;
                        const playerHit = hitRadius > 0
                            ? Math.hypot(laser.x - tcx, laser.y - tcy) < hitRadius + targetPlayer.size / 2
                            : (laser.x >= targetPlayer.x && laser.x <= targetPlayer.x + targetPlayer.size &&
                               laser.y >= targetPlayer.y && laser.y <= targetPlayer.y + targetPlayer.size);

                        if (playerHit) {
                            let dmg = laser.damage;
                            if (laser.shooter._damageTimer > 0) dmg = Math.round(dmg * 1.5);
                            const actualDamage = Math.min(dmg, Math.max(0, targetPlayer.currentHp));
                            targetPlayer.currentHp -= dmg;
                            targetPlayer.hp = targetPlayer.currentHp;
                            if (actualDamage > 0) registerDamageFeedback(targetPlayer, actualDamage);
                            laser.shooter.damageDealt += actualDamage;
                            if (laser.shooter.isHuman && actualDamage > 0) progressDaily('damage', actualDamage);
                            if (laser.shooter.superCharge !== undefined)
                                laser.shooter.superCharge = Math.min(100, laser.shooter.superCharge + actualDamage * 4);
                            if (laser.aoeRadius) {
                                dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                                superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                            }
                            hit = true;
                            if (targetPlayer.currentHp <= 0) {
                                targetPlayer.currentHp = 0;
                                targetPlayer.hp = 0;
                                tryHandleCompanionDeath(targetPlayer, laser.shooter);
                            }
                            break;
                        }
                    }
                }

                if ((hit && !laser.piercing) || laser.life <= 0) {
                    lasers.splice(i, 1);
                }
            }

            // Update AI lasers - can hit ANY player (including other bots, but not teammates)
            for (let i = aiLasers.length - 1; i >= 0; i--) {
                const laser = aiLasers[i];
                if (!laser || typeof laser.x !== 'number' || typeof laser.y !== 'number' || typeof laser.vx !== 'number' || typeof laser.vy !== 'number') {
                    aiLasers.splice(i, 1);
                    continue;
                }
                if (!laser.shooter) {
                    laser.shooter = { team: null, isHuman: false, superCharge: 0, damageDealt: 0, laserRange: Infinity, _damageTimer: 0 };
                }
                // Store previous position for swept collision detection
                laser._prevX = laser.x;
                laser._prevY = laser.y;
                laser.x += laser.vx;
                laser.y += laser.vy;
                laser.life--;

                // Initialize range metadata for any legacy/projectile-created lasers.
                if (laser.startX === undefined || laser.startY === undefined) {
                    laser.startX = laser.x;
                    laser.startY = laser.y;
                }
                if (laser.maxRange === undefined) {
                    laser.maxRange = laser.shooter?.laserRange || Infinity;
                }

                // Remove projectiles that exceed shown attack range.
                if (Math.hypot(laser.x - laser.startX, laser.y - laser.startY) > laser.maxRange) {
                    aiLasers.splice(i, 1);
                    continue;
                }

                // Homing: steer toward nearest player for a short duration only.
                if (laser.attackType === 'homing' && (laser.homingFrames === undefined || laser.homingFrames > 0)) {
                    if (laser.homingFrames === undefined) laser.homingFrames = 34;
                    laser.homingFrames--;
                    let nearest = null, nearestDist = Infinity;
                    for (const p of players) {
                        if (p === laser.shooter || (laser.shooter.team && p.team === laser.shooter.team) || p.currentHp <= 0) continue;
                        const d = Math.hypot(p.x + p.size / 2 - laser.x, p.y + p.size / 2 - laser.y);
                        if (d < nearestDist) { nearestDist = d; nearest = p; }
                    }
                    for (const { owner: compOwner, companion: comp } of getLivingMagnetsCompanions()) {
                        if (compOwner === laser.shooter || comp === laser.shooter) continue;
                        if (laser.shooter.team && comp.team === laser.shooter.team) continue;
                        const d = Math.hypot(comp.x + comp.size / 2 - laser.x, comp.y + comp.size / 2 - laser.y);
                        if (d < nearestDist) { nearestDist = d; nearest = comp; }
                    }
                    if (nearest) {
                        const tdx = nearest.x + nearest.size / 2 - laser.x;
                        const tdy = nearest.y + nearest.size / 2 - laser.y;
                        const td = Math.hypot(tdx, tdy) || 1;
                        const inLockDistance = nearestDist <= (laser.maxRange || Infinity) * 0.55;
                        if (inLockDistance) {
                            const spd = laser.homingSpeed || 8;
                            const turn = laser.homingTurn || 0.06;
                            const vLen = Math.hypot(laser.vx, laser.vy) || 1;
                            const dot = (laser.vx / vLen) * (tdx / td) + (laser.vy / vLen) * (tdy / td);
                            if (dot > 0.1) {
                                laser.vx += (tdx / td * spd - laser.vx) * turn;
                                laser.vy += (tdy / td * spd - laser.vy) * turn;
                            }
                        }
                    }
                }

                // Boomerang return
                if (laser.boomerang && laser.returnTimer > 0) {
                    laser.returnTimer--;
                    if (laser.returnTimer <= 0) {
                        laser.vx = -laser.origVx;
                        laser.vy = -laser.origVy;
                    }
                }

                // Bubble bounce off walls
                if (laser.bubbleShot) {
                    let bounced = false;
                    for (const obs of obstacles) {
                        if (!isBlockingObstacleForEntity(laser.shooter, obs)) continue;
                        if (laser.x < obs.x + obs.width && laser.x + 16 > obs.x &&
                            laser.y < obs.y + obs.height && laser.y + 16 > obs.y) {
                            // Hit obstacle - bounce
                            const normX = laser.x - (obs.x + obs.width / 2);
                            const normY = laser.y - (obs.y + obs.height / 2);
                            const nLen = Math.hypot(normX, normY) || 1;
                            const nx2 = normX / nLen, ny2 = normY / nLen;
                            laser.vx = nx2 * Math.hypot(laser.vx, laser.vy) * 0.8;
                            laser.vy = ny2 * Math.hypot(laser.vx, laser.vy) * 0.8;
                            laser.bounceCount = (laser.bounceCount || 0) + 1;
                            bounced = true;
                            break;
                        }
                    }
                    if (bounced) continue;
                }

                // Check collision with brown brick obstacles
                if (checkLaserObstacleCollision(laser)) {
                    if (canLaserBreakEnvironment(laser)) {
                        breakBushesInRadius(laser.x, laser.y, 30);
                        if (laser.aoeRadius) {
                            damageObstaclesInRadius(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5));
                            breakBushesInRadius(laser.x, laser.y, laser.aoeRadius);
                        }
                    }
                    if (laser.aoeRadius) {
                        dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                        superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                    }
                    aiLasers.splice(i, 1);
                    continue;
                }
                // Check collision with destructible crates
                if (checkLaserCrateCollision(laser)) {
                    aiLasers.splice(i, 1);
                    continue;
                }

                // Check collisions with all players (except the shooter and teammates)
                let hit = false;
                const aiHitRadius = laser.radius || 0;
                for (let j = 0; j < players.length; j++) {
                    const targetPlayer = players[j];
                    // Don't hit the shooter
                    if (targetPlayer === laser.shooter) continue;
                    // Don't hit teammates in team modes
                    if (laser.shooter.team && targetPlayer.team === laser.shooter.team) continue;
                    // Don't hit dead players
                    if (targetPlayer.currentHp <= 0) continue;

                    const tcx2 = targetPlayer.x + targetPlayer.size / 2;
                    const tcy2 = targetPlayer.y + targetPlayer.size / 2;
                    const aiPlayerHit = aiHitRadius > 0
                        ? Math.hypot(laser.x - tcx2, laser.y - tcy2) < aiHitRadius + targetPlayer.size / 2
                        : (laser.x >= targetPlayer.x && laser.x <= targetPlayer.x + targetPlayer.size &&
                           laser.y >= targetPlayer.y && laser.y <= targetPlayer.y + targetPlayer.size);

                    if (aiPlayerHit) {
                        if (hasDamageShield(targetPlayer)) { hit = true; break; }
                        // Apply damage boost from shooter's buff
                        let dmg = laser.damage;
                        if (laser.shooter._damageTimer > 0) dmg = Math.round(dmg * 1.5);
                        // Apply shield absorption on target
                        if (targetPlayer._shieldHp > 0) {
                            const absorbed = Math.min(targetPlayer._shieldHp, dmg);
                            targetPlayer._shieldHp -= absorbed;
                            dmg -= absorbed;
                        }
                        const actualDamage = Math.min(dmg, Math.max(0, targetPlayer.currentHp));
                        targetPlayer.currentHp -= dmg;
                        if (actualDamage > 0) registerDamageFeedback(targetPlayer, actualDamage);
                        laser.shooter.damageDealt += actualDamage;
                        if (laser.shooter.isHuman && actualDamage > 0) progressDaily('damage', actualDamage);
                        // Charge super bar
                        if (laser.shooter.superCharge !== undefined)
                            laser.shooter.superCharge = Math.min(100, laser.shooter.superCharge + actualDamage * 4);
                        // AoE on hit (aoehit)
                        if (laser.aoeRadius) {
                            dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                            superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                        }
                        // Taking damage reveals from bush
                        targetPlayer.bushRevealTimer = 90;
                        // Drop ball on taking damage in Ball-Goal
                        if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && targetPlayer.hasBall && ball) dropBall(targetPlayer);
                        if (laser.poisonTicks) {
                            targetPlayer._poisonTicks = Math.max(targetPlayer._poisonTicks || 0, laser.poisonTicks);
                            targetPlayer._poisonTickTimer = 45;
                            targetPlayer._poisonBy = laser.shooter;
                        }
                        if (laser.bananaSlow) {
                            targetPlayer._slowTimer = Math.max(targetPlayer._slowTimer || 0, 70);
                        }
                        if (laser.freezeSlow) {
                            targetPlayer._slowTimer = Math.max(targetPlayer._slowTimer || 0, 100);
                        }
                        if (laser.darkPulse && targetPlayer.currentHp < targetPlayer.maxHp * 0.5) {
                            const bonus = Math.round(laser.damage * 0.6);
                            const bonusActual = Math.min(bonus, Math.max(0, targetPlayer.currentHp));
                            targetPlayer.currentHp -= bonusActual;
                            if (bonusActual > 0) registerDamageFeedback(targetPlayer, bonusActual, '#c084fc');
                            laser.shooter.damageDealt = (laser.shooter.damageDealt || 0) + bonusActual;
                        }
                        if (laser.coinSteal && laser.shooter.isHuman && actualDamage > 0) {
                            playerCoins += laser.coinSteal;
                        }
                        hit = true;

                        // Reset regen on damage
                        if (targetPlayer.isHuman) {
                            targetPlayer.regenCooldown = 180;
                            targetPlayer.regenTimer = 0;
                        }

                        if (targetPlayer.currentHp <= 0) {
                            if (!tryMagnetsRespawn(targetPlayer)) {
                                targetPlayer.currentHp = 0;
                                if (targetPlayer.isHuman) { currentStreak = 0; streakTimer = 0; }
                                laser.shooter.kills++;
                                killFeed.push({ killerName: laser.shooter.name, victimName: targetPlayer.name, ts: Date.now(), isHumanKill: laser.shooter.isHuman });
                                // Check bounty 20-star win
                                checkBountyWin();
                                // In team modes: keep player for respawn; in FFA: remove
                                const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                                if (isTeamMode) {
                                    targetPlayer.respawnTimer = getRespawnFramesForMode();
                                    targetPlayer.dead = true;
                                    dropPlayerItems(targetPlayer);
                                } else {
                                    if (targetPlayer.isBot && getRespawnFramesForMode() > 0) {
                                        targetPlayer.respawnTimer = getRespawnFramesForMode();
                                        targetPlayer.dead = true;
                                        dropPlayerItems(targetPlayer);
                                    } else {
                                        dropPlayerItems(targetPlayer);
                                        matchStatsList.push({ name: targetPlayer.name, kills: targetPlayer.kills, damageDealt: targetPlayer.damageDealt, healingReceived: targetPlayer.healingReceived, team: targetPlayer.team, isHuman: targetPlayer.isHuman });
                                        players.splice(j, 1);
                                        if (targetPlayer.isBot) {
                                            const botIndex = bots.findIndex(b => b.id === targetPlayer.id);
                                            if (botIndex !== -1) bots.splice(botIndex, 1);
                                        }
                                        // End game if human dies in FFA
                                        if (targetPlayer.isHuman) {
                                            endGame('Game Over! You were defeated!', false);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                }

                if (!hit) {
                    const companionTargets = getLivingMagnetsCompanions();
                    for (let j = 0; j < companionTargets.length; j++) {
                        const targetPlayer = companionTargets[j].companion;
                        const targetOwner = companionTargets[j].owner;
                        if (targetOwner === laser.shooter || targetPlayer === laser.shooter) continue;
                        if (laser.shooter.team && targetPlayer.team === laser.shooter.team) continue;
                        if ((targetPlayer.currentHp || 0) <= 0) continue;

                        const tcx2 = targetPlayer.x + targetPlayer.size / 2;
                        const tcy2 = targetPlayer.y + targetPlayer.size / 2;
                        const aiPlayerHit = aiHitRadius > 0
                            ? Math.hypot(laser.x - tcx2, laser.y - tcy2) < aiHitRadius + targetPlayer.size / 2
                            : (laser.x >= targetPlayer.x && laser.x <= targetPlayer.x + targetPlayer.size &&
                               laser.y >= targetPlayer.y && laser.y <= targetPlayer.y + targetPlayer.size);

                        if (aiPlayerHit) {
                            let dmg = laser.damage;
                            if (laser.shooter._damageTimer > 0) dmg = Math.round(dmg * 1.5);
                            const actualDamage = Math.min(dmg, Math.max(0, targetPlayer.currentHp));
                            targetPlayer.currentHp -= dmg;
                            targetPlayer.hp = targetPlayer.currentHp;
                            if (actualDamage > 0) registerDamageFeedback(targetPlayer, actualDamage);
                            laser.shooter.damageDealt += actualDamage;
                            if (laser.shooter.isHuman && actualDamage > 0) progressDaily('damage', actualDamage);
                            if (laser.shooter.superCharge !== undefined)
                                laser.shooter.superCharge = Math.min(100, laser.shooter.superCharge + actualDamage * 4);
                            if (laser.aoeRadius) {
                                dealAoeDamage(laser.x, laser.y, laser.aoeRadius, Math.round(laser.damage * 0.5), laser.shooter);
                                superEffects.push({ type: 'screamflash', x: laser.x, y: laser.y, radius: Math.max(28, laser.aoeRadius * 0.5), timer: 14, shooter: laser.shooter });
                            }
                            hit = true;
                            if (targetPlayer.currentHp <= 0) {
                                targetPlayer.currentHp = 0;
                                targetPlayer.hp = 0;
                                tryHandleCompanionDeath(targetPlayer, laser.shooter);
                            }
                            break;
                        }
                    }
                }

                if (hit || laser.life <= 0) {
                    aiLasers.splice(i, 1);
                }
            }
        }
        /*********************************************************************/
        //start joystick implementation
        //******************************************************************* */
        // Joystick Variables
        let moveJoystickActive = false;
        let shootJoystickActive = false;
        let moveTouchId = null;
        let shootTouchId = null;
        let moveJoystick = { x: 0, y: 0, magnitude: 0 };
        let shootJoystick = { x: 0, y: 0, magnitude: 0 };
        let mouseShootAimActive = false;
        let mouseShootAimWorldX = 0;
        let mouseShootAimWorldY = 0;
        const SHOOT_JOYSTICK_FIRE_THRESHOLD = 0.22;

        // Initialize Joysticks
        function initJoysticks() {
            const moveBase = document.getElementById('joystick-base');
            const moveStick = document.getElementById('joystick-stick');
            const shootBase = document.getElementById('shoot-joystick-base');
            const shootStick = document.getElementById('shoot-joystick-stick');

            function endMoveTouch(e) {
                if (!moveJoystickActive) return;
                if (moveTouchId !== null) {
                    const released = Array.from(e.changedTouches || []).some(t => t.identifier === moveTouchId);
                    if (!released) return;
                }
                moveTouchId = null;
                moveJoystickActive = false;
                resetMoveJoystick();
            }

            function endShootTouch(e) {
                if (!shootJoystickActive) return;
                if (shootTouchId !== null) {
                    const released = Array.from(e.changedTouches || []).some(t => t.identifier === shootTouchId);
                    if (!released) return;
                }
                fireShootJoystickShot();
                shootTouchId = null;
                shootJoystickActive = false;
                resetShootJoystick();
            }

            // Movement Joystick
            moveBase.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (moveTouchId === null && e.changedTouches && e.changedTouches.length > 0) {
                    moveTouchId = e.changedTouches[0].identifier;
                }
                moveJoystickActive = true;
                updateMoveJoystick(e);
            });

            moveBase.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (moveJoystickActive) {
                    updateMoveJoystick(e);
                }
            });

            moveBase.addEventListener('touchend', (e) => {
                e.preventDefault();
                endMoveTouch(e);
            });

            moveBase.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                endMoveTouch(e);
            });

            document.addEventListener('touchend', endMoveTouch, { passive: true });
            document.addEventListener('touchcancel', endMoveTouch, { passive: true });

            // Shooting Joystick
            shootBase.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (shootTouchId === null && e.changedTouches && e.changedTouches.length > 0) {
                    shootTouchId = e.changedTouches[0].identifier;
                }
                shootJoystickActive = true;
                updateShootJoystick(e);
            });

            shootBase.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (shootJoystickActive) {
                    updateShootJoystick(e);
                }
            });

            shootBase.addEventListener('touchend', (e) => {
                e.preventDefault();
                endShootTouch(e);
            });

            shootBase.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                endShootTouch(e);
            });

            document.addEventListener('touchend', endShootTouch, { passive: true });
            document.addEventListener('touchcancel', endShootTouch, { passive: true });

            // Mouse events for desktop testing
            moveBase.addEventListener('mousedown', (e) => {
                moveJoystickActive = true;
                updateMoveJoystick(e);
            });

            document.addEventListener('mousemove', (e) => {
                if (moveJoystickActive) {
                    updateMoveJoystick(e);
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (moveJoystickActive) {
                    moveJoystickActive = false;
                    resetMoveJoystick();
                }
            });

            shootBase.addEventListener('mousedown', (e) => {
                shootJoystickActive = true;
                updateShootJoystick(e);
            });

            document.addEventListener('mousemove', (e) => {
                if (shootJoystickActive) {
                    updateShootJoystick(e);
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (shootJoystickActive) {
                    fireShootJoystickShot();
                    shootJoystickActive = false;
                    resetShootJoystick();
                }
            });
        }

        function fireShootJoystickShot() {
            if (isOnboardingActive()) {
                if (shootJoystick.magnitude < SHOOT_JOYSTICK_FIRE_THRESHOLD) return;
                attemptOnboardingAttack(shootJoystick.x, shootJoystick.y);
                return;
            }
            if (!gameStarted || !player || player.currentHp <= 0) return;
            if (player.shootCooldown > 0) return;
            if (shootJoystick.magnitude < SHOOT_JOYSTICK_FIRE_THRESHOLD) return;
            const targetX = player.x + player.size / 2 + shootJoystick.x * player.laserRange;
            const targetY = player.y + player.size / 2 + shootJoystick.y * player.laserRange;
            playerShoot(targetX, targetY);
        }

        function fireMouseAimShotIfReady() {
            if (!mouseShootAimActive) return;
            if (!gameStarted || !player || player.currentHp <= 0) return;
            if (player.shootCooldown > 0) return;
            playerShoot(mouseShootAimWorldX, mouseShootAimWorldY);
        }

        function updateMoveJoystick(event) {
            const base = document.getElementById('joystick-base');
            const stick = document.getElementById('joystick-stick');
            const rect = base.getBoundingClientRect();
            const baseCenterX = rect.left + rect.width / 2;
            const baseCenterY = rect.top + rect.height / 2;

            let clientX, clientY;

            if (event.type.includes('touch')) {
                let touch = null;
                if (moveTouchId !== null) {
                    touch = Array.from(event.touches || []).find(t => t.identifier === moveTouchId)
                        || Array.from(event.changedTouches || []).find(t => t.identifier === moveTouchId);
                }
                if (!touch) return;
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }

            const deltaX = clientX - baseCenterX;
            const deltaY = clientY - baseCenterY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = rect.width / 2;

            // Calculate normalized direction vector
            if (distance > maxDistance) {
                moveJoystick.x = deltaX / distance;
                moveJoystick.y = deltaY / distance;
                moveJoystick.magnitude = 1;

                // Position stick at edge
                stick.style.transform = `translate(${moveJoystick.x * maxDistance}px, ${moveJoystick.y * maxDistance}px)`;
            } else {
                moveJoystick.x = deltaX / maxDistance;
                moveJoystick.y = deltaY / maxDistance;
                moveJoystick.magnitude = distance / maxDistance;

                // Position stick at touch point
                stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            }

            if (isOnboardingActive()) {
                moveOnboardingPlayer(moveJoystick.x, moveJoystick.y);
            }

            if (isOnboardingActive() && onboardingStepIndex === 0 && moveJoystick.magnitude > 0.2 && !onboardingProgress.moved) {
                onboardingProgress.moved = true;
                renderOnboardingStep();
            }
        }

        function updateShootJoystick(event) {
            const base = document.getElementById('shoot-joystick-base');
            const stick = document.getElementById('shoot-joystick-stick');
            const rect = base.getBoundingClientRect();
            const baseCenterX = rect.left + rect.width / 2;
            const baseCenterY = rect.top + rect.height / 2;

            let clientX, clientY;

            if (event.type.includes('touch')) {
                let touch = null;
                if (shootTouchId !== null) {
                    touch = Array.from(event.touches || []).find(t => t.identifier === shootTouchId)
                        || Array.from(event.changedTouches || []).find(t => t.identifier === shootTouchId);
                }
                if (!touch) return;
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }

            const deltaX = clientX - baseCenterX;
            const deltaY = clientY - baseCenterY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = rect.width / 2;

            // Calculate normalized direction vector
            if (distance > maxDistance) {
                shootJoystick.x = deltaX / distance;
                shootJoystick.y = deltaY / distance;
                shootJoystick.magnitude = 1;

                // Position stick at edge
                stick.style.transform = `translate(${shootJoystick.x * maxDistance}px, ${shootJoystick.y * maxDistance}px)`;
            } else {
                shootJoystick.x = deltaX / maxDistance;
                shootJoystick.y = deltaY / maxDistance;
                shootJoystick.magnitude = distance / maxDistance;

                // Position stick at touch point
                stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            }

            if (isOnboardingActive()) {
                aimOnboardingPlayer(shootJoystick.x, shootJoystick.y);
            }

            if (isOnboardingActive() && onboardingStepIndex === 1 && shootJoystick.magnitude > 0.2 && !onboardingProgress.aimed) {
                onboardingProgress.aimed = true;
                renderOnboardingStep();
            }

            // Aiming only while dragging; fire happens on release.
        }

        function resetMoveJoystick() {
            moveJoystick = { x: 0, y: 0, magnitude: 0 };
            moveTouchId = null;
            document.getElementById('joystick-stick').style.transform = 'translate(0px, 0px)';
        }

        function resetShootJoystick() {
            shootJoystick = { x: 0, y: 0, magnitude: 0 };
            shootTouchId = null;
            document.getElementById('shoot-joystick-stick').style.transform = 'translate(0px, 0px)';
        }

        // Update the handleInputFrame function to use joystick input
        function handleInputFrame() {
            if (!player) return;
            if (player.currentHp <= 0) return; // Dead players can't move

            let inputX = 0, inputY = 0;

            // Keyboard input (existing)
            if (keysPressed['arrowup'] || keysPressed['w']) inputY -= 1;
            if (keysPressed['arrowdown'] || keysPressed['s']) inputY += 1;
            if (keysPressed['arrowleft'] || keysPressed['a']) inputX -= 1;
            if (keysPressed['arrowright'] || keysPressed['d']) inputX += 1;

            // Joystick input (new)
            if (moveJoystickActive && moveJoystick.magnitude > 0.1) {
                inputX += moveJoystick.x;
                inputY += moveJoystick.y;
            }

            // Normalize input if both keyboard and joystick are used
            if (inputX !== 0 && inputY !== 0) {
                const length = Math.sqrt(inputX * inputX + inputY * inputY);
                inputX /= length;
                inputY /= length;
            }

            // Apply slow debuff if active
            const speedMult = (player._slowTimer > 0) ? 0.4 : (player._speedTimer > 0) ? 1.6 : 1;
            if (player._speedTimer > 0) player._speedTimer--;
            if (player._damageTimer > 0) player._damageTimer--;

            function collidesAt(x, y) {
                const testRect = { x, y, size: player.size };
                for (let obs of obstacles) {
                    if (!isBlockingObstacleForEntity(player, obs)) continue;
                    if (checkCollisionWithRect(testRect, obs)) return true;
                }
                return false;
            }

            // If spawned/teleported slightly inside a wall, nudge out so movement can resume.
            if (collidesAt(player.x, player.y)) {
                const probe = Math.max(2, Math.round(player.size * 0.22));
                const attempts = [
                    [probe, 0], [-probe, 0], [0, probe], [0, -probe],
                    [probe, probe], [probe, -probe], [-probe, probe], [-probe, -probe],
                    [probe * 2, 0], [-probe * 2, 0], [0, probe * 2], [0, -probe * 2]
                ];
                for (const [dx, dy] of attempts) {
                    const nx = Math.max(0, Math.min(player.x + dx, MAP_WIDTH - player.size));
                    const ny = Math.max(0, Math.min(player.y + dy, MAP_HEIGHT - player.size));
                    if (!collidesAt(nx, ny)) {
                        player.x = nx;
                        player.y = ny;
                        break;
                    }
                }
            }

            if (inputX !== 0 || inputY !== 0) {
                const moveStep = player.speed * speedMult;

                // Move each axis separately so the player slides along walls
                // instead of being fully blocked.
                const nextX = Math.max(0, Math.min(player.x + inputX * moveStep, MAP_WIDTH - player.size));
                if (!collidesAt(nextX, player.y)) {
                    player.x = nextX;
                }

                const nextY = Math.max(0, Math.min(player.y + inputY * moveStep, MAP_HEIGHT - player.size));
                if (!collidesAt(player.x, nextY)) {
                    player.y = nextY;
                }
            }

            // Track velocity for bot lead-shot prediction
            player.vx = player.x - player.prevX;
            player.vy = player.y - player.prevY;
            player.prevX = player.x;
            player.prevY = player.y;

            checkHealthPackCollision(player);
        }

        function handleDeadPlayerInput() {
            if (!player || player.currentHp > 0) return;
            if (player.respawnTimer <= 0) return;
            // Dead players can look around with arrow keys / WASD to scout
            // (camera already follows living teammate, but dead player input can be used in future for spectating)
        }

        function handlePlayerAbilities() {
            if (!player) return;
            if (player.currentHp <= 0) return;

            // Continue player input for living players
            if (player.shootCooldown > 0) player.shootCooldown--;

            // Super ability: E key
            if (keysPressed['e'] && player.superCharge >= 100 && player.superCooldown <= 0) {
                keysPressed['e'] = false; // consume keypress
                // Target = last known mouse world position (or centre of screen)
                activateSuper(player, lastMouseWorldX, lastMouseWorldY);
            }

            // Gadget ability: Space key
            if (keysPressed[' '] && (player.gadgetCooldown || 0) <= 0) {
                keysPressed[' '] = false;
                activateGadget(player, lastMouseWorldX, lastMouseWorldY);
            }

            // Fire boost (kafekauboy gadget): reduce shoot cooldown increment by half
            if (player.shootCooldown > 0 && player._fireBoostTimer > 0) {
                player.shootCooldown = Math.max(0, player.shootCooldown - 1); // double decrement
            }

        }
        /************************************************** */
        //end joystick implementation
        /************************************************** */
        function checkGameEnd() {
            // Ball-Goal ends by score (handled in updateBall), not elimination
            if (currentGameMode === 'ballGoal') return;

            // King of the Town ends by its own objective logic
            if (currentGameMode === 'kingTown') return;

            // Bounty ends by timer (handled in gameLoop), not elimination
            if (currentGameMode === 'bounty') return;

            // Zone Capture ends by capture progress (handled in updateZoneCapture)
            if (currentGameMode === 'zoneCapture') return;

            // Fail-safe: in Showdown, if human is dead, end immediately.
            if ((currentGameMode === 'showdown' || currentGameMode === 'easyStage') && player && player.currentHp <= 0) {
                endGame('Game Over! You were defeated!', false);
                return;
            }

            const alivePlayers = players.filter(p => p.currentHp > 0);

            if (gameModes[currentGameMode].teams) {
                const teams = gameModes[currentGameMode].teamNames;
                const knockoutMode = isKnockoutTeamMode();

                // If your team is wiped, end immediately as defeat instead of locking the camera in a dark respawn view.
                if (player && player.currentHp <= 0) {
                    const livingTeammate = players.some(p => p !== player && p.team === player.team && p.currentHp > 0);
                    const pendingTeammateRespawn = !knockoutMode && players.some(p => p.team === player.team && p.currentHp <= 0 && p.respawnTimer > 0);
                    if (!livingTeammate && !pendingTeammateRespawn && (!player.respawnTimer || player.respawnTimer <= 0)) {
                        endGame('Game Over! Your team was eliminated.', false);
                        return;
                    }
                }

                // A team is eliminated only when everyone is dead AND no respawns are pending.
                const teamsAlive = teams.filter(t => {
                    const teamMembers = players.filter(p => p.team === t);
                    if (teamMembers.length === 0) return false;
                    const hasAliveMember = teamMembers.some(p => p.currentHp > 0);
                    if (hasAliveMember) return true;
                    if (knockoutMode) return false;
                    return teamMembers.some(p => p.respawnTimer > 0);
                });

                if (teamsAlive.length === 1) {
                    const winTeam = teamsAlive[0];
                    const label = winTeam.charAt(0).toUpperCase() + winTeam.slice(1);
                    endGame(`${label} Team Wins!`, winTeam === player.team);
                } else if (teamsAlive.length === 0) {
                    endGame('Draw!', false);
                }
            } else {
                const pendingRespawns = players.some(p => p.currentHp <= 0 && p.respawnTimer > 0);
                if (pendingRespawns) return;

                if (alivePlayers.length === 1) {
                    endGame(alivePlayers[0].isHuman ? 'You Win!' : 'Game Over!', alivePlayers[0].isHuman);
                } else if (alivePlayers.length === 0) {
                    endGame('Draw!', false);
                }
            }
        }

        // â”€â”€â”€ BOUNTY TIMER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        const BOUNTY_WIN_STARS = 20;

        function checkBountyWin() {
            if (currentGameMode !== 'bounty' || !gameStarted) return;
            const redStars  = players.filter(p => p.team === 'red').reduce((s, p) => s + p.kills, 0);
            const blueStars = players.filter(p => p.team === 'blue').reduce((s, p) => s + p.kills, 0);
            if (redStars >= BOUNTY_WIN_STARS) {
                endGame(`Red Team Wins! â­ ${redStars} â€“ ${blueStars}`, player.team === 'red');
            } else if (blueStars >= BOUNTY_WIN_STARS) {
                endGame(`Blue Team Wins! â­ ${blueStars} â€“ ${redStars}`, player.team === 'blue');
            }
        }

        function updateBountyTimer() {
            if (currentGameMode !== 'bounty' || !gameStarted) return;
            bountyTimerFrames--;
            if (bountyTimerFrames <= 0) {
                bountyTimerFrames = 0;
                // Count team kills
                const redStars  = players.filter(p => p.team === 'red').reduce((s, p) => s + p.kills, 0);
                const blueStars = players.filter(p => p.team === 'blue').reduce((s, p) => s + p.kills, 0);
                if (redStars > blueStars) {
                    endGame(`Red Team Wins! â­ ${redStars} â€“ ${blueStars}`, player.team === 'red');
                } else if (blueStars > redStars) {
                    endGame(`Blue Team Wins! â­ ${blueStars} â€“ ${redStars}`, player.team === 'blue');
                } else {
                    endGame(`Draw! â­ ${redStars} â€“ ${blueStars}`, false);
                }
            }
        }

        // â”€â”€â”€ SUPER ABILITY SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Helper: launch a radial burst of N lasers from a player
        function fireRadialBurst(p, count, damage, speed, life) {
            for (let i = 0; i < count; i++) {
                const angle = (2 * Math.PI / count) * i;
                lasers.push({
                    x: p.x + p.size / 2,
                    y: p.y + p.size / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life,
                    damage,
                    shooter: p,
                    isSuperLaser: true
                });
            }
        }

        // Helper: deal AoE damage from a centre point
        function dealAoeDamage(cx, cy, radius, damage, shooter) {
            for (const p of players) {
                if (p === shooter) continue;
                if (shooter.team && p.team === shooter.team) continue;
                if (p.currentHp <= 0) continue;
                if (hasDamageShield(p)) continue;
                const px = p.x + p.size / 2, py = p.y + p.size / 2;
                if ((px - cx) ** 2 + (py - cy) ** 2 <= radius * radius) {
                    const actual = Math.min(damage, Math.max(0, p.currentHp));
                    p.currentHp -= damage;
                    if (actual > 0) registerDamageFeedback(p, actual, '#ff9955');
                    shooter.damageDealt += actual;
                    if (shooter.isHuman && actual > 0) progressDaily('damage', actual);
                    p.bushRevealTimer = 90;
                    // Super damage also charges a little
                    if (shooter.superCharge !== undefined) shooter.superCharge = Math.min(100, shooter.superCharge + actual * 0.5);
                    if (p.currentHp <= 0) {
                        p.currentHp = 0;
                        if (p.isHuman) { currentStreak = 0; streakTimer = 0; }
                        shooter.kills++;
                        killFeed.push({ killerName: shooter.name, victimName: p.name, ts: Date.now(), isHumanKill: shooter.isHuman });
                        if (shooter.isHuman) {
                            awardMedals(1);
                            registerKill();
                            progressDaily('kills', 1);
                        }
                        const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                        if (isTeamMode) {
                            if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && p.hasBall && ball) {
                                dropBall(p);
                            }
                            p.respawnTimer = getRespawnFramesForMode();
                            p.dead = true;
                        } else {
                            if (p.isBot && getRespawnFramesForMode() > 0) {
                                p.respawnTimer = getRespawnFramesForMode();
                                p.dead = true;
                            } else {
                                matchStatsList.push({ name: p.name, kills: p.kills, damageDealt: p.damageDealt, healingReceived: p.healingReceived, team: p.team, isHuman: p.isHuman });
                                const idx = players.indexOf(p);
                                if (idx !== -1) players.splice(idx, 1);
                                if (p.isBot) { const bi = bots.findIndex(b => b.id === p.id); if (bi !== -1) bots.splice(bi, 1); }
                                if (p.isHuman) endGame('Game Over! You were defeated!', false);
                            }
                        }
                    }
                }
            }

            for (const { owner, companion: p } of getLivingMagnetsCompanions()) {
                if (owner === shooter || p === shooter) continue;
                if (shooter.team && p.team === shooter.team) continue;
                if ((p.currentHp || 0) <= 0) continue;
                const px = p.x + p.size / 2, py = p.y + p.size / 2;
                if ((px - cx) ** 2 + (py - cy) ** 2 <= radius * radius) {
                    const actual = Math.min(damage, Math.max(0, p.currentHp));
                    p.currentHp -= damage;
                    p.hp = p.currentHp;
                    if (actual > 0) registerDamageFeedback(p, actual, '#ff9955');
                    shooter.damageDealt += actual;
                    if (shooter.isHuman && actual > 0) progressDaily('damage', actual);
                    if (shooter.superCharge !== undefined) shooter.superCharge = Math.min(100, shooter.superCharge + actual * 0.5);
                    if (p.currentHp <= 0) {
                        p.currentHp = 0;
                        p.hp = 0;
                        tryHandleCompanionDeath(p, shooter);
                    }
                }
            }
        }

