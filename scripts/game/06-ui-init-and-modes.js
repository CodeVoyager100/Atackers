        function updateHuntearTraps() {
            // Lay traps while traplayer super is active
            for (const p of players) {
                if (!p.superActive || p.superBuffType !== 'traplayer') continue;
                if ((p._trapLayCooldown || 0) > 0) { p._trapLayCooldown--; continue; }
                p._trapLayCooldown = 22; // lay one trap every ~22 frames while moving
                huntearTraps.push({ x: p.x + p.size / 2 - 14, y: p.y + p.size / 2 - 14, owner: p, life: 1200, triggered: false });
            }
            // Check collisions and tick lifetime
            for (let i = huntearTraps.length - 1; i >= 0; i--) {
                const trap = huntearTraps[i];
                trap.life--;
                if (trap.life <= 0) { huntearTraps.splice(i, 1); continue; }
                if (trap.triggered) continue;
                for (const p of players) {
                    if (p === trap.owner || (trap.owner.team && p.team === trap.owner.team) || p.currentHp <= 0) continue;
                    const tcx = p.x + p.size / 2;
                    const tcy = p.y + p.size / 2;
                    if (Math.abs(tcx - (trap.x + 14)) < p.size / 2 + 14 && Math.abs(tcy - (trap.y + 14)) < p.size / 2 + 14) {
                        trap.triggered = true;
                        const dmg = 500 * COMBAT_STAT_SCALE;
                        const actual = Math.min(dmg, Math.max(0, p.currentHp));
                        p.currentHp -= dmg;
                        if (actual > 0) registerDamageFeedback(p, actual, '#f59e0b');
                        trap.owner.damageDealt = (trap.owner.damageDealt || 0) + actual;
                        p._slowTimer = Math.max(p._slowTimer || 0, 300); // 5 s can't move
                        p._stunTimer = Math.max(p._stunTimer || 0, 300);
                        p.bushRevealTimer = 90;
                        if (p.currentHp <= 0) {
                            if (!tryMagnetsRespawn(p)) {
                                p.currentHp = 0;
                                trap.owner.kills = (trap.owner.kills || 0) + 1;
                                killFeed.push({ killerName: trap.owner.name, victimName: p.name, ts: Date.now(), isHumanKill: trap.owner.isHuman });
                                if (trap.owner.isHuman) { awardMedals(1); registerKill(); progressDaily('kills', 1); }
                                const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                                if (isTeamMode) {
                                    p.respawnTimer = getRespawnFramesForMode(); p.dead = true; dropPlayerItems(p);
                                } else {
                                    if (p.isBot && getRespawnFramesForMode() > 0) { p.respawnTimer = getRespawnFramesForMode(); p.dead = true; dropPlayerItems(p); }
                                    else { dropPlayerItems(p); matchStatsList.push({ name: p.name, kills: p.kills, damageDealt: p.damageDealt, healingReceived: p.healingReceived, team: p.team, isHuman: p.isHuman }); const idx = players.indexOf(p); if (idx !== -1) players.splice(idx, 1); if (p.isBot) { const bi = bots.findIndex(b => b.id === p.id); if (bi !== -1) bots.splice(bi, 1); } if (p.isHuman) endGame('Game Over! You were defeated!', false); }
                                }
                            }
                        }
                        huntearTraps.splice(i, 1);
                        break;
                    }
                }
            }
        }

        function drawHuntearTraps() {
            if (huntearTraps.length === 0) return;
            ctx.save();
            for (const trap of huntearTraps) {
                if (trap.triggered) continue;
                const tx = trap.x - camera.x;
                const ty = trap.y - camera.y;
                const pulse = 0.7 + Math.sin(Date.now() / 220) * 0.3;
                ctx.globalAlpha = pulse;
                // Outer warning glow
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#78350f';
                ctx.fillRect(tx, ty, 28, 28);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.strokeRect(tx, ty, 28, 28);
                ctx.shadowBlur = 0;
                // X mark
                ctx.strokeStyle = '#fde68a';
                ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(tx + 5, ty + 5); ctx.lineTo(tx + 23, ty + 23); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(tx + 23, ty + 5); ctx.lineTo(tx + 5, ty + 23); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function updateSnakeMinions() {
            for (let i = snakeMinions.length - 1; i >= 0; i--) {
                const s = snakeMinions[i];
                if (!s.owner || s.owner.currentHp <= 0 || s.hp <= 0 || s.life <= 0) {
                    snakeMinions.splice(i, 1);
                    continue;
                }

                s.life--;
                if (s.attackCooldown > 0) s.attackCooldown--;
                if (s.stuckFrames === undefined) s.stuckFrames = 0;
                if (s.orbitAngle === undefined) s.orbitAngle = Math.random() * Math.PI * 2;

                const ownerCx = s.owner.x + s.owner.size / 2;
                const ownerCy = s.owner.y + s.owner.size / 2;
                const ownerDist = Math.hypot(ownerCx - s.x, ownerCy - s.y);

                // Keep snakes near owner so they don't get lost on walls.
                if (ownerDist > 520) {
                    const odx = ownerCx - s.x;
                    const ody = ownerCy - s.y;
                    const od = Math.hypot(odx, ody) || 1;
                    s.x += (odx / od) * s.speed * 1.45;
                    s.y += (ody / od) * s.speed * 1.45;
                }

                let target = null;
                let bestDist = 460;

                // First, search near the snake itself.
                for (const p of players) {
                    if (p === s.owner || p.currentHp <= 0) continue;
                    if (s.owner.team && p.team === s.owner.team) continue;
                    const d = Math.hypot((p.x + p.size / 2) - s.x, (p.y + p.size / 2) - s.y);
                    if (d < bestDist) {
                        bestDist = d;
                        target = p;
                    }
                }

                // If none nearby, search around the owner so snakes can join fights faster.
                if (!target) {
                    let ownerBest = 720;
                    for (const p of players) {
                        if (p === s.owner || p.currentHp <= 0) continue;
                        if (s.owner.team && p.team === s.owner.team) continue;
                        const d = Math.hypot((p.x + p.size / 2) - ownerCx, (p.y + p.size / 2) - ownerCy);
                        if (d < ownerBest) {
                            ownerBest = d;
                            target = p;
                        }
                    }
                }

                if (target) {
                    const tx = target.x + target.size / 2;
                    const ty = target.y + target.size / 2;
                    const dx = tx - s.x;
                    const dy = ty - s.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const reach = target.size / 2 + s.size / 2 + 10;

                    if (d > reach) {
                        // Mild lead target for moving enemies.
                        const lead = Math.min(18, d * 0.12);
                        const tvx = target.vx || 0;
                        const tvy = target.vy || 0;
                        const predX = tx + tvx * lead;
                        const predY = ty + tvy * lead;
                        const pdx = predX - s.x;
                        const pdy = predY - s.y;
                        const pd = Math.hypot(pdx, pdy) || 1;

                        const nx = Math.max(0, Math.min(MAP_WIDTH, s.x + (pdx / pd) * s.speed));
                        const ny = Math.max(0, Math.min(MAP_HEIGHT, s.y + (pdy / pd) * s.speed));
                        let blocked = false;
                        for (const obs of obstacles) {
                            if (obs.type === 'brick' && nx >= obs.x && nx <= obs.x + obs.width && ny >= obs.y && ny <= obs.y + obs.height) {
                                blocked = true;
                                break;
                            }
                        }
                        if (!blocked) {
                            s.x = nx;
                            s.y = ny;
                            s.stuckFrames = 0;
                        } else {
                            // Try axis-slide if full move is blocked.
                            const nxOnly = Math.max(0, Math.min(MAP_WIDTH, s.x + (pdx / pd) * s.speed));
                            const nyOnly = Math.max(0, Math.min(MAP_HEIGHT, s.y + (pdy / pd) * s.speed));
                            let moved = false;
                            const blockX = obstacles.some(obs => obs.type === 'brick' && nxOnly >= obs.x && nxOnly <= obs.x + obs.width && s.y >= obs.y && s.y <= obs.y + obs.height);
                            if (!blockX) {
                                s.x = nxOnly;
                                moved = true;
                            }
                            const blockY = obstacles.some(obs => obs.type === 'brick' && s.x >= obs.x && s.x <= obs.x + obs.width && nyOnly >= obs.y && nyOnly <= obs.y + obs.height);
                            if (!blockY) {
                                s.y = nyOnly;
                                moved = true;
                            }
                            s.stuckFrames = moved ? 0 : s.stuckFrames + 1;
                            if (!moved) {
                                s.x = Math.max(0, Math.min(MAP_WIDTH, s.x + (Math.random() - 0.5) * s.speed));
                                s.y = Math.max(0, Math.min(MAP_HEIGHT, s.y + (Math.random() - 0.5) * s.speed));
                            }
                            if (s.stuckFrames > 40) {
                                s.x = ownerCx + (Math.random() - 0.5) * 40;
                                s.y = ownerCy + (Math.random() - 0.5) * 40;
                                s.stuckFrames = 0;
                            }
                        }
                    }

                    if (d <= reach && s.attackCooldown <= 0) {
                        if (hasDamageShield(target)) {
                            s.attackCooldown = 16;
                            continue;
                        }
                        const damage = s.damage;
                        const actual = Math.min(damage, Math.max(0, target.currentHp));
                        target.currentHp -= damage;
                        if (actual > 0) registerDamageFeedback(target, actual, '#8ce7ff');
                        s.owner.damageDealt += actual;
                        target.bushRevealTimer = 60;
                        s.attackCooldown = 24;

                        if (target.currentHp <= 0) {
                            if (!tryMagnetsRespawn(target)) {
                                target.currentHp = 0;
                                if (target.isHuman) { currentStreak = 0; streakTimer = 0; }
                                s.owner.kills++;
                                killFeed.push({ killerName: s.owner.name, victimName: target.name, ts: Date.now(), isHumanKill: s.owner.isHuman });
                                if (s.owner.isHuman) {
                                    awardMedals(1);
                                    registerKill();
                                    progressDaily('kills', 1);
                                }
                                checkBountyWin();

                                const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                                if (isTeamMode) {
                                    if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && target.hasBall && ball) dropBall(target);
                                    target.respawnTimer = getRespawnFramesForMode();
                                    target.dead = true;
                                    dropPlayerItems(target);
                                } else {
                                    if (target.isBot && getRespawnFramesForMode() > 0) {
                                        target.respawnTimer = getRespawnFramesForMode();
                                        target.dead = true;
                                        dropPlayerItems(target);
                                    } else {
                                        dropPlayerItems(target);
                                        matchStatsList.push({ name: target.name, kills: target.kills, damageDealt: target.damageDealt, healingReceived: target.healingReceived, team: target.team, isHuman: target.isHuman });
                                        const idx = players.indexOf(target);
                                        if (idx !== -1) players.splice(idx, 1);
                                        if (target.isBot) {
                                            const botIdx = bots.findIndex(b => b.id === target.id);
                                            if (botIdx !== -1) bots.splice(botIdx, 1);
                                        }
                                        if (target.isHuman) endGame('Game Over! You were defeated!', false);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Idle around owner in a small orbit instead of random drifting.
                    s.orbitAngle += 0.08;
                    const ox = ownerCx + Math.cos(s.orbitAngle + i) * 46;
                    const oy = ownerCy + Math.sin(s.orbitAngle + i) * 46;
                    const odx = ox - s.x;
                    const ody = oy - s.y;
                    const od = Math.hypot(odx, ody) || 1;
                    s.x = Math.max(0, Math.min(MAP_WIDTH, s.x + (odx / od) * Math.min(s.speed * 0.8, od)));
                    s.y = Math.max(0, Math.min(MAP_HEIGHT, s.y + (ody / od) * Math.min(s.speed * 0.8, od)));
                }
            }
        }

        function drawSnakeMinions() {
            for (const s of snakeMinions) {
                const x = s.x - camera.x;
                const y = s.y - camera.y;
                ctx.save();
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(x, y, s.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#14532d';
                ctx.beginPath();
                ctx.arc(x + 4, y - 2, 3, 0, Math.PI * 2);
                ctx.arc(x - 4, y - 2, 3, 0, Math.PI * 2);
                ctx.fill();
                // HP bar
                const barW = s.size * 1.2;
                const barH = 4;
                const barX = x - barW / 2;
                const barY = y - s.size / 2 - 8;
                const hpRatio = Math.max(0, s.hp / s.maxHp);
                ctx.fillStyle = '#333';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
                ctx.fillRect(barX, barY, barW * hpRatio, barH);
                ctx.restore();
            }
        }

        // â”€â”€ Draw gadget trail / cloak effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function updateDrawGadgetEffects() {
            for (let i = gadgetEffects.length - 1; i >= 0; i--) {
                const fx = gadgetEffects[i];
                fx.timer--;
                const alpha = Math.max(0, fx.timer / 20);
                ctx.save();
                ctx.globalAlpha = alpha;
                if (fx.type === 'dashtrail') {
                    ctx.strokeStyle = fx.color;
                    ctx.lineWidth = 8; ctx.lineCap = 'round';
                    ctx.setLineDash([8, 6]);
                    ctx.beginPath();
                    ctx.moveTo(fx.x - camera.x, fx.y - camera.y);
                    ctx.lineTo(fx.ex - camera.x, fx.ey - camera.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else if (fx.type === 'cloak') {
                    ctx.fillStyle = fx.color;
                    ctx.beginPath();
                    ctx.arc(fx.x - camera.x, fx.y - camera.y, 50, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                if (fx.timer <= 0) gadgetEffects.splice(i, 1);
            }
        }

        function updateSupers() {
            for (const p of players) {
                if (p.spawnShieldTimer > 0) p.spawnShieldTimer--;
                if (p.superCooldown > 0) p.superCooldown--;
                if (p.gadgetCooldown > 0) p.gadgetCooldown--;
                if (p.gadgetInvisibleTimer > 0) p.gadgetInvisibleTimer--;
                if (p.shadowPhaseTimer > 0) p.shadowPhaseTimer--;
                if (p._stunTimer > 0) p._stunTimer--;
                if (p._fireBoostTimer > 0) p._fireBoostTimer--;
                if (p._slowTimer > 0) {
                    p._slowTimer--;
                    // Applied in movement (speed halved when slow active â€” see handleInputFrame)
                }
                if (p._poisonTicks > 0 && p.currentHp > 0) {
                    p._poisonTickTimer = (p._poisonTickTimer || 45) - 1;
                    if (p._poisonTickTimer <= 0) {
                        if (!hasDamageShield(p)) {
                            p.currentHp = Math.max(0, p.currentHp - POISON_TICK_DAMAGE);
                            registerDamageFeedback(p, POISON_TICK_DAMAGE, '#7fe06b');
                        }
                        p.bushRevealTimer = 60;
                        if (p.currentHp <= 0 && p._poisonBy) {
                            const owner = p._poisonBy;
                            owner.kills = (owner.kills || 0) + 1;
                            killFeed.push({ killerName: owner.name, victimName: p.name, ts: Date.now(), isHumanKill: owner.isHuman });
                            if (owner.isHuman) {
                                awardMedals(1);
                                registerKill();
                                progressDaily('kills', 1);
                            }
                            const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                            if (isTeamMode) {
                                if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && p.hasBall && ball) dropBall(p);
                                p.respawnTimer = getRespawnFramesForMode();
                                p.dead = true;
                                dropPlayerItems(p);
                            } else {
                                if (p.isBot && getRespawnFramesForMode() > 0) {
                                    p.respawnTimer = getRespawnFramesForMode();
                                    p.dead = true;
                                    dropPlayerItems(p);
                                } else {
                                    dropPlayerItems(p);
                                    matchStatsList.push({ name: p.name, kills: p.kills, damageDealt: p.damageDealt, healingReceived: p.healingReceived, team: p.team, isHuman: p.isHuman });
                                    const idx = players.indexOf(p);
                                    if (idx !== -1) players.splice(idx, 1);
                                    if (p.isBot) {
                                        const botIndex = bots.findIndex(b => b.id === p.id);
                                        if (botIndex !== -1) bots.splice(botIndex, 1);
                                    }
                                    if (p.isHuman) endGame('Game Over! You were defeated!', false);
                                }
                            }
                            checkBountyWin();
                        }
                        p._poisonTicks--;
                        p._poisonTickTimer = 45;
                    }
                }
                if (!p.superActive || p.superTimer <= 0) {
                    if (p.superActive) {
                        // Buff expired â€” restore stats
                        p.superActive = false;
                        p.superInvincible = false;
                        if (p.superBuffType === 'berserk') {
                            p.laserDamage = p._baseLaserDamage ?? p.laserDamage;
                        } else if (p.superBuffType === 'coffeerush') {
                            p.speed = p._baseSpeed ?? p.speed;
                            p.laserDamage = p._baseLaserDamage ?? p.laserDamage;
                        } else if (p.superBuffType === 'megazord' || p.superBuffType === 'rockshield') {
                            p.superInvincible = false;
                        }
                        p.superBuffType = null;
                    }
                    continue;
                }
                p.superTimer--;
            }

            // Update super effects (AoE zones, projectiles, etc.)
            for (let i = superEffects.length - 1; i >= 0; i--) {
                const fx = superEffects[i];

                if (fx.type === 'firezone' || fx.type === 'tornado' || fx.type === 'smokezone') {
                    fx.timer--;
                    fx.tickTimer++;
                    if (fx.type === 'tornado') {
                        fx.angle += 0.08;
                        // Gentle pull toward tornado centre
                        for (const p of players) {
                            if (p === fx.shooter || (fx.shooter.team && p.team === fx.shooter.team) || p.currentHp <= 0) continue;
                            const dx = fx.x - (p.x + p.size / 2);
                            const dy = fx.y - (p.y + p.size / 2);
                            const dist = Math.hypot(dx, dy);
                            if (dist < fx.radius && dist > 5) {
                                p.x += (dx / dist) * 2;
                                p.y += (dy / dist) * 2;
                            }
                        }
                    }
                    if (fx.type === 'smokezone') {
                        // Slow enemies in zone
                        for (const p of players) {
                            if (p === fx.shooter || (fx.shooter.team && p.team === fx.shooter.team) || p.currentHp <= 0) continue;
                            if (Math.hypot(p.x + p.size / 2 - fx.x, p.y + p.size / 2 - fx.y) < fx.radius) {
                                p._slowTimer = Math.max(p._slowTimer || 0, 60);
                            }
                        }
                    }
                    if (fx.tickTimer >= fx.tickInterval) {
                        fx.tickTimer = 0;
                        dealAoeDamage(fx.x, fx.y, fx.radius, fx.damage, fx.shooter);
                        if (canSuperEffectBreakEnvironment(fx)) {
                            // Damage obstacles and bushes only for approved supers.
                            const obstacleDamage = 35;
                            damageObstaclesInRadius(fx.x, fx.y, fx.radius, obstacleDamage);
                            breakBushesInRadius(fx.x, fx.y, fx.radius);
                        }
                    }
                    if (fx.timer <= 0) superEffects.splice(i, 1);

                } else if (fx.type === 'bigshot') {
                    fx.x += fx.vx;
                    fx.y += fx.vy;
                    fx.life--;
                    let hit = false;
                    for (const obs of obstacles) {
                        if (fx.x > obs.x && fx.x < obs.x + obs.width && fx.y > obs.y && fx.y < obs.y + obs.height) { hit = true; break; }
                    }
                    for (const p of players) {
                        if (p === fx.shooter || (fx.shooter.team && p.team === fx.shooter.team) || p.currentHp <= 0) continue;
                        if (Math.hypot(p.x + p.size / 2 - fx.x, p.y + p.size / 2 - fx.y) < fx.radius + p.size / 2) { hit = true; break; }
                    }
                    if (hit || fx.life <= 0) {
                        dealAoeDamage(fx.x, fx.y, fx.radius * 3, fx.damage, fx.shooter);
                        if (canSuperEffectBreakEnvironment(fx)) {
                            damageObstaclesInRadius(fx.x, fx.y, fx.radius * 3, 35);
                            breakBushesInRadius(fx.x, fx.y, fx.radius * 3);
                        }
                        superEffects.push({ type: 'screamflash', x: fx.x, y: fx.y, radius: fx.radius * 3, timer: 25, shooter: fx.shooter });
                        superEffects.splice(i, 1);
                    }

                } else if (fx.type === 'screamflash') {
                    fx.timer--;
                    // Damage obstacles on screamflash creation (instant AoE)
                    if (fx.timer === 24 && canSuperEffectBreakEnvironment(fx)) {
                        damageObstaclesInRadius(fx.x, fx.y, fx.radius, 35);
                        // Break bushes from screamflash
                        breakBushesInRadius(fx.x, fx.y, fx.radius);
                    }
                    if (fx.timer <= 0) superEffects.splice(i, 1);
                }
            }

            // Bots: activate super on a time cadence so behavior is FPS-independent.
            const nowMs = performance.now();
            for (const bot of bots) {
                if (bot.currentHp <= 0 || bot.superCharge < 100 || bot.superCooldown > 0) continue;
                if (!bot._nextSuperAttemptTs || bot._nextSuperAttemptTs < nowMs - 10000) {
                    bot._nextSuperAttemptTs = nowMs + balanceSandboxSettings.botSuperMinMs;
                }
                if (nowMs < bot._nextSuperAttemptTs) continue;
                const target = findClosestTarget(bot);
                if (!target && bot.superType !== 'berserk' && bot.superType !== 'coffeerush' && bot.superType !== 'rockshield' && bot.superType !== 'pickpocket' && bot.superType !== 'bananastorm' && bot.superType !== 'icestorm' && bot.superType !== 'darkrift') {
                    bot._nextSuperAttemptTs = nowMs + 280;
                    continue;
                }
                const tx = target ? target.x + target.size / 2 : bot.x;
                const ty = target ? target.y + target.size / 2 : bot.y;
                activateSuper(bot, tx, ty);
                const minGap = Math.max(200, balanceSandboxSettings.botSuperMinMs);
                const maxGap = Math.max(minGap + 100, balanceSandboxSettings.botSuperMaxMs);
                bot._nextSuperAttemptTs = nowMs + minGap + Math.random() * (maxGap - minGap);
            }
        }

        // â”€â”€â”€ END SUPER ABILITY SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // ADD THIS MISSING FUNCTION - Game end handler
        function endGame(message, isVictory) {
            if (!gameStarted) return; // Guard against double calls

            gameStarted = false;
            if (gameLoopRequestId !== null) {
                cancelAnimationFrame(gameLoopRequestId);
                gameLoopRequestId = null;
            }

            // Show game over overlay
            const overlay = document.getElementById('game-over-overlay');
            const title = document.getElementById('game-over-title');
            const messageEl = document.getElementById('game-over-message');

            // Scale rewards by game mode (3v3 is harder = more reward)
            const is3v3 = currentGameMode === '3v3' || currentGameMode === 'ballGoal' || currentGameMode === 'bounty' || currentGameMode === 'elimination' || currentGameMode === 'kingTown';
            const winCoins  = is3v3 ? 80 : 55;
            const loseCoins = is3v3 ? 25 : 12;
            const winMedals  = is3v3 ? 8 : 5;
            const loseMedals = is3v3 ? -3 : -1;
            const winSparks  = is3v3 ? 18 : 12;
            const loseSparks = is3v3 ? 7 : 4;

            const winCredits = is3v3 ? HERO_MARKS_MATCH_REWARDS.win.team : HERO_MARKS_MATCH_REWARDS.win.standard;
            const loseCredits = is3v3 ? HERO_MARKS_MATCH_REWARDS.lose.team : HERO_MARKS_MATCH_REWARDS.lose.standard;
            const humanSnapshot = (function buildHumanSnapshot() {
                const fromList = matchStatsList.find(s => s.isHuman) || {};
                const live = player && player.isHuman ? player : null;
                const hpPct = live ? Math.round((Math.max(0, live.currentHp || 0) / Math.max(1, live.maxHp || 1)) * 100) : 0;
                return {
                    kills: Math.max(0, Math.floor((live && live.kills) || fromList.kills || 0)),
                    damageDealt: Math.max(0, Math.floor((live && live.damageDealt) || fromList.damageDealt || 0)),
                    healingReceived: Math.max(0, Math.floor((live && live.healingReceived) || fromList.healingReceived || 0)),
                    survivedSeconds: Math.max(0, Math.floor((Date.now() - (matchStartedAt || Date.now())) / 1000)),
                    peakStreak: Math.max(0, currentStreak || 0),
                    remainingHpPct: hpPct
                };
            })();

            if (isVictory) {
                title.textContent = 'Victory!';
                title.style.color = '#ffcc00';
                messageEl.textContent = message;

                const humanMatchKills = humanSnapshot.kills;
                const survivedSeconds = humanSnapshot.survivedSeconds;

                playerCoins += winCoins;
                playerCredits += winCredits;
                energySparks += winSparks;
                awardMedals(winMedals);
                saveProgress();
                showCoins();
                messageEl.innerHTML += `<br><br>ðŸŽ‰ You earned ${winCoins} coins, +${winMedals} ðŸ… medals, +${winCredits} ðŸŽ–ï¸ Hero Marks and +${winSparks} âš¡ sparks!`;

                const dailyReward = awardDailyWinReward();
                if (dailyReward) {
                    messageEl.innerHTML += `<br>${dailyReward.icon} Daily win reward: ${dailyReward.text} (${dailyWinsState.wins}/${DAILY_WINS_MAX})`;
                } else {
                    messageEl.innerHTML += `<br>âœ… Daily win rewards completed (${DAILY_WINS_MAX}/${DAILY_WINS_MAX})`;
                }

                // Progress daily challenges
                const humanPlayer = matchStatsList.find(s => s.isHuman) || { kills: 0, damageDealt: 0 };
                progressDaily('wins', 1);
                progressDaily('games', 1);
                progressDaily('coins', winCoins);
                progressDaily('winstreak', 1);
                evaluateDailyMatchChallenges(humanMatchKills, survivedSeconds);
                
                // Update win streak
                currentWinStreak++;
                
                // Save to match history
                saveMatchToHistory(true, currentGameMode, humanPlayer.kills || 0, winMedals, selectedNexusId, winCoins, humanSnapshot);
            } else {
                title.textContent = 'Game Over';
                title.style.color = '#ff4444';
                messageEl.textContent = message;

                const humanMatchKills = humanSnapshot.kills;
                const survivedSeconds = humanSnapshot.survivedSeconds;

                playerCoins += loseCoins;
                playerCredits += loseCredits;
                energySparks += loseSparks;
                awardMedals(loseMedals);
                saveProgress();
                showCoins();
                messageEl.innerHTML += `<br><br>ðŸ’« You earned ${loseCoins} coins, ${loseMedals} ðŸ… medals, +${loseCredits} ðŸŽ–ï¸ Hero Marks and +${loseSparks} âš¡ sparks.`;

                // Progress daily challenges
                const humanPlayer2 = matchStatsList.find(s => s.isHuman) || { kills: 0, damageDealt: 0 };
                progressDaily('games', 1);
                progressDaily('coins', loseCoins);
                evaluateDailyMatchChallenges(humanMatchKills, survivedSeconds);
                
                // Reset win streak on loss
                currentWinStreak = 0;
                
                saveMatchToHistory(false, currentGameMode, humanPlayer2.kills || 0, loseMedals, selectedNexusId, loseCoins, humanSnapshot);
            }
            // Reset streak on game end
            currentStreak = 0; streakTimer = 0;

            playerMatchesPlayed = Math.max(0, (Number.isFinite(playerMatchesPlayed) ? playerMatchesPlayed : 0) + 1);
            storageSetItem('playerMatchesPlayed', String(playerMatchesPlayed));

            const lbDiv = document.getElementById('leaderboard');
            if (lbDiv) {
                lbDiv.innerHTML = '';
                lbDiv.style.display = 'none';
            }

            // Show the overlay
            overlay.style.display = 'flex';

            // Reset game state but keep player progress
            players = [];
            bots = [];
            lasers = [];
            aiLasers = [];
            healthPacks = [];
            ball = null;
            goals = [];
            teamScores = {};

        }

        // Star Drop / Loot Box system
        const chestTiers = deepCloneConfig(
            externalGameData.chestTiers,
            [
                { name: 'Common', color: '#b0b0b0', bg: 'linear-gradient(135deg, #2a2a2a, #3a3a3a)', glow: 'rgba(176,176,176,0.3)', upgradeChance: 0.35 },
                { name: 'Rare', color: '#4a8af5', bg: 'linear-gradient(135deg, #1a2a4a, #2a3a6a)', glow: 'rgba(74,138,245,0.4)', upgradeChance: 0.25 },
                { name: 'Epic', color: '#b44aff', bg: 'linear-gradient(135deg, #2a1a3a, #4a2a6a)', glow: 'rgba(180,74,255,0.4)', upgradeChance: 0.15 },
                { name: 'Mythic', color: '#ff4a6a', bg: 'linear-gradient(135deg, #3a1a1a, #6a2a2a)', glow: 'rgba(255,74,106,0.4)', upgradeChance: 0.08 },
                { name: 'Legendary', color: '#ffaa00', bg: 'linear-gradient(135deg, #3a2a0a, #5a4a1a, #6a5a20)', glow: 'rgba(255,170,0,0.5)', upgradeChance: 0 }
            ]
        );

        function getStarDropReward(tierIndex) {
            const killFeedColors = [
                { name: 'Red',      color: '#ff4444' },
                { name: 'Cyan',     color: '#44ffff' },
                { name: 'Lime',     color: '#44ff44' },
                { name: 'Pink',     color: '#ff66cc' },
                { name: 'Orange',   color: '#ff8833' },
                { name: 'Gold',     color: '#ffcc00' },
                { name: 'Purple',   color: '#bb66ff' },
                { name: 'Ice Blue', color: '#66ccff' },
            ];

            // Rewards scale with tier
            const rewardsByTier = [
                // Common
                [
                    { type: 'coins', amount: 25,  weight: 50, icon: 'ðŸ’°', text: '+25 Coins' },
                    { type: 'coins', amount: 50,  weight: 5, icon: 'ðŸ’°', text: '+50 Coins' },
                    { type: 'sparks', amount: 20,  weight: 35, icon: 'âš¡', text: '+20 Energy Sparks' },
                    { type: 'killfeedcolor', weight: 10, icon: 'ðŸŽ¨', text: '', colors: killFeedColors },
                ],
                // Rare
                [
                    { type: 'coins', amount: 50,  weight: 25, icon: 'ðŸ’°', text: '+50 Coins' },
                    { type: 'coins', amount: 100, weight: 20, icon: 'ðŸ’°', text: '+100 Coins' },
                    { type: 'sparks', amount: 50, weight: 20, icon: 'âš¡', text: '+50 Energy Sparks' },
                    { type: 'killfeedcolor', weight: 10, icon: 'ðŸŽ¨', text: '', colors: killFeedColors },
                    { type: 'credits', amount: 50, weight: 15, icon: 'ðŸŽ–ï¸', text: '+50 Hero Marks' },
                    { type: 'gadget', weight: 6, icon: 'ðŸ§°', text: 'Random Gadget Unlock' },
                ],
                // Epic
                [
                    { type: 'coins', amount: 100, weight: 20, icon: 'ðŸ’°', text: '+100 Coins' },
                    { type: 'coins', amount: 200, weight: 15, icon: 'ðŸ’°', text: '+200 Coins!' },
                    { type: 'sparks', amount: 30, weight: 15, icon: 'âš¡', text: '+30 Energy Sparks' },
                    { type: 'killfeedcolor', weight: 10, icon: 'ðŸŽ¨', text: '', colors: killFeedColors },
                    { type: 'credits', amount: 100, weight: 25, icon: 'ðŸŽ–ï¸', text: '+100 Hero Marks!' },
                    { type: 'gadget', weight: 10, icon: 'ðŸ§°', text: 'Random Gadget Unlock' },
                ],
                // Mythic
                [
                    { type: 'coins', amount: 200, weight: 20, icon: 'ðŸ’°', text: '+200 Coins!' },
                    { type: 'coins', amount: 350, weight: 10, icon: 'ðŸ’°', text: '+350 Coins!' },
                    { type: 'sparks', amount: 60, weight: 20, icon: 'âš¡', text: '+60 Energy Sparks' },
                    { type: 'killfeedcolor', weight: 20, icon: 'ðŸŽ¨', text: '', colors: killFeedColors },
                    { type: 'credits', amount: 150, weight: 15, icon: 'ðŸŽ–ï¸', text: '+150 Hero Marks!' },
                    { type: 'gadget', weight: 12, icon: 'ðŸ§°', text: 'Random Gadget Unlock' },
                ],
                // Legendary
                [
                    { type: 'coins', amount: 350, weight: 15, icon: 'ðŸ’°', text: '+350 Coins!' },
                    { type: 'coins', amount: 500, weight: 10, icon: 'ðŸ’°', text: '+500 Coins!!' },
                    { type: 'sparks', amount: 100, weight: 25, icon: 'âš¡', text: '+100 Energy Sparks!' },
                    { type: 'killfeedcolor', weight: 10, icon: 'ðŸŽ¨', text: '', colors: killFeedColors },
                    { type: 'credits', amount: 250, weight: 25, icon: 'ðŸŽ–ï¸', text: '+250 Hero Marks!!' },
                    { type: 'gadget', weight: 18, icon: 'ðŸ§°', text: 'Random Gadget Unlock' },
                ],
            ];

            const rewards = rewardsByTier[tierIndex] || rewardsByTier[0];
            const totalWeight = rewards.reduce((s, r) => s + r.weight, 0);
            let roll = Math.random() * totalWeight;
            for (const r of rewards) {
                roll -= r.weight;
                if (roll <= 0) {
                    if (r.type === 'killfeedcolor') {
                        const picked = r.colors[Math.floor(Math.random() * r.colors.length)];
                        return { type: 'killfeedcolor', icon: 'ðŸŽ¨', text: `${picked.name} Kill Feed Color!`, color: picked.color };
                    }
                    if (r.type === 'gadget') {
                        const gadgetKey = getRandomLockedGadgetKey();
                        if (!gadgetKey) return { type: 'coins', amount: 120, icon: 'ðŸ’°', text: '+120 Coins (No gadgets left)' };
                        return { type: 'gadget', icon: 'ðŸ§°', text: `Unlocked gadget: ${gadgetData[gadgetKey].name}!`, gadgetKey };
                    }
                    return r;
                }
            }
            return rewards[0];
        }

        function showStarDrop() {
            if (pendingStarDrops > 0) pendingStarDrops--;
            const overlay = document.getElementById('stardrop-overlay');
            const box = document.getElementById('stardrop-box');
            const chest = document.getElementById('stardrop-chest');
            const rewardDiv = document.getElementById('stardrop-reward');
            const rewardText = document.getElementById('stardrop-reward-text');
            const collectBtn = document.getElementById('stardrop-collect');
            const titleEl = document.getElementById('stardrop-title');
            const rarityLabel = document.getElementById('stardrop-rarity-label');
            const clicksDiv = document.getElementById('stardrop-clicks');
            const hintEl = document.getElementById('stardrop-hint');

            let currentTier = 0;
            let clicksLeft = 5;

            function updateTierVisuals() {
                const tier = chestTiers[currentTier];
                box.style.borderColor = tier.color;
                box.style.boxShadow = `0 0 60px ${tier.glow}, inset 0 0 30px ${tier.glow}`;
                box.style.background = tier.bg;
                rarityLabel.textContent = tier.name;
                rarityLabel.style.color = tier.color;
                clicksDiv.innerHTML = 'â­'.repeat(5 - clicksLeft) + 'âšª'.repeat(clicksLeft);
            }

            // Reset state
            chest.src = 'images/chestclose.png';
            chest.style.transform = '';
            chest.style.pointerEvents = 'auto';
            rewardDiv.style.display = 'none';
            collectBtn.style.display = 'none';
            hintEl.style.display = 'block';
            titleEl.textContent = 'Chest Drop!';
            titleEl.style.color = '#ffcc00';
            overlay.style.display = 'flex';
            updateTierVisuals();

            // Click anywhere on overlay to tap chest
            chest.onclick = null;
            overlay.onclick = (e) => {
                // Don't count clicks on the collect button
                if (e.target === collectBtn) return;
                if (clicksLeft <= 0) return;
                clicksLeft--;

                // Shake effect
                chest.style.transform = `rotate(${(Math.random() - 0.5) * 12}deg) scale(${1.05 + (5 - clicksLeft) * 0.03})`;
                setTimeout(() => { chest.style.transform = `scale(${1 + (5 - clicksLeft) * 0.02})`; }, 150);

                // Try to upgrade tier
                if (currentTier < chestTiers.length - 1) {
                    if (Math.random() < chestTiers[currentTier].upgradeChance) {
                        currentTier++;
                        // Bright flash on upgrade then settle to tier bg
                        box.style.transition = 'none';
                        box.style.background = `radial-gradient(circle, ${chestTiers[currentTier].color}88, ${chestTiers[currentTier].color}44)`;
                        setTimeout(() => {
                            box.style.transition = 'background 0.6s';
                            box.style.background = chestTiers[currentTier].bg;
                        }, 250);
                    }
                }

                updateTierVisuals();

                // Open on last click
                if (clicksLeft <= 0) {
                    chest.style.pointerEvents = 'none';
                    hintEl.style.display = 'none';
                    setTimeout(() => {
                        chest.src = 'images/chestopen.png';
                        chest.style.transform = 'scale(1.15)';

                        const reward = getStarDropReward(currentTier);
                        rewardText.textContent = reward.icon + ' ' + reward.text;
                        rewardText.style.color = reward.type === 'killfeedcolor' ? reward.color : chestTiers[currentTier].color;
                        rewardDiv.style.display = 'block';
                        collectBtn.style.display = 'inline-block';
                        titleEl.textContent = 'ðŸŽ ' + chestTiers[currentTier].name + ' Reward!';
                        titleEl.style.color = chestTiers[currentTier].color;

                        // Collect button
                        collectBtn.onclick = () => {
                            if (reward.type === 'coins') {
                                playerCoins += reward.amount;
                            } else if (reward.type === 'killfeedcolor') {
                                killFeedColor = reward.color;
                            } else if (reward.type === 'credits') {
                                playerCredits += reward.amount;
                            } else if (reward.type === 'sparks') {
                                energySparks += reward.amount;
                            } else if (reward.type === 'gadget' && reward.gadgetKey) {
                                unlockGadget(reward.gadgetKey);
                            }
                            saveProgress();
                            showCoins();
                            overlay.style.display = 'none';
                            if (pendingStarDrops > 0) {
                                setTimeout(() => showStarDrop(), 250);
                            }
                        };
                    }, 400);
                }
            };

            // Hover effect
            chest.onmouseenter = () => { if (clicksLeft > 0) chest.style.transform = `scale(${1.08 + (5 - clicksLeft) * 0.02})`; };
            chest.onmouseleave = () => { if (clicksLeft > 0) chest.style.transform = `scale(${1 + (5 - clicksLeft) * 0.02})`; };
        }

        let gameLoopRequestId = null;

        // Game loop
        function updatePlayerRegen() {
            if (!player || player.currentHp <= 0 || player.currentHp >= player.maxHp) return;
            if (player.regenCooldown > 0) { player.regenCooldown--; return; }
            player.regenTimer++;
            if (player.regenTimer >= 90) {
                player.currentHp = Math.min(player.maxHp, player.currentHp + PASSIVE_REGEN_AMOUNT);
                player.regenTimer = 0;
            }
        }

        function gameLoop() {
            if (!gameStarted) {
                gameLoopRequestId = null;
                return;
            }

            ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

            updateCamera();
            handleInputFrame();
            handlePlayerAbilities();
            updatePlayerRegen();

            // Continuous shooting while mouse aim is active
            if (mouseShootAimActive && player && player.currentHp > 0 && player.shootCooldown <= 0) {
                playerShoot(mouseShootAimWorldX, mouseShootAimWorldY);
            }

            updateAllBots();
            updateSnakeMinions();
            updateHuntearTraps();
            updateMagnetsCompanions();
            updateRespawns();
            updateLasers();
            updateSupers();
            updateStreak();
            updatePoisonZone();
            updateBall();
            updateKingTown();
            updateZoneCapture();
            updateBountyTimer();
            checkGameEnd();

            drawBackground();
            drawObstacles();
            drawGoals();
            drawHealthPacks();
            drawPlayers();
            drawShootAimPreview();
            drawDamagePopups();
            drawHealPickupEffects();
            drawSnakeMinions();
            drawHuntearTraps();
            drawMagnetsCompanions();
            drawBushes();
            drawSuperEffects();
            updateDrawGadgetEffects();
            drawBall();
            drawCaptureZones();
            drawLasers();
            drawPoisonZone();
            drawHUD();
            drawKingTownBanner();
            drawKillFeed();
            drawHealMessage();
            drawRespawnOverlay();
            drawLevelUp();

            // Update mobile use-item button icon
            if (player) {
                const uibEl = document.getElementById('use-item-icon');
                if (uibEl) uibEl.textContent = (player.items && player.items.length > 0) ? PICKUP_ICONS[player.items[0]] + (player.items.length > 1 ? ` Ã—${player.items.length}` : '') : 'ðŸŽ’';
            }

            gameLoopRequestId = requestAnimationFrame(gameLoop);
        }

        // â”€â”€ DAILY CHALLENGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        const DAILY_CHALLENGE_DEFS = deepCloneConfig(
            externalGameData.dailyChallenges,
            [
                { id: 'win2', desc: 'Win 2 matches', type: 'wins', target: 2, reward: { type: 'sparks', amount: 250 }, icon: 'ðŸ†' },
                { id: 'win3', desc: 'Win 3 matches', type: 'wins', target: 3, reward: { type: 'sparks', amount: 400 }, icon: 'ðŸ†' },
                { id: 'win5', desc: 'Win 5 matches', type: 'wins', target: 5, reward: { type: 'sparks', amount: 680 }, icon: 'ðŸ†' },
                { id: 'kill8', desc: 'Get 8 kills in total', type: 'kills', target: 8, reward: { type: 'sparks', amount: 300 }, icon: 'âš¡' },
                { id: 'kill12', desc: 'Get 12 kills in total', type: 'kills', target: 12, reward: { type: 'sparks', amount: 450 }, icon: 'âš¡' },
                { id: 'kill20', desc: 'Get 20 kills in total', type: 'kills', target: 20, reward: { type: 'sparks', amount: 760 }, icon: 'âš¡' },
                { id: 'kill5match', desc: 'Get 5 kills in one match', type: 'matchKills', target: 5, reward: { type: 'sparks', amount: 360 }, icon: 'ðŸŽ¯' },
                { id: 'kill8match', desc: 'Get 8 kills in one match', type: 'matchKills', target: 8, reward: { type: 'coins', amount: 260 }, icon: 'ðŸŽ¯' },
                { id: 'play3', desc: 'Play 3 matches', type: 'games', target: 3, reward: { type: 'sparks', amount: 220 }, icon: 'ðŸŽ®' },
                { id: 'play5', desc: 'Play 5 matches', type: 'games', target: 5, reward: { type: 'sparks', amount: 380 }, icon: 'ðŸŽ®' },
                { id: 'play8', desc: 'Play 8 matches', type: 'games', target: 8, reward: { type: 'coins', amount: 240 }, icon: 'ðŸŽ®' },
                { id: 'streak3', desc: 'Get a 3-kill streak', type: 'streak', target: 3, reward: { type: 'sparks', amount: 360 }, icon: 'ðŸ”¥' },
                { id: 'streak5', desc: 'Reach RAMPAGE (5 streak)', type: 'streak', target: 5, reward: { type: 'sparks', amount: 650 }, icon: 'ðŸ’¥' },
                { id: 'streak7', desc: 'Reach GODLIKE (7 streak)', type: 'streak', target: 7, reward: { type: 'credits', amount: 8 }, icon: 'ðŸ’¥' },
                { id: 'damage1200', desc: 'Deal 1200 total damage', type: 'damage', target: 1200, reward: { type: 'sparks', amount: 320 }, icon: 'ðŸ’£' },
                { id: 'damage2000', desc: 'Deal 2000 total damage', type: 'damage', target: 2000, reward: { type: 'sparks', amount: 520 }, icon: 'ðŸ’¥' },
                { id: 'damage3500', desc: 'Deal 3500 total damage', type: 'damage', target: 3500, reward: { type: 'sparks', amount: 840 }, icon: 'ðŸ’¥' },
                { id: 'survive120', desc: 'Survive 2 minutes in one match', type: 'survive', target: 120, reward: { type: 'sparks', amount: 320 }, icon: 'â±ï¸' },
                { id: 'survive180', desc: 'Survive 3 minutes in one match', type: 'survive', target: 180, reward: { type: 'coins', amount: 220 }, icon: 'â±ï¸' },
                { id: 'winstreak2', desc: 'Win 2 matches in a row', type: 'winstreak', target: 2, reward: { type: 'coins', amount: 150 }, icon: 'ðŸ”´' },
                { id: 'winstreak3', desc: 'Win 3 matches in a row', type: 'winstreak', target: 3, reward: { type: 'sparks', amount: 400 }, icon: 'ðŸŽ¯' },
                { id: 'winstreak4', desc: 'Win 4 matches in a row', type: 'winstreak', target: 4, reward: { type: 'credits', amount: 6 }, icon: 'ðŸŽ¯' },
                { id: 'coins200', desc: 'Earn 200 coins total', type: 'coins', target: 200, reward: { type: 'sparks', amount: 280 }, icon: 'ðŸ’°' },
                { id: 'coins500', desc: 'Earn 500 coins total', type: 'coins', target: 500, reward: { type: 'sparks', amount: 550 }, icon: 'ðŸ’°' },
                { id: 'coins900', desc: 'Earn 900 coins total', type: 'coins', target: 900, reward: { type: 'credits', amount: 5 }, icon: 'ðŸ’°' }
            ]
        );

        function getDailyKey() {
            const d = new Date();
            return `daily_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`;
        }

        function loadDailyChallenges(key = getDailyKey()) {
            const saved = readStorageJson(key, null);
            if (saved) return saved;
            // Pick 7 random challenges for today
            const shuffled = [...DAILY_CHALLENGE_DEFS].sort(() => Math.random() - 0.5);
            const dailyCount = Math.min(7, DAILY_CHALLENGE_DEFS.length);
            const picked = shuffled.slice(0, dailyCount).map(c => ({
                id: c.id, progress: 0, claimed: false
            }));
            storageSetItem(key, JSON.stringify(picked));
            return picked;
        }

        let activeDailyKey = getDailyKey();
        let dailyState = loadDailyChallenges(activeDailyKey);

        function ensureDailyChallengesCurrent() {
            const todayKey = getDailyKey();
            if (todayKey === activeDailyKey) return;
            activeDailyKey = todayKey;
            dailyState = loadDailyChallenges(activeDailyKey);
        }

        function getDailyDef(id) { return DAILY_CHALLENGE_DEFS.find(d => d.id === id); }

        function progressDaily(type, amount = 1) {
            ensureDailyChallengesCurrent();
            let changed = false;
            for (const s of dailyState) {
                if (s.claimed) continue;
                const def = getDailyDef(s.id);
                if (!def || def.type !== type) continue;
                s.progress = Math.min(def.target, s.progress + amount);
                changed = true;
            }
            if (changed) {
                storageSetItem(activeDailyKey, JSON.stringify(dailyState));
                updateDailyBadge();
            }
        }

        function progressDailyBest(type, bestValue = 0) {
            ensureDailyChallengesCurrent();
            let changed = false;
            for (const s of dailyState) {
                if (s.claimed) continue;
                const def = getDailyDef(s.id);
                if (!def || def.type !== type) continue;
                const capped = Math.min(def.target, Math.max(0, Math.floor(bestValue)));
                if (capped > (s.progress || 0)) {
                    s.progress = capped;
                    changed = true;
                }
            }
            if (changed) {
                storageSetItem(activeDailyKey, JSON.stringify(dailyState));
                updateDailyBadge();
            }
        }

        function updateDailyBadge() {
            ensureDailyChallengesCurrent();
            const badge = document.getElementById('daily-badge');
            if (!badge) return;
            const claimable = dailyState.filter(s => {
                const def = getDailyDef(s.id);
                return !s.claimed && def && s.progress >= def.target;
            }).length;
            badge.style.display = claimable > 0 ? 'inline-block' : 'none';
            badge.textContent = claimable;
        }

        function openDailyChallenges() {
            ensureDailyChallengesCurrent();
            renderDailyChallenges();
            document.getElementById('daily-panel').style.display = 'block';
        }

        function getDailyChallengeIcon(def) {
            if (!def) return 'ðŸŽ¯';
            const iconByType = {
                wins: 'ðŸ†',
                kills: 'âš”ï¸',
                matchKills: 'ðŸŽ¯',
                games: 'ðŸŽ®',
                streak: 'ðŸ”¥',
                damage: 'ðŸ’¥',
                survive: 'â±ï¸',
                winstreak: 'ðŸ“ˆ',
                coins: 'ðŸ’°'
            };
            if (iconByType[def.type]) return iconByType[def.type];
            return def.icon || 'ðŸŽ¯';
        }

        function renderDailyChallenges() {
            ensureDailyChallengesCurrent();
            const list = document.getElementById('daily-list');
            const label = document.getElementById('daily-reset-label');
            // Time until midnight
            const now = new Date();
            const midnight = new Date(now); midnight.setHours(24,0,0,0);
            const hoursLeft = Math.ceil((midnight - now) / 3600000);
            label.textContent = `Resets in ${hoursLeft}h Â· New challenges every day`;
            list.innerHTML = '';
            for (const s of dailyState) {
                const def = getDailyDef(s.id);
                if (!def) continue;
                const pct = Math.min(100, Math.round(s.progress / def.target * 100));
                const ready = s.progress >= def.target && !s.claimed;
                const challengeIcon = getDailyChallengeIcon(def);
                const row = document.createElement('div');
                row.className = 'challenge-row' + (s.claimed ? ' done' : '');
                row.innerHTML = `
                    <span style="font-size:20px">${challengeIcon}</span>
                    <div style="flex:1">
                        <div style="font-size:13px;margin-bottom:4px">${def.desc}
                            <span style="color:#aaa;font-size:11px;margin-left:6px">(${s.progress}/${def.target})</span>
                        </div>
                        <div class="challenge-progress"><div class="challenge-progress-fill" style="width:${pct}%"></div></div>
                    </div>
                    <div style="font-size:12px;color:${def.reward.type==='coins'?'#ffcc00':'#44aaff'}">
                        ${def.reward.type==='coins'?'ðŸ’°':'âš¡'} +${def.reward.amount}
                    </div>
                    ${s.claimed
                        ? '<span style="color:#27ae60;font-size:12px">âœ…</span>'
                        : ready
                            ? `<button onclick="claimDaily('${s.id}')" style="background:#27ae60;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:bold">Claim!</button>`
                            : '<span style="color:#555;font-size:12px">ðŸ”’</span>'
                    }
                `;
                list.appendChild(row);
            }
        }

        function claimDaily(id) {
            ensureDailyChallengesCurrent();
            const s = dailyState.find(x => x.id === id);
            const def = getDailyDef(id);
            if (!s || !def || s.claimed || s.progress < def.target) return;
            s.claimed = true;
            if (def.reward.type === 'coins')  { playerCoins   += def.reward.amount; }
            else if (def.reward.type === 'sparks')  { energySparks  += def.reward.amount; }
            else if (def.reward.type === 'credits') { playerCredits += def.reward.amount; }
            saveProgress();
            showCoins();
            storageSetItem(activeDailyKey, JSON.stringify(dailyState));
            updateDailyBadge();
            renderDailyChallenges();
        }

        // â”€â”€ KILL STREAK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        let currentStreak = 0;
        let streakTimer   = 0; // frames since last kill
        const STREAK_WINDOW = 600; // 10 seconds at 60fps

        let currentWinStreak = 0; // Track wins in a row

        const STREAK_LABELS = {
            2: { text: 'DOUBLE KILL!', color: '#ffcc00', size: 34 },
            3: { text: 'TRIPLE KILL!', color: '#ff8800', size: 38 },
            5: { text: 'RAMPAGE!',     color: '#ff3333', size: 46 },
        };

        function registerKill() {
            ensureDailyChallengesCurrent();
            streakTimer = 0;
            currentStreak++;
            showStreakBanner(currentStreak);

            // Progress daily streak challenge (check if current streak meets target)
            for (const s of dailyState) {
                if (s.claimed) continue;
                const def = getDailyDef(s.id);
                if (!def || def.type !== 'streak') continue;
                if (currentStreak >= def.target) {
                    s.progress = def.target;
                    storageSetItem(activeDailyKey, JSON.stringify(dailyState));
                    updateDailyBadge();
                }
            }
        }

        let matchStartedAt = 0;

        function evaluateDailyMatchChallenges(matchKills, survivedSeconds) {
            progressDailyBest('matchKills', matchKills);
            progressDailyBest('survive', survivedSeconds);
        }

        let streakBannerTimeout = null;
        function showStreakBanner(n) {
            const label = STREAK_LABELS[n];
            if (!label) return;
            const el = document.getElementById('streak-banner');
            el.textContent = label.text;
            el.style.fontSize = label.size + 'px';
            el.style.color = label.color;
            el.style.opacity = '1';
            clearTimeout(streakBannerTimeout);
            streakBannerTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1800);
        }

        function updateStreak() {
            if (!gameStarted || currentStreak === 0) return;
            streakTimer++;
            if (streakTimer > STREAK_WINDOW) {
                currentStreak = 0;
                streakTimer = 0;
            }
        }

        // â”€â”€ MATCH HISTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        function getMatchHistoryStorageKey(accountKey = null) {
            if (accountKey) return `matchHistory_${accountKey}`;
            const profile = getCurrentProfile();
            if (profile?.username) return `matchHistory_${normalizeUsername(profile.username)}`;
            return 'matchHistory_guest';
        }

        function loadMatchHistory(accountKey = null) {
            const key = getMatchHistoryStorageKey(accountKey);
            const raw = storageGetItem(key);
            if (raw) return parseStorageJson(raw, []);
            // Backward compatibility for older builds that used one global key.
            if (!accountKey && key !== 'matchHistory') {
                return readStorageJson('matchHistory', []);
            }
            return [];
        }

        function saveMatchToHistory(isVictory, mode, kills, medals, characterId, coinsEarned, analytics = {}) {
            const history = loadMatchHistory();
            history.unshift({
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
                result: isVictory ? 'win' : 'lose',
                mode,
                kills,
                medals,
                characterId: characterId || 'default',
                coinsEarned: coinsEarned || 0,
                damageDealt: analytics.damageDealt || 0,
                healingReceived: analytics.healingReceived || 0,
                survivedSeconds: analytics.survivedSeconds || 0,
                peakStreak: analytics.peakStreak || 0,
                remainingHpPct: analytics.remainingHpPct || 0,
                ts: Date.now(),
            });
            if (history.length > 20) history.length = 20;
            storageSetItem(getMatchHistoryStorageKey(), JSON.stringify(history));
        }

        function openMatchHistory() {
            renderMatchHistory();
            document.getElementById('history-panel').style.display = 'block';
        }

        function renderMatchHistory() {
            const stats = document.getElementById('history-stats');
            const list = document.getElementById('history-list');
            const history = loadMatchHistory();

            const totalMatches = history.length;
            const wins = history.filter(h => h.result === 'win').length;
            const losses = totalMatches - wins;
            const totalKills = history.reduce((sum, h) => sum + (h.kills || 0), 0);
            const lifetimeCoins = history.reduce((sum, h) => sum + (h.coinsEarned || 0), 0);
            const totalDamage = history.reduce((sum, h) => sum + (h.damageDealt || 0), 0);
            const avgSurvival = totalMatches > 0
                ? Math.round(history.reduce((sum, h) => sum + (h.survivedSeconds || 0), 0) / totalMatches)
                : 0;

            const charCounts = {};
            for (const h of history) {
                const cid = h.characterId || 'default';
                charCounts[cid] = (charCounts[cid] || 0) + 1;
            }
            const favoriteCharId = Object.keys(charCounts).sort((a, b) => charCounts[b] - charCounts[a])[0] || 'default';
            const favoriteChar = (playersData[favoriteCharId] && playersData[favoriteCharId].name) || 'N/A';
            const wlText = totalMatches > 0 ? `${wins}-${losses}` : '0-0';

            stats.innerHTML = `
                <div class="history-stat-card"><div class="label">W / L</div><div class="value">${wlText}</div></div>
                <div class="history-stat-card"><div class="label">Total Kills</div><div class="value">${totalKills}</div></div>
                <div class="history-stat-card"><div class="label">Favorite Character</div><div class="value" style="font-size:13px;">${favoriteChar}</div></div>
                <div class="history-stat-card"><div class="label">Lifetime Coins Earned</div><div class="value">${lifetimeCoins}</div></div>
                <div class="history-stat-card"><div class="label">Total Damage</div><div class="value">${totalDamage}</div></div>
                <div class="history-stat-card"><div class="label">Avg Survival</div><div class="value">${avgSurvival}s</div></div>
            `;

            if (history.length === 0) {
                list.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">No matches played yet.</p>';
                return;
            }
            list.innerHTML = history.map(m => `
                <div class="history-row ${m.result}">
                    <span style="font-size:18px">${m.result === 'win' ? 'ðŸ†' : 'ðŸ’€'}</span>
                    <div style="flex:1">
                        <div style="font-weight:bold;font-size:13px">${m.result === 'win' ? 'Victory' : 'Defeat'} Â· ${m.mode}</div>
                        <div style="color:#aaa;font-size:11px">${m.date} ${m.time}</div>
                    </div>
                    <div style="text-align:right;font-size:12px;color:#ccc">
                        âš”ï¸ ${m.kills} kills<br>
                        DMG ${m.damageDealt || 0} Â· HEAL ${m.healingReceived || 0}<br>
                        â±ï¸ ${m.survivedSeconds || 0}s Â· ðŸ”¥ x${m.peakStreak || 0}<br>
                        <span style="color:#ffcc00">ðŸ’° +${m.coinsEarned || 0}</span><br>
                        <span style="${m.medals >= 0 ? 'color:#ffcc00' : 'color:#ff6666'}">ðŸ… ${m.medals >= 0 ? '+' : ''}${m.medals}</span>
                    </div>
                </div>
            `).join('');
        }

        // â”€â”€ TUTORIAL & TIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        const GAME_TIPS = [
            { title: 'ðŸŽ¯ Basic Movement', text: 'Use Arrow Keys / WASD / Left Joystick to move around the map. Strafe side-to-side to avoid enemy fire.' },
            { title: 'ðŸ”« Shooting', text: 'Click / Tap / Right Joystick to aim and fire. Lead your shots on moving targets. Different characters have different attack types!' },
            { title: 'âš¡ Super Ability', text: 'Each character has a unique super ability charged by dealing damage. Press the Super button (or assigned key) to unleash it for massive effect.' },
            { title: 'ðŸ’š Health Packs', text: 'Green heal packs restore HP and grant a short damage boost. Grab them when your health is low.' },
            { title: 'ðŸ›¡ï¸ Obstacles', text: ' brown bricks and blue water block your movement and bullets. Use them as cover against enemies.(some players can move on water)' },
            { title: 'ðŸ† Game Modes', text: 'Try different modes: Showdown (Free-for-All), Team Battle (3v3), Ball-Goal (soccer), and more. Each has unique rewards!' },
            { title: 'ðŸ’° Progression', text: 'Earn coins and medals from every match. Use energy sparks and coins to upgrade character stats.' },
            { title: 'âš”ï¸ Daily Challenges', text: 'Complete daily challenges for extra energy sparks. Win streaks, survive matches, deal damage â€“ the more you play, the more you earn!' },
            { title: 'ðŸŽ® Mobile Support', text: 'Play on mobile with touch joysticks (left for movement, right for aiming). Adjustable in settings when on touch devices.' },
            { title: 'ðŸŒŸ Tips for Victory', text: 'Stay mobile, use cover, focus fire with teammates, manage your health, and upgrade your favorite characters. Good luck!' },
        ];

        const ONBOARDING_STEPS = [
            {
                title: '1) Move',
                body: 'Move your player for 1 second.',
                hint: 'Desktop: WASD/Arrows. Mobile: left joystick.',
                objective: 'Move.'
            },
            {
                title: '2) Shoot',
                body: 'Shoot once.',
                hint: 'Desktop: click arena. Mobile: right joystick or Shoot button.',
                objective: 'Shoot once.'
            },
            {
                title: '3) Use Super',
                body: 'Use Super once.',
                hint: 'Desktop: press E. Mobile: tap Super button.',
                objective: 'Use Super once.'
            },
            {
                title: '4) Use Gadget',
                body: 'Use Gadget once.',
                hint: 'Desktop: press Space. Mobile: tap Gadget button.',
                objective: 'Use Gadget once.'
            },
            {
                title: '5) Start Playing',
                body: 'You are ready.',
                hint: 'Press Start Playing to begin battles.',
                objective: 'Tutorial complete.'
            }
        ];

        let onboardingStepIndex = 0;
        let onboardingAutoAdvanceTimer = null;
        let onboardingProgress = {
            moved: false,
            aimed: false,
            shot: false,
            superAimed: false,
            superUsed: false,
            gadgetAimed: false,
            gadgetUsed: false,
            itemUsed: false
        };
        let onboardingArena = { x: 130, y: 70, aimX: 1, aimY: 0 };
        const ONBOARDING_TARGET_BOT_IMAGE = 'images/tutorial bot.png';
        const onboardingTargetBotState = { maxHp: 220, hp: 220 };

        function getOnboardingCharacterData() {
            return playersData.default || null;
        }

        function getOnboardingArenaLimits() {
            const arenaEl = document.getElementById('onboarding-arena');
            const playerEl = document.getElementById('onboarding-player');
            const width = (arenaEl && arenaEl.clientWidth) ? arenaEl.clientWidth : 260;
            const height = (arenaEl && arenaEl.clientHeight) ? arenaEl.clientHeight : 140;
            const playerSize = (playerEl && playerEl.clientWidth) ? playerEl.clientWidth : 40;
            return {
                minX: playerSize / 2,
                minY: playerSize / 2,
                maxX: Math.max(playerSize / 2, width - playerSize / 2),
                maxY: Math.max(playerSize / 2, height - playerSize / 2)
            };
        }

        function clampOnboardingPlayer() {
            const limits = getOnboardingArenaLimits();
            onboardingArena.x = Math.max(limits.minX, Math.min(limits.maxX, onboardingArena.x));
            onboardingArena.y = Math.max(limits.minY, Math.min(limits.maxY, onboardingArena.y));
        }

        function resetOnboardingArena() {
            const limits = getOnboardingArenaLimits();
            onboardingArena.x = (limits.minX + limits.maxX) / 2;
            onboardingArena.y = (limits.minY + limits.maxY) / 2;
            onboardingArena.aimX = 1;
            onboardingArena.aimY = 0;
            renderOnboardingArena();
        }

        function resetOnboardingTargetBot() {
            onboardingTargetBotState.hp = onboardingTargetBotState.maxHp;
        }

        function getOnboardingTargetDirection() {
            const botEl = document.getElementById('onboarding-target-bot');
            if (!botEl) return null;
            const botX = botEl.offsetLeft + botEl.offsetWidth / 2;
            const botY = botEl.offsetTop + botEl.offsetHeight / 2;
            const dx = botX - onboardingArena.x;
            const dy = botY - onboardingArena.y;
            const distance = Math.hypot(dx, dy);
            return { dx, dy, distance };
        }

        function spawnOnboardingShot(nx, ny, color = '#ffcf5a', size = 7) {
            const arenaEl = document.getElementById('onboarding-arena');
            if (!arenaEl) return;

            const mag = Math.hypot(nx, ny);
            const ux = mag > 0.01 ? (nx / mag) : onboardingArena.aimX;
            const uy = mag > 0.01 ? (ny / mag) : onboardingArena.aimY;
            const range = 86;
            const startX = onboardingArena.x;
            const startY = onboardingArena.y;
            const endX = startX + ux * range;
            const endY = startY + uy * range;

            const shotEl = document.createElement('div');
            shotEl.style.position = 'absolute';
            shotEl.style.left = `${startX}px`;
            shotEl.style.top = `${startY}px`;
            shotEl.style.width = `${size}px`;
            shotEl.style.height = `${size}px`;
            shotEl.style.borderRadius = '50%';
            shotEl.style.background = color;
            shotEl.style.boxShadow = `0 0 10px ${color}`;
            shotEl.style.transform = 'translate(-50%, -50%)';
            shotEl.style.pointerEvents = 'none';
            shotEl.style.zIndex = '20';
            shotEl.style.transition = 'left 120ms linear, top 120ms linear, opacity 140ms linear';

            arenaEl.appendChild(shotEl);
            requestAnimationFrame(() => {
                shotEl.style.left = `${endX}px`;
                shotEl.style.top = `${endY}px`;
                shotEl.style.opacity = '0.18';
            });
            setTimeout(() => {
                if (shotEl.parentNode) shotEl.parentNode.removeChild(shotEl);
            }, 170);
        }

        function attemptOnboardingAttack(nx, ny) {
            if (!isOnboardingActive() || onboardingStepIndex !== 1) return false;
            spawnOnboardingShot(nx, ny, '#ffd778', 7);
            onboardingProgress.aimed = true;
            onboardingProgress.shot = true;

            onboardingTargetBotState.hp = Math.max(0, onboardingTargetBotState.hp - 25);
            if (onboardingTargetBotState.hp <= 0) onboardingTargetBotState.hp = onboardingTargetBotState.maxHp;

            renderOnboardingStep();
            renderOnboardingArena();
            return true;
        }

        function attemptOnboardingSuper(nx, ny) {
            if (!isOnboardingActive() || onboardingStepIndex !== 2) return false;
            spawnOnboardingShot(nx, ny, '#ff9f45', 10);
            onboardingProgress.superUsed = true;
            onboardingProgress.superAimed = true;
            onboardingTargetBotState.hp = Math.max(0, onboardingTargetBotState.hp - 50);
            if (onboardingTargetBotState.hp <= 0) onboardingTargetBotState.hp = onboardingTargetBotState.maxHp;

            renderOnboardingStep();
            renderOnboardingArena();
            return true;
        }

        function attemptOnboardingGadget(nx, ny) {
            if (!isOnboardingActive() || onboardingStepIndex !== 3) return false;
            spawnOnboardingShot(nx, ny, '#55ff96', 8);
            const aimMag = Math.hypot(nx, ny);
            if (aimMag < 0.08) return false;
            const targetVec = getOnboardingTargetDirection();
            if (!targetVec || targetVec.distance < 1) return false;

            const ax = nx / aimMag;
            const ay = ny / aimMag;
            const tx = targetVec.dx / targetVec.distance;
            const ty = targetVec.dy / targetVec.distance;
            const dot = ax * tx + ay * ty;

            if (dot >= 0.82) {
                onboardingProgress.gadgetAimed = true;
                onboardingProgress.gadgetUsed = true;
                onboardingTargetBotState.hp = Math.max(0, onboardingTargetBotState.hp - 35);
                if (onboardingTargetBotState.hp <= 0) onboardingTargetBotState.hp = onboardingTargetBotState.maxHp;
            } else {
                onboardingProgress.gadgetUsed = true;
            }

            renderOnboardingStep();
            renderOnboardingArena();
            return dot >= 0.82;
        }

        function renderOnboardingArena() {
            const arenaEl = document.getElementById('onboarding-arena');
            const playerEl = document.getElementById('onboarding-player');
            const playerImgEl = document.getElementById('onboarding-player-img');
            const targetBotImgEl = document.getElementById('onboarding-target-bot-img');
            const targetBotHpFillEl = document.getElementById('onboarding-target-bot-hp-fill');
            if (!arenaEl || !playerEl || !playerImgEl) return;

            const pd = getOnboardingCharacterData();
            const imgSrc = pd ? (pd.img || 'images/ScorpiosSouvlak.png') : 'images/ScorpiosSouvlak.png';
            playerImgEl.onerror = () => {
                if (playerImgEl.getAttribute('src') !== 'images/ScorpiosSouvlak.png') {
                    playerImgEl.setAttribute('src', 'images/ScorpiosSouvlak.png');
                }
            };
            if (playerImgEl.getAttribute('src') !== imgSrc) playerImgEl.setAttribute('src', imgSrc);
            if (targetBotImgEl && targetBotImgEl.getAttribute('src') !== ONBOARDING_TARGET_BOT_IMAGE) {
                targetBotImgEl.setAttribute('src', ONBOARDING_TARGET_BOT_IMAGE);
            }
            if (targetBotHpFillEl) {
                const hpPct = Math.max(0, Math.min(100, (onboardingTargetBotState.hp / onboardingTargetBotState.maxHp) * 100));
                targetBotHpFillEl.style.width = `${hpPct}%`;
            }

            clampOnboardingPlayer();
            playerEl.style.left = `${onboardingArena.x}px`;
            playerEl.style.top = `${onboardingArena.y}px`;
            playerEl.style.transform = 'translate(-50%, -50%)';
        }

        function moveOnboardingPlayer(nx, ny) {
            if (!isOnboardingActive()) return;
            const magnitude = Math.hypot(nx, ny);
            if (magnitude < 0.1) return;
            const speed = 4;
            onboardingArena.x += (nx / magnitude) * speed;
            onboardingArena.y += (ny / magnitude) * speed;
            if (!onboardingProgress.moved && onboardingStepIndex === 0) onboardingProgress.moved = true;
            renderOnboardingArena();
            if (onboardingStepIndex <= 1) renderOnboardingStep();
        }

        function aimOnboardingPlayer(nx, ny) {
            if (!isOnboardingActive()) return;
            const magnitude = Math.hypot(nx, ny);
            if (magnitude < 0.08) return;
            onboardingArena.aimX = nx / magnitude;
            onboardingArena.aimY = ny / magnitude;
            if (!onboardingProgress.aimed && onboardingStepIndex === 1) onboardingProgress.aimed = true;
            renderOnboardingArena();
            if (onboardingStepIndex === 1) renderOnboardingStep();
        }

        function resetOnboardingProgress() {
            onboardingProgress = {
                moved: false,
                aimed: false,
                shot: false,
                superAimed: false,
                superUsed: false,
                gadgetAimed: false,
                gadgetUsed: false,
                itemUsed: false
            };
            resetOnboardingTargetBot();
            resetOnboardingArena();
        }

        function isOnboardingStepComplete(stepIndex) {
            if (stepIndex === 0) return onboardingProgress.moved;
            if (stepIndex === 1) return onboardingProgress.shot;
            if (stepIndex === 2) return onboardingProgress.superUsed;
            if (stepIndex === 3) return onboardingProgress.gadgetUsed;
            return true;
        }

        function getOnboardingObjectiveText(stepIndex) {
            if (stepIndex === 0) {
                return `${onboardingProgress.moved ? 'âœ…' : 'â¬œ'} Move`;
            }
            if (stepIndex === 1) {
                return `${onboardingProgress.shot ? 'âœ…' : 'â¬œ'} Shoot once`;
            }
            if (stepIndex === 2) {
                return `${onboardingProgress.superUsed ? 'âœ…' : 'â¬œ'} Use Super once`;
            }
            if (stepIndex === 3) {
                return `${onboardingProgress.gadgetUsed ? 'âœ…' : 'â¬œ'} Use Gadget once`;
            }
            return 'âœ… You are ready. Start your first battle!';
        }

        function getOnboardingContextHint(stepIndex) {
            if (stepIndex === 0) {
                return onboardingProgress.moved
                    ? 'Nice movement. Keep strafing to avoid shots.'
                    : 'Tip: hold a direction for a full second.';
            }
            if (stepIndex === 1) {
                if (!onboardingProgress.aimed) return 'Aim at the bot first, then shoot.';
                if (!onboardingProgress.shot) return 'You are aiming correctly. Fire now.';
                return 'Great shot. Keep distance while attacking.';
            }
            if (stepIndex === 2) {
                return onboardingProgress.superUsed
                    ? 'Super used perfectly.'
                    : 'Use Super when enemies are in front of you.';
            }
            if (stepIndex === 3) {
                const hpPct = Math.round((onboardingTargetBotState.hp / onboardingTargetBotState.maxHp) * 100);
                if (!onboardingProgress.gadgetUsed) return `Try gadget now. Bot HP: ${hpPct}%`;
                return 'Nice gadget timing.';
            }
            return 'You are ready. The next click starts a real battle.';
        }

        const TUTORIAL_REWARD_COINS = 140;
        const TUTORIAL_REWARD_SPARKS = 220;

        function getTutorialRewardClaimKey() {
            const profile = getCurrentProfile();
            const tag = profile?.username ? normalizeUsername(profile.username) : 'guest';
            return `tutorialRewardClaimed_${tag}`;
        }

        function grantTutorialCompletionRewardOnce() {
            const rewardKey = getTutorialRewardClaimKey();
            if (storageGetItem(rewardKey) === 'true') return false;
            playerCoins += TUTORIAL_REWARD_COINS;
            energySparks += TUTORIAL_REWARD_SPARKS;
            storageSetItem(rewardKey, 'true');
            saveProgress();
            showCoins();
            return true;
        }

        function queueOnboardingAutoAdvance() {
            if (!isOnboardingActive()) return;
            if (!isOnboardingStepComplete(onboardingStepIndex)) return;
            if (onboardingAutoAdvanceTimer) clearTimeout(onboardingAutoAdvanceTimer);

            const startStep = onboardingStepIndex;
            const isLast = onboardingStepIndex >= ONBOARDING_STEPS.length - 1;
            const delay = isLast ? 900 : 550;

            onboardingAutoAdvanceTimer = setTimeout(() => {
                onboardingAutoAdvanceTimer = null;
                if (!isOnboardingActive()) return;
                if (onboardingStepIndex !== startStep) return;
                if (!isOnboardingStepComplete(onboardingStepIndex)) return;

                if (isLast) {
                    finishOnboarding(true);
                    return;
                }

                onboardingStepIndex = Math.min(ONBOARDING_STEPS.length - 1, onboardingStepIndex + 1);
                renderOnboardingStep();
            }, delay);
        }

        function isOnboardingActive() {
            const overlay = document.getElementById('onboarding-overlay');
            return !!overlay && overlay.style.display === 'flex';
        }

        function syncOnboardingJoysticks() {
            const moveJoy = document.getElementById('joystick-container');
            const shootJoy = document.getElementById('shoot-joystick-container');
            const superBtnContainer = document.getElementById('super-btn-container');
            const gadgetBtnContainer = document.getElementById('gadget-btn-container');
            const body = document.body;
            const ghostClasses = ['onboarding-ghost-move', 'onboarding-ghost-aim', 'onboarding-ghost-super', 'onboarding-ghost-gadget'];
            ghostClasses.forEach(c => body.classList.remove(c));
            if (!moveJoy || !shootJoy) return;

            if (!isOnboardingActive()) {
                if (!gameStarted) {
                    moveJoy.style.setProperty('display', 'none', 'important');
                    shootJoy.style.setProperty('display', 'none', 'important');
                }
                if (superBtnContainer) superBtnContainer.style.removeProperty('display');
                if (gadgetBtnContainer) gadgetBtnContainer.style.removeProperty('display');
                moveJoy.style.removeProperty('z-index');
                shootJoy.style.removeProperty('z-index');
                if (superBtnContainer) superBtnContainer.style.removeProperty('z-index');
                if (gadgetBtnContainer) gadgetBtnContainer.style.removeProperty('z-index');
                return;
            }

            // Step 1: only movement joystick.
            if (onboardingStepIndex === 0) {
                moveJoy.style.setProperty('display', 'block', 'important');
                shootJoy.style.setProperty('display', 'none', 'important');
                if (superBtnContainer) superBtnContainer.style.setProperty('display', 'none', 'important');
                if (gadgetBtnContainer) gadgetBtnContainer.style.setProperty('display', 'none', 'important');
                body.classList.add('onboarding-ghost-move');
                return;
            }

            // Step 2+: movement + aiming joystick.
            moveJoy.style.setProperty('display', 'block', 'important');
            shootJoy.style.setProperty('display', 'block', 'important');
            moveJoy.style.setProperty('z-index', '2200', 'important');
            shootJoy.style.setProperty('z-index', '2200', 'important');
            if (onboardingStepIndex === 1) body.classList.add('onboarding-ghost-aim');

            if (superBtnContainer) {
                const showSuper = onboardingStepIndex === 2;
                superBtnContainer.style.setProperty('display', showSuper ? 'block' : 'none', 'important');
                superBtnContainer.style.setProperty('z-index', '2200', 'important');
                if (showSuper) body.classList.add('onboarding-ghost-super');
            }
            if (gadgetBtnContainer) {
                const showGadget = onboardingStepIndex === 3;
                gadgetBtnContainer.style.setProperty('display', showGadget ? 'block' : 'none', 'important');
                gadgetBtnContainer.style.setProperty('z-index', '2200', 'important');
                if (showGadget) body.classList.add('onboarding-ghost-gadget');
            }
        }

        function renderOnboardingPractice(stepIndex) {
            return;
        }

        function renderOnboardingStep() {
            const overlay = document.getElementById('onboarding-overlay');
            if (!overlay) return;
            const step = ONBOARDING_STEPS[Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, onboardingStepIndex))];
            const titleEl = document.getElementById('onboarding-title');
            const bodyEl = document.getElementById('onboarding-body');
            const hintEl = document.getElementById('onboarding-hint');
            const stepEl = document.getElementById('onboarding-step');
            const dotsEl = document.getElementById('onboarding-dots');
            const objectiveEl = document.getElementById('onboarding-objective');

            if (!titleEl || !bodyEl || !hintEl || !stepEl || !dotsEl || !objectiveEl) return;

            titleEl.textContent = step.title;
            bodyEl.textContent = step.body;
            hintEl.textContent = `${step.hint} ${getOnboardingContextHint(onboardingStepIndex)}`;
            stepEl.textContent = `Step ${onboardingStepIndex + 1}/${ONBOARDING_STEPS.length}`;
            objectiveEl.textContent = `${step.objective}  ${getOnboardingObjectiveText(onboardingStepIndex)}`;

            dotsEl.innerHTML = ONBOARDING_STEPS.map((_, i) => `<span class="onboarding-dot${i === onboardingStepIndex ? ' active' : ''}"></span>`).join('');
            renderOnboardingPractice(onboardingStepIndex);
            syncOnboardingJoysticks();
            renderOnboardingArena();
            queueOnboardingAutoAdvance();
        }

        function finishOnboarding(markSeen = true) {
            const overlay = document.getElementById('onboarding-overlay');
            if (overlay) overlay.style.display = 'none';
            if (onboardingAutoAdvanceTimer) {
                clearTimeout(onboardingAutoAdvanceTimer);
                onboardingAutoAdvanceTimer = null;
            }
            if (markSeen) storageSetItem('tutorialSeen', 'true');
            syncOnboardingJoysticks();
            showAllUI();
            updateCharShowcase();
            renderDailyWinsWidget();
            if (markSeen) {
                const rewarded = grantTutorialCompletionRewardOnce();
                if (rewarded) {
                    openTutorialRewardFlow();
                } else {
                    openTutorialCheckFlow();
                }
            }
        }

        function startOnboardingFlow() {
            const overlay = document.getElementById('onboarding-overlay');
            if (!overlay) {
                showAllUI();
                updateCharShowcase();
                renderDailyWinsWidget();
                storageSetItem('tutorialSeen', 'true');
                return;
            }
            onboardingStepIndex = 0;
            resetOnboardingProgress();
            hideAllUI();
            overlay.style.display = 'flex';
            renderOnboardingStep();
            syncOnboardingJoysticks();
        }

        function ensureMainMenuVisible() {
            const expOverlay = document.getElementById('experience-overlay');
            const overlay = document.getElementById('onboarding-overlay');
            const menuEl = document.querySelector('.menu');
            const isExperienceVisible = !!expOverlay && expOverlay.style.display === 'flex';
            const isOnboardingVisible = !!overlay && overlay.style.display === 'flex';
            const isMenuHidden = !menuEl || getComputedStyle(menuEl).display === 'none';
            if (!isExperienceVisible && !isOnboardingVisible && isMenuHidden && !gameStarted) {
                showAllUI();
                updateCharShowcase();
                renderDailyWinsWidget();
            }
        }

        function openExperienceChoiceFlow() {
            const expOverlay = document.getElementById('experience-overlay');
            if (!expOverlay) {
                showAllUI();
                return;
            }
            hideAllUI();
            expOverlay.style.display = 'flex';
        }

        function closeExperienceChoiceFlow() {
            const expOverlay = document.getElementById('experience-overlay');
            if (expOverlay) expOverlay.style.display = 'none';
        }

        function openTutorialCheckFlow() {
            const overlay = document.getElementById('tutorial-check-overlay');
            if (!overlay) return;
            overlay.style.display = 'flex';
        }

        function closeTutorialCheckFlow() {
            const overlay = document.getElementById('tutorial-check-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        function openTutorialRewardFlow() {
            const overlay = document.getElementById('tutorial-reward-overlay');
            const textEl = document.getElementById('tutorial-reward-text');
            if (!overlay) {
                openTutorialCheckFlow();
                return;
            }
            if (textEl) textEl.textContent = `You earned +${TUTORIAL_REWARD_COINS} coins and +${TUTORIAL_REWARD_SPARKS} sparks.`;
            overlay.style.display = 'flex';
        }

        function closeTutorialRewardFlow() {
            const overlay = document.getElementById('tutorial-reward-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        function initTutorialRewardFlow() {
            const overlay = document.getElementById('tutorial-reward-overlay');
            const continueBtn = document.getElementById('tutorial-reward-continue-btn');
            if (!overlay || !continueBtn) return;
            if (overlay.dataset.bound === '1') return;

            continueBtn.addEventListener('click', () => {
                closeTutorialRewardFlow();
                openTutorialCheckFlow();
            });

            overlay.dataset.bound = '1';
        }

        function initTutorialCheckFlow() {
            const overlay = document.getElementById('tutorial-check-overlay');
            const yesBtn = document.getElementById('tutorial-check-yes-btn');
            const noBtn = document.getElementById('tutorial-check-no-btn');
            if (!overlay || !yesBtn || !noBtn) return;
            if (overlay.dataset.bound === '1') return;

            yesBtn.addEventListener('click', () => {
                closeTutorialCheckFlow();
                forceEasyIntroBattle = true;
                if (!gameStarted) startGame();
            });

            noBtn.addEventListener('click', () => {
                closeTutorialCheckFlow();
                if (!gameStarted) startOnboardingFlow();
            });

            overlay.dataset.bound = '1';
        }

        function initExperienceChoiceFlow() {
            const expOverlay = document.getElementById('experience-overlay');
            const newBtn = document.getElementById('experience-new-btn');
            const returningBtn = document.getElementById('experience-returning-btn');
            if (!expOverlay || !newBtn || !returningBtn) return;
            if (expOverlay.dataset.bound === '1') return;

            newBtn.addEventListener('click', () => {
                storageSetItem('experienceChoice', 'new');
                storageRemoveItem('tutorialSeen');
                closeExperienceChoiceFlow();
                if (!gameStarted) startOnboardingFlow();
            });

            returningBtn.addEventListener('click', () => {
                storageSetItem('experienceChoice', 'returning');
                storageSetItem('tutorialSeen', 'true');
                closeExperienceChoiceFlow();
                showAllUI();
                updateCharShowcase();
                renderDailyWinsWidget();
            });

            expOverlay.dataset.bound = '1';
        }

        function initOnboardingFlow() {
            const overlay = document.getElementById('onboarding-overlay');
            const arena = document.getElementById('onboarding-arena');
            if (!overlay || !arena) return;
            if (overlay.dataset.bound === '1') return;

            const onboardingActive = () => overlay.style.display === 'flex';

            document.addEventListener('keydown', (e) => {
                if (!onboardingActive()) return;
                const code = e.code || '';
                if (onboardingStepIndex === 0) {
                    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(code)) {
                        const moveKeyVec = {
                            KeyW: [0, -1], ArrowUp: [0, -1],
                            KeyS: [0, 1], ArrowDown: [0, 1],
                            KeyA: [-1, 0], ArrowLeft: [-1, 0],
                            KeyD: [1, 0], ArrowRight: [1, 0]
                        };
                        const v = moveKeyVec[code] || [0, 0];
                        moveOnboardingPlayer(v[0], v[1]);
                        onboardingProgress.moved = true;
                        renderOnboardingStep();
                    }
                }
                if (onboardingStepIndex === 2 && code === 'KeyE') {
                    attemptOnboardingSuper(onboardingArena.aimX, onboardingArena.aimY);
                    renderOnboardingStep();
                }
                if (onboardingStepIndex === 3 && (code === 'Space' || code === 'KeyQ')) {
                    attemptOnboardingGadget(onboardingArena.aimX, onboardingArena.aimY);
                    renderOnboardingStep();
                }
            });

            overlay.addEventListener('mousemove', (e) => {
                if (!onboardingActive() || (onboardingStepIndex !== 1 && onboardingStepIndex !== 2 && onboardingStepIndex !== 3)) return;
                const arenaEl = document.getElementById('onboarding-arena');
                if (!arenaEl) return;
                const r = arenaEl.getBoundingClientRect();
                const dx = e.clientX - (r.left + onboardingArena.x);
                const dy = e.clientY - (r.top + onboardingArena.y);
                if (!onboardingProgress.aimed) {
                    onboardingProgress.aimed = true;
                    renderOnboardingStep();
                }
                aimOnboardingPlayer(dx, dy);
            });

            overlay.addEventListener('touchmove', (e) => {
                if (!onboardingActive() || (onboardingStepIndex !== 1 && onboardingStepIndex !== 2 && onboardingStepIndex !== 3)) return;
                const arenaEl = document.getElementById('onboarding-arena');
                if (!arenaEl || !e.touches || e.touches.length === 0) return;
                const t = e.touches[0];
                const r = arenaEl.getBoundingClientRect();
                const dx = t.clientX - (r.left + onboardingArena.x);
                const dy = t.clientY - (r.top + onboardingArena.y);
                if (!onboardingProgress.aimed) {
                    onboardingProgress.aimed = true;
                    renderOnboardingStep();
                }
                aimOnboardingPlayer(dx, dy);
            }, { passive: true });

            arena.addEventListener('mousedown', (e) => {
                if (!onboardingActive() || (onboardingStepIndex !== 1 && onboardingStepIndex !== 2 && onboardingStepIndex !== 3)) return;
                const r = arena.getBoundingClientRect();
                const dx = e.clientX - (r.left + onboardingArena.x);
                const dy = e.clientY - (r.top + onboardingArena.y);
                aimOnboardingPlayer(dx, dy);
                if (onboardingStepIndex === 1) attemptOnboardingAttack(dx, dy);
                if (onboardingStepIndex === 2) attemptOnboardingSuper(dx, dy);
                if (onboardingStepIndex === 3) attemptOnboardingGadget(dx, dy);
            });

            arena.addEventListener('touchstart', (e) => {
                if (!onboardingActive() || (onboardingStepIndex !== 1 && onboardingStepIndex !== 2 && onboardingStepIndex !== 3)) return;
                if (!e.touches || e.touches.length === 0) return;
                const t = e.touches[0];
                const r = arena.getBoundingClientRect();
                const dx = t.clientX - (r.left + onboardingArena.x);
                const dy = t.clientY - (r.top + onboardingArena.y);
                aimOnboardingPlayer(dx, dy);
                if (onboardingStepIndex === 1) attemptOnboardingAttack(dx, dy);
                if (onboardingStepIndex === 2) attemptOnboardingSuper(dx, dy);
                if (onboardingStepIndex === 3) attemptOnboardingGadget(dx, dy);
            }, { passive: true });

            overlay.dataset.bound = '1';
        }

        function openTutorial() {
            renderTutorial();
            document.getElementById('tutorial-panel').style.display = 'block';
        }

        function renderTutorial() {
            const content = document.getElementById('tutorial-content');
            content.innerHTML = GAME_TIPS.map(tip => `
                <div style="margin-bottom:14px; padding:10px; background:rgba(68,204,255,0.08); border-left:3px solid #44ccff; border-radius:6px;">
                    <div style="font-weight:bold; color:#44ccff; font-size:14px; margin-bottom:6px;">${tip.title}</div>
                    <div style="color:#bbb; font-size:13px; line-height:1.5;">${tip.text}</div>
                </div>
            `).join('');
        }

        // â”€â”€ LEADERBOARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        function getLeaderboardStats(accountKey) {
            // Load account data
            const store = getAccountsStore();
            const account = store[accountKey];
            if (!account) return null;

            // Load this account's own match history.
            const accountMatches = loadMatchHistory(accountKey);
            
            const totalMatches = accountMatches.length;
            const wins = accountMatches.filter(h => h.result === 'win').length;
            const totalKills = accountMatches.reduce((sum, h) => sum + (h.kills || 0), 0);
            const winrate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

            return {
                username: account.profile?.username || 'Unknown',
                wins,
                totalMatches,
                totalKills,
                winrate,
                avatar: account.profile?.avatarIcon || 'ðŸ‘¤',
            };
        }

        function openMedalRoad() {
            renderMedalRoad();
            document.getElementById('medal-road-panel').style.display = 'block';
        }

        let medalRoadLastClaimText = '';
        let medalRoadLastClaimColor = '#c9e9ff';

        function setMedalRoadClaimStatus(text, color = '#c9e9ff') {
            medalRoadLastClaimText = String(text || '');
            medalRoadLastClaimColor = color;
            const el = document.getElementById('medal-road-claim-status');
            if (!el) return;
            el.style.color = medalRoadLastClaimColor;
            el.textContent = medalRoadLastClaimText;
        }

        function renderMedalRoad() {
            document.getElementById('medal-road-level').textContent = playerLevel;
            const timeline = document.getElementById('medal-road-timeline');

            const nextUnclaimed = levelRewards.find(r => !r.claimed) || null;
            const nextIdx = nextUnclaimed ? levelRewards.findIndex(r => r.level === nextUnclaimed.level) : levelRewards.length - 1;
            const nextTargetMedals = nextUnclaimed ? (nextUnclaimed.level - 1) * 10 : MEDAL_ROAD_MAX_MEDALS;
            const prevTargetMedals = nextUnclaimed ? Math.max(0, nextTargetMedals - 10) : Math.max(0, MEDAL_ROAD_MAX_MEDALS - 10);
            const segmentProgress = nextUnclaimed
                ? Math.max(0, Math.min(1, (playerMedals - prevTargetMedals) / Math.max(1, nextTargetMedals - prevTargetMedals)))
                : 1;

            const startIdx = Math.max(0, nextIdx - 14);
            const endIdx = Math.min(levelRewards.length, nextIdx + 56);
            const visible = levelRewards.slice(startIdx, endIdx);
            const nextRewardLabel = nextUnclaimed ? (nextUnclaimed.reward || getRoadRewardValueText(nextUnclaimed)) : 'All rewards claimed';
            const nextRewardNeed = Math.max(0, nextTargetMedals - playerMedals);

            const cardsHtml = visible.map((reward, localIndex) => {
                const rewardNeed = (reward.level - 1) * 10;
                const isClaimed = reward.claimed;
                const isReady = !isClaimed && playerLevel >= reward.level;
                const isNext = !!nextUnclaimed && reward.level === nextUnclaimed.level;
                const rewardPlayer = reward.type === 'unlock' && playersData[reward.playerId]
                    ? playersData[reward.playerId]
                    : null;
                const rarityText = rewardPlayer
                    ? (rewardPlayer.rarity === 'epic' ? 'SUPER RARE' : (rarityLabels[rewardPlayer.rarity] || rewardPlayer.rarity).toUpperCase())
                    : (reward.type === 'chest' ? `${(reward.chestTier || 'small').toUpperCase()} CHEST` : reward.type.toUpperCase());
                const statusText = isClaimed ? 'CLAIMED' : isReady ? 'READY' : isNext ? 'NEXT' : `${Math.max(0, rewardNeed - playerMedals)} LEFT`;
                const iconHtml = rewardPlayer
                    ? `<img class="medal-road-bs-hero" src="${rewardPlayer.icon || rewardPlayer.img || ''}" alt="${rewardPlayer.name}">`
                    : `<div class="medal-road-bs-icon">${reward.icon || 'ðŸŽ'}</div>`;
                const clickHandler = isReady ? ` onclick="claimMedalRoadRewardByLevel(${reward.level})"` : '';

                return `
                    <article class="medal-road-bs-card ${isClaimed ? 'claimed' : isReady ? 'ready' : 'locked'}${isNext ? ' next' : ''}"${clickHandler}>
                        <div class="medal-road-bs-level">LV ${reward.level}</div>
                        <div class="medal-road-bs-medals">${rewardNeed} medals</div>
                        <div class="medal-road-bs-media">${iconHtml}</div>
                        <div class="medal-road-bs-name">${rewardPlayer ? rewardPlayer.name : (reward.reward || getRoadRewardValueText(reward))}</div>
                        <div class="medal-road-bs-rarity">${rarityText}</div>
                        <div class="medal-road-bs-status">${statusText}</div>
                    </article>
                    ${localIndex < visible.length - 1 ? '<div class="medal-road-bs-link"></div>' : ''}
                `;
            }).join('');

            timeline.innerHTML = `
                <section class="medal-road-bs-summary">
                    <div class="medal-road-bs-summary-left">
                        <div class="medal-road-bs-summary-label">Next Reward</div>
                        <div class="medal-road-bs-summary-title">${nextRewardLabel}</div>
                        <div class="medal-road-bs-summary-sub">${nextUnclaimed ? `${nextTargetMedals} medals target` : 'Road complete'}</div>
                    </div>
                    <div class="medal-road-bs-summary-right">
                        <div>${nextUnclaimed ? `${nextRewardNeed} medals left` : 'Completed'}</div>
                        <div>${levelRewards.filter(r => r.claimed).length}/${levelRewards.length} claimed</div>
                    </div>
                    <div class="medal-road-bs-progress"><div class="medal-road-bs-progress-fill" style="width:${Math.round(segmentProgress * 100)}%"></div></div>
                    <div id="medal-road-claim-status" class="medal-road-bs-claim-status" style="color:${medalRoadLastClaimColor};">${medalRoadLastClaimText || 'Click READY rewards to claim.'}</div>
                </section>
                <section class="medal-road-bs-shell">
                    <div class="medal-road-bs-track">${cardsHtml}</div>
                </section>
            `;
        }

        // â”€â”€ UI Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        const MEDAL_ROAD_MAX_MEDALS = 5000;
        const MEDAL_ROAD_MAX_LEVEL = Math.floor(MEDAL_ROAD_MAX_MEDALS / 10) + 1;
        const MEDAL_ROAD_SUPER_RARE_RARITIES = new Set(['epic']);
        const MEDAL_ROAD_COSMETIC_COLORS = [
            { name: 'Red', color: '#ff4444' },
            { name: 'Cyan', color: '#44ffff' },
            { name: 'Lime', color: '#44ff44' },
            { name: 'Pink', color: '#ff66cc' },
            { name: 'Orange', color: '#ff8833' },
            { name: 'Gold', color: '#ffcc00' },
            { name: 'Purple', color: '#bb66ff' },
            { name: 'Ice Blue', color: '#66ccff' }
        ];
        const MEDAL_ROAD_SMALL_CHEST_POOL = [
            { type: 'coins', weight: 42, min: 180, max: 320 },
            { type: 'sparks', weight: 33, min: 40, max: 95 },
            { type: 'credits', weight: 18, min: 10, max: 28 },
            { type: 'unlockRare', weight: 5 },
            { type: 'gadget', weight: 1 },
            { type: 'killfeedcolor', weight: 1 }
        ];
        const MEDAL_ROAD_BIG_CHEST_POOL = [
            { type: 'coins', weight: 32, min: 350, max: 620 },
            { type: 'sparks', weight: 27, min: 90, max: 170 },
            { type: 'credits', weight: 22, min: 24, max: 56 },
            { type: 'unlockRare', weight: 9 },
            { type: 'unlockSuperRare', weight: 6 },
            { type: 'gadget', weight: 2 },
            { type: 'killfeedcolor', weight: 2 }
        ];
        const MEDAL_ROAD_MEGA_CHEST_POOL = [
            { type: 'coins', weight: 22, min: 700, max: 1200 },
            { type: 'sparks', weight: 22, min: 170, max: 290 },
            { type: 'credits', weight: 22, min: 60, max: 125 },
            { type: 'unlockRare', weight: 12 },
            { type: 'unlockSuperRare', weight: 14 },
            { type: 'gadget', weight: 5 },
            { type: 'killfeedcolor', weight: 3 }
        ];

        function getRoadRewardValueText(reward) {
            if (!reward) return '';
            if (reward.type === 'unlock') {
                return playersData[reward.playerId]?.name || 'Hero';
            }
            if (reward.type === 'chest') {
                if (reward.chestTier === 'mega') return 'Mega Chest';
                if (reward.chestTier === 'big') return 'Big Chest';
                return 'Small Chest';
            }
            return String(reward.amount || reward.reward || '');
        }

        function getMedalRoadUnlockPools() {
            const rarityRank = { common: 0, rare: 1, epic: 2, mythic: 3, legendary: 4 };
            const players = Object.values(playersData)
                .filter(p => p && p.id && p.id !== 'default');
            const rare = players
                .filter(p => p.rarity === 'rare')
                .sort((a, b) => (rarityRank[a.rarity] - rarityRank[b.rarity]) || a.name.localeCompare(b.name))
                .map(p => p.id);
            const superRare = players
                .filter(p => MEDAL_ROAD_SUPER_RARE_RARITIES.has(p.rarity))
                .sort((a, b) => (rarityRank[a.rarity] - rarityRank[b.rarity]) || a.name.localeCompare(b.name))
                .map(p => p.id);
            return { rare, superRare };
        }

        function getChestRewardPoolByTier(tier) {
            if (tier === 'mega') return MEDAL_ROAD_MEGA_CHEST_POOL;
            if (tier === 'big') return MEDAL_ROAD_BIG_CHEST_POOL;
            return MEDAL_ROAD_SMALL_CHEST_POOL;
        }

        function buildMedalRoadRewards() {
            const rewards = [];
            const unlockPools = getMedalRoadUnlockPools();
            const rareUnlocks = [...unlockPools.rare];
            const superRareUnlocks = [...unlockPools.superRare];

            for (let level = 3; level <= MEDAL_ROAD_MAX_LEVEL; level++) {
                const medalsTarget = (level - 1) * 10;
                const phase = medalsTarget <= 1200 ? 1 : medalsTarget <= 3000 ? 2 : 3;

                if (rareUnlocks.length > 0 && (level === 5 || (phase <= 2 && level % 18 === 0))) {
                    const playerId = rareUnlocks.shift();
                    rewards.push({
                        level,
                        type: 'unlock',
                        playerId,
                        icon: 'ðŸ”“',
                        reward: `Unlock ${playersData[playerId]?.name || 'Rare Hero'} (Rare)`,
                        claimed: false
                    });
                    continue;
                }

                if (superRareUnlocks.length > 0 && medalsTarget >= 900 && (level % 25 === 0 || level % 33 === 0)) {
                    const playerId = superRareUnlocks.shift();
                    rewards.push({
                        level,
                        type: 'unlock',
                        playerId,
                        icon: 'ðŸŒŸ',
                        reward: `Unlock ${playersData[playerId]?.name || 'Super Rare Hero'} (Super Rare)`,
                        claimed: false
                    });
                    continue;
                }

                if (level % 25 === 0) {
                    rewards.push({ level, type: 'chest', chestTier: 'mega', icon: 'ðŸ§°', reward: 'Mega chest drop', claimed: false });
                    continue;
                }

                if (level % 10 === 0) {
                    rewards.push({ level, type: 'chest', chestTier: 'big', icon: 'ðŸ“¦', reward: 'Big chest drop', claimed: false });
                    continue;
                }

                if (level % 5 === 0) {
                    rewards.push({ level, type: 'chest', chestTier: 'small', icon: 'ðŸŽ', reward: 'Small chest drop', claimed: false });
                    continue;
                }

                if (level % 4 === 0) {
                    const amount = phase === 1 ? 8 + Math.floor(level / 8) : phase === 2 ? 16 + Math.floor(level / 10) : 28 + Math.floor(level / 12);
                    rewards.push({ level, type: 'credits', amount, icon: 'ðŸŽ–ï¸', reward: `${amount} unlock tokens`, claimed: false });
                    continue;
                }

                if (level % 3 === 0) {
                    const amount = phase === 1 ? 90 + level * 5 : phase === 2 ? 260 + level * 4 : 580 + level * 3;
                    rewards.push({ level, type: 'sparks', amount, icon: 'âš¡', reward: `${amount} energy sparks`, claimed: false });
                    continue;
                }

                const coins = phase === 1 ? 120 + level * 8 : phase === 2 ? 360 + level * 6 : 760 + level * 5;
                rewards.push({ level, type: 'coins', amount: coins, icon: 'ðŸ’°', reward: `${coins} coins`, claimed: false });
            }

            const coveredUnlockIds = new Set(rewards.filter(r => r.type === 'unlock' && r.playerId).map(r => r.playerId));
            const missingRare = unlockPools.rare.filter(id => !coveredUnlockIds.has(id));
            const missingSuperRare = unlockPools.superRare.filter(id => !coveredUnlockIds.has(id));
            const missingUnlocks = [...missingRare, ...missingSuperRare];

            if (missingUnlocks.length > 0) {
                const replaceCandidates = rewards
                    .map((reward, idx) => ({ reward, idx }))
                    .filter(({ reward }) => reward.type !== 'unlock' && reward.type !== 'chest');

                let cursor = Math.max(0, replaceCandidates.length - 1);
                for (const playerId of missingUnlocks) {
                    if (cursor < 0) break;
                    const target = replaceCandidates[cursor--];
                    if (!target) break;
                    const rarity = playersData[playerId]?.rarity || 'rare';
                    const rarityLabel = rarity === 'epic' ? 'Super Rare' : (rarityLabels[rarity] || 'Rare');
                    rewards[target.idx] = {
                        level: target.reward.level,
                        type: 'unlock',
                        playerId,
                        icon: rarity === 'epic' ? 'ðŸŒŸ' : 'ðŸ”“',
                        reward: `Unlock ${playersData[playerId]?.name || 'Hero'} (${rarityLabel})`,
                        claimed: false
                    };
                }
            }

            return rewards;
        }

        const levelRewards = buildMedalRoadRewards();
        // Restore claimed state from localStorage
        const _claimedLevels = readStorageJson('claimedLevelRewards', []);
        for (const _m of levelRewards) { if (_claimedLevels.includes(_m.level)) _m.claimed = true; }

        function pickWeighted(pool) {
            const validPool = Array.isArray(pool) ? pool.filter(e => e && toSafeInt(e.weight) > 0) : [];
            if (validPool.length === 0) return null;
            const totalWeight = validPool.reduce((sum, entry) => sum + toSafeInt(entry.weight), 0);
            let roll = Math.random() * totalWeight;
            for (const entry of validPool) {
                roll -= toSafeInt(entry.weight);
                if (roll <= 0) return entry;
            }
            return validPool[validPool.length - 1];
        }

        function randRangeInt(min, max) {
            const a = Math.min(toSafeInt(min), toSafeInt(max));
            const b = Math.max(toSafeInt(min), toSafeInt(max));
            return a + Math.floor(Math.random() * (b - a + 1));
        }

        function getLockedNexusByRarity(raritySet) {
            const set = raritySet instanceof Set ? raritySet : new Set([raritySet]);
            return Object.values(playersData)
                .filter(p => p && p.id && p.id !== 'default' && set.has(p.rarity) && !unlockedNexus.includes(p.id))
                .map(p => p.id);
        }

        function unlockMedalRoadRarityThresholdRewards() {
            if (playerMedals < 1500) return false;

            const eligibleRarities = new Set(['rare', ...Array.from(MEDAL_ROAD_SUPER_RARE_RARITIES)]);
            let unlockedAny = false;

            Object.values(playersData).forEach((p) => {
                if (!p || !p.id || p.id === 'default') return;
                if (!eligibleRarities.has(p.rarity)) return;
                if (unlockedNexus.includes(p.id)) return;
                unlockedNexus.push(p.id);
                unlockedAny = true;
            });

            return unlockedAny;
        }

        function claimMedalRoadChest(tier) {
            const resolved = rollMedalRoadChestReward(tier);
            return applyMedalRoadChestReward(resolved);
        }

        function rollMedalRoadChestReward(tier) {
            const pool = getChestRewardPoolByTier(tier);
            const picked = pickWeighted(pool);
            if (!picked) {
                return { type: 'coins', amount: 100, icon: 'ðŸ’°', text: '+100 Coins' };
            }

            if (picked.type === 'coins') {
                const amount = randRangeInt(picked.min, picked.max);
                return { type: 'coins', amount, icon: 'ðŸ’°', text: `+${amount} Coins` };
            }

            if (picked.type === 'sparks') {
                const amount = randRangeInt(picked.min, picked.max);
                return { type: 'sparks', amount, icon: 'âš¡', text: `+${amount} Energy Sparks` };
            }

            if (picked.type === 'credits') {
                const amount = randRangeInt(picked.min, picked.max);
                return { type: 'credits', amount, icon: 'ðŸŽ–ï¸', text: `+${amount} Hero Marks` };
            }

            if (picked.type === 'gadget') {
                const gadgetKey = getRandomLockedGadgetKey();
                if (gadgetKey && gadgetData[gadgetKey]) {
                    return { type: 'gadget', gadgetKey, icon: 'ðŸ§°', text: `Unlocked gadget: ${gadgetData[gadgetKey].name}` };
                }
                return { type: 'credits', amount: 30, icon: 'ðŸŽ–ï¸', text: '+30 Hero Marks (duplicate protected)' };
            }

            if (picked.type === 'killfeedcolor') {
                const availableColors = MEDAL_ROAD_COSMETIC_COLORS.filter(c => c.color !== killFeedColor);
                if (availableColors.length > 0) {
                    const chosen = availableColors[Math.floor(Math.random() * availableColors.length)];
                    return { type: 'killfeedcolor', color: chosen.color, icon: 'ðŸŽ¨', text: `Kill feed color: ${chosen.name}` };
                }
                return { type: 'credits', amount: 25, icon: 'ðŸŽ–ï¸', text: '+25 Hero Marks (duplicate cosmetic)' };
            }

            if (picked.type === 'unlockRare') {
                const lockedRare = getLockedNexusByRarity(new Set(['rare']));
                if (lockedRare.length > 0) {
                    const playerId = lockedRare[Math.floor(Math.random() * lockedRare.length)];
                    return { type: 'unlock', playerId, icon: 'ðŸ”“', text: `Unlocked ${playersData[playerId]?.name || 'Rare Hero'} (Rare)` };
                }
                return { type: 'credits', amount: 60, icon: 'ðŸŽ–ï¸', text: '+60 Hero Marks (all Rare owned)' };
            }

            if (picked.type === 'unlockSuperRare') {
                const lockedSuperRare = getLockedNexusByRarity(MEDAL_ROAD_SUPER_RARE_RARITIES);
                if (lockedSuperRare.length > 0) {
                    const playerId = lockedSuperRare[Math.floor(Math.random() * lockedSuperRare.length)];
                    return { type: 'unlock', playerId, icon: 'ðŸŒŸ', text: `Unlocked ${playersData[playerId]?.name || 'Super Rare Hero'} (Super Rare)` };
                }
                return { type: 'credits', amount: 100, icon: 'ðŸŽ–ï¸', text: '+100 Hero Marks (all Super Rare owned)' };
            }

            return { type: 'coins', amount: 120, icon: 'ðŸ’°', text: '+120 Coins' };
        }

        function applyMedalRoadChestReward(reward) {
            if (!reward || typeof reward !== 'object') {
                playerCoins += 100;
                return { icon: 'ðŸ’°', text: '+100 Coins' };
            }

            if (reward.type === 'coins') {
                playerCoins += toSafeInt(reward.amount || 0);
            } else if (reward.type === 'sparks') {
                energySparks += toSafeInt(reward.amount || 0);
            } else if (reward.type === 'credits') {
                playerCredits += toSafeInt(reward.amount || 0);
            } else if (reward.type === 'killfeedcolor' && reward.color) {
                killFeedColor = reward.color;
            } else if (reward.type === 'gadget' && reward.gadgetKey) {
                unlockGadget(reward.gadgetKey);
            } else if (reward.type === 'unlock' && reward.playerId && !unlockedNexus.includes(reward.playerId)) {
                unlockedNexus.push(reward.playerId);
            }

            return {
                icon: reward.icon || 'ðŸŽ',
                text: reward.text || 'Chest reward claimed'
            };
        }

        function openMedalRoadChestRewardFlow(tier, onCollected) {
            const overlay = document.getElementById('stardrop-overlay');
            const box = document.getElementById('stardrop-box');
            const chest = document.getElementById('stardrop-chest');
            const rewardDiv = document.getElementById('stardrop-reward');
            const rewardText = document.getElementById('stardrop-reward-text');
            const collectBtn = document.getElementById('stardrop-collect');
            const titleEl = document.getElementById('stardrop-title');
            const rarityLabel = document.getElementById('stardrop-rarity-label');
            const clicksDiv = document.getElementById('stardrop-clicks');
            const hintEl = document.getElementById('stardrop-hint');

            const tierKey = String(tier || 'small').toLowerCase();
            const tierStyle = tierKey === 'mega'
                ? { name: 'Mega Chest', color: '#ff6bb5', glow: 'rgba(255,107,181,0.35)' }
                : tierKey === 'big'
                    ? { name: 'Big Chest', color: '#5fd8ff', glow: 'rgba(95,216,255,0.35)' }
                    : { name: 'Small Chest', color: '#ffcc66', glow: 'rgba(255,204,102,0.32)' };

            if (!overlay || !box || !chest || !rewardDiv || !rewardText || !collectBtn || !titleEl || !rarityLabel || !clicksDiv || !hintEl) {
                const fallbackSummary = claimMedalRoadChest(tierKey);
                if (typeof onCollected === 'function') onCollected(fallbackSummary);
                return;
            }

            let isOpened = false;
            const rolledReward = rollMedalRoadChestReward(tierKey);

            chest.src = 'images/chestclose.png';
            chest.style.transform = '';
            chest.style.pointerEvents = 'auto';
            rewardDiv.style.display = 'none';
            collectBtn.style.display = 'none';
            hintEl.style.display = 'block';
            hintEl.textContent = 'Tap chest to open';
            titleEl.textContent = 'Medal Road Chest';
            titleEl.style.color = tierStyle.color;
            rarityLabel.textContent = tierStyle.name;
            rarityLabel.style.color = tierStyle.color;
            clicksDiv.textContent = 'ðŸŽ';
            box.style.borderColor = tierStyle.color;
            box.style.boxShadow = `0 0 60px ${tierStyle.glow}, inset 0 0 30px ${tierStyle.glow}`;
            overlay.style.display = 'flex';

            overlay.onclick = (e) => {
                if (e.target === collectBtn) return;
                if (isOpened) return;
                isOpened = true;

                chest.style.pointerEvents = 'none';
                hintEl.style.display = 'none';
                chest.style.transform = 'scale(1.12)';

                setTimeout(() => {
                    chest.src = 'images/chestopen.png';
                    rewardText.textContent = `${rolledReward.icon || 'ðŸŽ'} ${rolledReward.text || 'Reward'}`;
                    rewardText.style.color = tierStyle.color;
                    rewardDiv.style.display = 'block';
                    collectBtn.style.display = 'inline-block';
                    collectBtn.textContent = 'Collect Reward';
                }, 280);
            };

            collectBtn.onclick = () => {
                const summary = applyMedalRoadChestReward(rolledReward);
                overlay.style.display = 'none';
                if (typeof onCollected === 'function') onCollected(summary);
            };
        }

        function claimMedalRoadRewardByLevel(level) {
            unlockMedalRoadRarityThresholdRewards();
            const milestone = levelRewards.find(r => r.level === toSafeInt(level));
            if (!milestone || milestone.claimed || playerLevel < milestone.level) {
                setMedalRoadClaimStatus('This reward is not ready yet.', '#ff9da0');
                return false;
            }

            milestone.claimed = true;
            let claimText = 'Reward claimed';
            if (milestone.type === 'sparks') {
                energySparks += milestone.amount;
                claimText = `âš¡ +${milestone.amount} Energy Sparks`;
            } else if (milestone.type === 'credits') {
                playerCredits += milestone.amount;
                claimText = `ðŸŽ–ï¸ +${milestone.amount} Hero Marks`;
            } else if (milestone.type === 'medals') {
                playerMedals = Math.max(0, playerMedals + milestone.amount);
                playerLevel = Math.floor(playerMedals / 10) + 1;
                claimText = `ðŸ… +${milestone.amount} Medals`;
            } else if (milestone.type === 'unlock') {
                if (!unlockedNexus.includes(milestone.playerId)) {
                    unlockedNexus.push(milestone.playerId);
                }
                claimText = `ðŸ”“ Unlocked ${playersData[milestone.playerId]?.name || 'Hero'}`;
            } else if (milestone.type === 'chest') {
                openMedalRoadChestRewardFlow(milestone.chestTier || 'small', (chestReward) => {
                    const chestText = chestReward ? `${chestReward.icon} ${chestReward.text}` : 'ðŸŽ Chest claimed';
                    setMedalRoadClaimStatus(chestText, '#7df7ab');
                    saveProgress();
                    showCoins();
                    renderMedalRoad();
                });
                setMedalRoadClaimStatus('Open the chest, then tap Collect Reward.', '#ffe07e');
                renderMedalRoad();
                return true;
            } else {
                playerCoins += milestone.amount;
                claimText = `ðŸ’° +${milestone.amount} Coins`;
            }

            setMedalRoadClaimStatus(claimText, '#7df7ab');
            saveProgress();
            showCoins();
            renderMedalRoad();
            return true;
        }

        function showCoins() {
            const medalsIntoLevel = playerMedals % 10;
            const medalsToNextLevel = Math.max(0, 10 - medalsIntoLevel);
            const unlockedByMedalThreshold = unlockMedalRoadRarityThresholdRewards();
            const unlockedByCredits = tryAutoUnlockCreditTier();
            document.getElementById('coins-display').innerHTML =
                `ðŸ’° Coins: ${playerCoins}<br>ðŸ… Medals: ${playerMedals} &nbsp;(Lv ${playerLevel})<br>ðŸ“ˆ Next Level: ${medalsToNextLevel} medals left<br>âš¡ Energy Sparks: ${energySparks}<br>ðŸŽ–ï¸ Hero Marks: ${playerCredits}`;
            // Keep account chip stats in sync
            updateAccountChip();
            const creditsPanel = document.getElementById('credits-panel');
            if ((creditsPanel && creditsPanel.style.display === 'block') || unlockedByCredits || unlockedByMedalThreshold) {
                renderCreditsPanel();
            }
        }

        function renderLevelRewards() {
            const list = document.getElementById('level-rewards-list');
            list.innerHTML = '';

            // Show a window around the current level: all unclaimed + last 2 claimed
            const claimed = levelRewards.filter(r => r.claimed);
            const unclaimed = levelRewards.filter(r => !r.claimed);
            const toShow = [...claimed.slice(-2), ...unclaimed.slice(0, 6)];

            if (toShow.length === 0) {
                list.innerHTML = '<p style="text-align:center;color:#aaa;">All rewards claimed! More coming soon.</p>';
                return;
            }

            toShow.forEach(milestone => {
                const row = document.createElement('div');
                const isNext = !milestone.claimed && unclaimed[0] === milestone;
                row.className = 'reward-row' +
                    (milestone.claimed ? ' reached' : isNext ? ' current' : ' next');

                const medalsNeeded = (milestone.level - 1) * 10;
                const medalsLeft = Math.max(0, medalsNeeded - playerMedals);
                const alreadyOwned = milestone.type === 'unlock' && unlockedNexus.includes(milestone.playerId);

                row.innerHTML = `
                    <span class="reward-level-badge">Lv ${milestone.level}</span>
                    <span style="flex:1">${milestone.icon} ${milestone.reward}</span>
                    <span style="font-size:12px; color:${milestone.claimed ? '#555' : isNext ? '#ffcc00' : '#777'}">
                        ${(milestone.claimed || alreadyOwned) ? 'âœ… Claimed' : medalsLeft === 0 ? 'ðŸŽ‰ Ready!' : `${medalsLeft} ðŸ… away`}
                    </span>
                `;
                list.appendChild(row);
            });
        }

        function setDisplayById(id, value) {
            const el = document.getElementById(id);
            if (el) el.style.display = value;
            return el;
        }

        function setDisplayBySelector(selector, value) {
            const el = document.querySelector(selector);
            if (el) el.style.display = value;
            return el;
        }

        function initLevelRewards() {
            const coinsDisplay = document.getElementById('coins-display');
            if (coinsDisplay) coinsDisplay.addEventListener('click', () => {
                renderLevelRewards();
                setDisplayById('level-rewards-panel', 'block');
            });
            const closeLevelRewards = document.getElementById('close-level-rewards');
            if (closeLevelRewards) closeLevelRewards.addEventListener('click', () => {
                setDisplayById('level-rewards-panel', 'none');
            });
            const closeDailyPanel = document.getElementById('close-daily-panel');
            if (closeDailyPanel) closeDailyPanel.addEventListener('click', () => {
                setDisplayById('daily-panel', 'none');
            });
            const closeHistoryPanel = document.getElementById('close-history-panel');
            if (closeHistoryPanel) closeHistoryPanel.addEventListener('click', () => {
                setDisplayById('history-panel', 'none');
            });
            
            const closeTutorialPanel = document.getElementById('close-tutorial-panel');
            if (closeTutorialPanel) closeTutorialPanel.addEventListener('click', () => {
                setDisplayById('tutorial-panel', 'none');
            });
            
            const markTipsSeenBtn = document.getElementById('mark-tips-seen-btn');
            if (markTipsSeenBtn) markTipsSeenBtn.addEventListener('click', () => {
                storageSetItem('tutorialSeen', 'true');
                setDisplayById('tutorial-panel', 'none');
            });
            
            const closeMedalRoadPanel = document.getElementById('close-medal-road-panel');
            if (closeMedalRoadPanel) closeMedalRoadPanel.addEventListener('click', () => {
                setDisplayById('medal-road-panel', 'none');
            });
            
            // Show badge if claimable on load
            updateDailyBadge();
            dailyWinsState = loadDailyWinsState();
            renderDailyWinsWidget();
        }

        function hideAllUI() {
            setDisplayBySelector('.guide', 'none');
            setDisplayBySelector('.menu', 'none');
            setDisplayById('char-showcase', 'none');
            setDisplayById('account-chip', 'none');
            setDisplayById('joystick-container', 'none');
            setDisplayById('shoot-joystick-container', 'none');
            setDisplayById('game-modes-container', 'none');
            setDisplayById('map-select-panel', 'none');
            setDisplayById('player-menu', 'none');
            setDisplayById('profile-panel', 'none');
            setDisplayById('game-over-overlay', 'none');
            setDisplayById('stardrop-overlay', 'none');
            setDisplayById('daily-btn', 'none');
            setDisplayById('history-btn', 'none');
            setDisplayById('tutorial-btn', 'none');
            setDisplayById('daily-wins-tracker', 'none');
            setDisplayById('medal-road-btn', 'none');
        }

        function showAllUI() {
            setDisplayBySelector('.guide', 'none');
            setDisplayBySelector('.menu', 'flex');
            setDisplayById('char-showcase', 'flex');
            setDisplayById('account-chip', 'flex');
            setDisplayById('daily-btn', 'block');
            setDisplayById('history-btn', 'block');
            setDisplayById('tutorial-btn', 'block');
            setDisplayById('daily-wins-tracker', 'block');
            setDisplayById('medal-road-btn', 'block');
            if (window.innerWidth <= 1024 || ('ontouchstart' in window)) {
                setDisplayById('joystick-container', 'block');
                setDisplayById('shoot-joystick-container', 'block');
            }
            setDisplayById('game-over-overlay', 'none');
            setDisplayById('stardrop-overlay', 'none');
            setDisplayById('battle-intro-overlay', 'none');
        }

        function getBattleIntroTrophies(fighter) {
            if (!fighter) return 0;
            if (fighter.isHuman) return Math.max(0, getNexusMedals(fighter.characterId || selectedNexusId || 'default'));

            const seed = `${fighter.name || ''}|${fighter.characterId || ''}|${fighter.id || ''}`;
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            return 80 + (Math.abs(hash) % 1101);
        }

        function renderBattleIntroRoster() {
            const rosterEl = document.getElementById('battle-intro-roster');
            const titleEl = document.getElementById('battle-intro-title');
            const subtitleEl = document.getElementById('battle-intro-subtitle');
            if (!rosterEl || !titleEl || !subtitleEl) return;

            const modeConfig = gameModes[currentGameMode] || null;
            const teamNames = modeConfig && modeConfig.teams ? (modeConfig.teamNames || []) : [];
            const teamOrderIndex = (team) => {
                const idx = teamNames.indexOf(team);
                return idx === -1 ? 999 : idx;
            };

            const roster = [...players].sort((a, b) => {
                if (a.isHuman && !b.isHuman) return -1;
                if (!a.isHuman && b.isHuman) return 1;
                if (teamNames.length > 0 && a.team !== b.team) return teamOrderIndex(a.team) - teamOrderIndex(b.team);
                return (a.name || '').localeCompare(b.name || '');
            });

            titleEl.textContent = modeConfig ? `${modeConfig.name} - Match Intro` : 'Match Intro';
            subtitleEl.textContent = `${roster.length} Fighters Ready`;

            const getRosterDisplayName = (fighter) => {
                if (fighter?.isHuman) {
                    return getCurrentProfile()?.username || 'You';
                }
                return fighter?.name || playersData[fighter?.characterId]?.name || 'Bot';
            };

            const renderCard = (p) => {
                const pdata = playersData[p.characterId] || p;
                const charName = pdata?.name || p.name || 'Fighter';
                const displayName = getRosterDisplayName(p);
                const teamClass = p.team ? ` team-${p.team}` : '';
                const teamLabel = p.team ? p.team.toUpperCase() : 'SOLO';
                const roleLabel = p.isHuman ? 'YOU' : `${p.botPersonalityIcon || 'ðŸ¤–'} ${p.botPersonalityLabel || 'Bot'}`;
                const trophies = getBattleIntroTrophies(p);
                const icon =
                    getPlayerPreferredImageSrc(p) ||
                    getPlayerPreferredImageSrc(pdata) ||
                    pdata?.img ||
                    pdata?.legacyImg ||
                    p.img ||
                    '';
                return `
                    <article class="battle-intro-player-card${p.isHuman ? ' human' : ''}${teamClass}">
                        <div class="battle-intro-card-top">
                            <span class="battle-intro-chip role">${roleLabel}</span>
                            <span class="battle-intro-chip team">${teamLabel}</span>
                        </div>
                        <div class="battle-intro-player-portrait-wrap">
                            ${icon
                                ? `<img class="battle-intro-player-portrait" src="${icon}" alt="${charName}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="battle-intro-player-portrait-fallback" style="display:none;">?</div>`
                                : '<div class="battle-intro-player-portrait-fallback">?</div>'}
                        </div>
                        <div class="battle-intro-player-name">${displayName}${p.isHuman ? ' (You)' : ''}</div>
                        <div class="battle-intro-player-character">${charName}</div>
                        <div class="battle-intro-card-bottom">
                            <span class="battle-intro-chip trophy">ðŸ… ${trophies}</span>
                            <span class="battle-intro-chip ready">âš”ï¸ READY</span>
                        </div>
                    </article>
                `;
            };

            if (teamNames.length > 0) {
                const renderTeamBlock = (teamName) => {
                    const teamPlayers = roster.filter(p => p.team === teamName);
                    if (teamPlayers.length === 0) return '';
                    return `
                        <section class="battle-intro-team-block ${teamName}">
                            <div class="battle-intro-team-title">${teamName.toUpperCase()} TEAM</div>
                            <div class="battle-intro-team-card-grid" style="--team-count:${Math.max(1, teamPlayers.length)};">
                                ${teamPlayers.map(renderCard).join('')}
                            </div>
                        </section>
                    `;
                };

                if (teamNames.length === 2) {
                    const leftTeam = renderTeamBlock(teamNames[0]);
                    const rightTeam = renderTeamBlock(teamNames[1]);
                    rosterEl.innerHTML = `
                        <div class="battle-intro-teams-row two-team-split">
                            ${leftTeam}
                            <div class="battle-intro-vs-split">VS</div>
                            ${rightTeam}
                        </div>
                    `;
                    return;
                }

                const teamsHtml = teamNames.map((teamName) => renderTeamBlock(teamName)).join('');

                rosterEl.innerHTML = `<div class="battle-intro-teams-grid">${teamsHtml}</div>`;
                return;
            }

            const soloCols = roster.length >= 10 ? 5 : (roster.length >= 8 ? 4 : Math.max(2, Math.min(4, roster.length)));
            rosterEl.innerHTML = `<div class="battle-intro-player-grid" style="--solo-cols:${soloCols};">${roster.map(renderCard).join('')}</div>`;
        }

        function showBattleIntroThenStart(onStart) {
            const overlay = document.getElementById('battle-intro-overlay');
            const countdownEl = document.getElementById('battle-intro-countdown');
            if (!overlay || !countdownEl) {
                if (typeof onStart === 'function') onStart();
                return;
            }

            if (battleIntroTimerId) {
                clearTimeout(battleIntroTimerId);
                battleIntroTimerId = null;
            }

            battleIntroInProgress = true;
            renderBattleIntroRoster();
            overlay.classList.remove('battle-intro-attack-phase');
            countdownEl.classList.remove('attack-pulse');
            overlay.style.display = 'flex';

            const steps = ['3', '2', '1', 'ATTACK!'];
            let idx = 0;
            countdownEl.textContent = steps[idx];

            const runStep = () => {
                idx++;
                if (idx >= steps.length) {
                    battleIntroTimerId = null;
                    overlay.style.display = 'none';
                    overlay.classList.remove('battle-intro-attack-phase');
                    countdownEl.classList.remove('attack-pulse');
                    battleIntroInProgress = false;
                    if (typeof onStart === 'function') onStart();
                    return;
                }
                countdownEl.textContent = steps[idx];
                if (steps[idx] === 'ATTACK!') {
                    overlay.classList.add('battle-intro-attack-phase');
                    countdownEl.classList.add('attack-pulse');
                    battleIntroTimerId = setTimeout(runStep, 620);
                    return;
                }
                battleIntroTimerId = setTimeout(runStep, 700);
            };

            battleIntroTimerId = setTimeout(runStep, 700);
        }

        function openMapSelect() {
            startGame();
        }

        function startGame() {
            if (gameStarted || battleIntroInProgress) return;
            hideAllUI();
            setupGameMode(currentGameMode);
            setDisplayById('coins-display', 'none');

            showBattleIntroThenStart(() => {
                gameStarted = true;
                matchStartedAt = Date.now();

                // Add game-active class to body to show joysticks
                document.body.classList.add('game-active');

                // Show joysticks when game starts (if on mobile/tablet)
                if (window.innerWidth <= 1024 || ('ontouchstart' in window)) {
                    setDisplayById('joystick-container', 'block');
                    setDisplayById('shoot-joystick-container', 'block');
                }

                gameLoop();
            });
        }

        // Credits Panel
        function initCreditsPanel() {
            document.getElementById('credits-btn').addEventListener('click', () => {
                document.getElementById('credits-panel').style.display = 'block';
                renderCreditsPanel();
            });
            document.getElementById('close-credits-panel').addEventListener('click', () => {
                document.getElementById('credits-panel').style.display = 'none';
            });

        }

        // â”€â”€ BATTLE MAP AUTO-LOADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Map files live in images/. Naming rules:
        //   Contains "team"     â†’ used for team-battle modes (2v2, 3v3, ballGoal)
        //   Contains "showdown" â†’ used for Showdown mode
        //   Plain "battlemap"   â†’ falls into team pool as default
        // The game picks a random matching map at battle start.
        // Examples: battlemap_team.png, battlemap_team2.png, battlemap_showdown.png

        const mapPools = { team: [], showdown: [], ballGoal: [] };
        let currentBattleMapData = null; // set per-game by pickMap()

        function discoverMaps() {
            const candidates = [];
            // Plain battlemap (goes to team pool)
            candidates.push('images/battlemap.png');
            // Numbered team, showdown & ballgoal variants 1-10
            for (let n = 0; n <= 10; n++) {
                const s = n === 0 ? '' : String(n);
                candidates.push(`images/battlemap_team${s}.png`);
                candidates.push(`images/battlemap_showdown${s}.png`);
                candidates.push(`images/battlemap_ballgoal${s}.png`);
            }
            candidates.forEach(src => parseBattleMapFile(src, data => {
                if (!data) return;
                const lower = src.toLowerCase();
                if (lower.includes('showdown')) mapPools.showdown.push(data);
                else if (lower.includes('ballgoal')) mapPools.ballGoal.push(data);
                else mapPools.team.push(data);
            }));
        }

        function parseBattleMapFile(src, callback) {
            const img = new Image();
            img.onload = function() {
                const W = 200, H = 200;
                const cellW = MAP_WIDTH / W;
                const cellH = MAP_HEIGHT / H;
                const tmp = document.createElement('canvas');
                tmp.width = W; tmp.height = H;
                const tCtx = tmp.getContext('2d');
                tCtx.drawImage(img, 0, 0, W, H);
                let px;
                try { px = tCtx.getImageData(0, 0, W, H).data; }
                catch(e) { callback(null); return; }

                const brickGrid = Array.from({length:H}, () => new Array(W).fill(false));
                const metalGrid = Array.from({length:H}, () => new Array(W).fill(false));
                const bushGrid = Array.from({length:H}, () => new Array(W).fill(false));
                const spawnPoints = { red:[], blue:[], green:[], yellow:[] };
                const goalPoints  = { red:[], blue:[] };
                const healBoxPoints = [];

                function pushMarker(list, col, row, cx, cy) {
                    list.push({ col, row, x: cx, y: cy });
                }

                function dedupeByEditorGrid(points) {
                    const reduced = [];
                    const seen = new Set();
                    for (const p of points) {
                        // Editor uses 5x5-pixel cells (50 game units), so collapse each block.
                        const key = `${Math.floor(p.col / 5)}_${Math.floor(p.row / 5)}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        reduced.push({ x: p.x, y: p.y });
                    }
                    return reduced;
                }

                for (let row = 0; row < H; row++) {
                    for (let col = 0; col < W; col++) {
                        const i = (row * W + col) * 4;
                        const r = px[i], g = px[i+1], b = px[i+2];
                        const cx = col * cellW + cellW / 2;
                        const cy = row * cellH + cellH / 2;
                        if      (r > 200 && g <  80 && b <  80) pushMarker(spawnPoints.red, col, row, cx, cy);
                        else if (b > 200 && r <  80 && g <  80) pushMarker(spawnPoints.blue, col, row, cx, cy);
                        else if (g > 180 && r <  80 && b <  80) pushMarker(spawnPoints.green, col, row, cx, cy);
                        else if (r > 200 && g > 180 && b <  80) pushMarker(spawnPoints.yellow, col, row, cx, cy);
                        // healbox: pink-magenta (255,77,210)
                        else if (r > 200 && g > 40 && g < 130 && b > 160) pushMarker(healBoxPoints, col, row, cx, cy);
                        // goal_red: orange-red (255,102,0) â€” r>200, g>80&&g<150, b<30
                        else if (r > 200 && g > 80 && g < 150 && b < 30) goalPoints.red.push({x:cx, y:cy});
                        // goal_blue: bright blue (0,136,255) â€” b>200, r<30, g>100&&g<180
                        else if (b > 200 && r < 30 && g > 100 && g < 180) goalPoints.blue.push({x:cx, y:cy});
                        else if (r > 95 && r < 180 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) metalGrid[row][col] = true;
                        else if (r > 100 && g < 100 && b < 80 && r > g + 30) brickGrid[row][col] = true;
                        else if (g > 60  && g < 170  && r < 80 && b < 80 && g > r * 1.5) bushGrid[row][col] = true;
                    }
                }

                const obstacles = [
                    ...mergeGridToRects(brickGrid, W, H, cellW, cellH, 'brick'),
                    ...mergeGridToRects(metalGrid, W, H, cellW, cellH, 'metal')
                ];
                const bushCells = [];
                for (let row = 0; row < H; row++)
                    for (let col = 0; col < W; col++)
                        if (bushGrid[row][col])
                            bushCells.push({ x: col * cellW, y: row * cellH, size: Math.max(cellW, cellH) });

                const spawn = {};
                for (const [team, pts] of Object.entries(spawnPoints))
                    spawn[team] = dedupeByEditorGrid(pts);

                const healBoxSpawns = dedupeByEditorGrid(healBoxPoints);

                // Build goal rects from goal pixel clusters (bounding box of each color group)
                const customGoals = [];
                for (const team of ['red', 'blue']) {
                    const pts = goalPoints[team];
                    if (pts.length > 0) {
                        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
                        const minX = Math.min(...xs), maxX = Math.max(...xs);
                        const minY = Math.min(...ys), maxY = Math.max(...ys);
                        customGoals.push({ team, x: minX, y: minY, w: maxX - minX + cellW, h: maxY - minY + cellH });
                    }
                }

                callback({ obstacles, bushCells, spawnPoints: spawn, customGoals, healBoxSpawns });
            };
            img.onerror = () => callback(null);
            img.src = src + '?' + Date.now();
        }

        function pickMap(isTeamMode) {
            let pool;
            if (currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') {
                pool = mapPools.ballGoal.length > 0 ? mapPools.ballGoal : mapPools.team;
            } else if (isTeamMode) {
                pool = mapPools.team;
            } else {
                pool = mapPools.showdown;
            }
            if (pool.length === 0) {
                currentBattleMapData = createFallbackRandomMap(isTeamMode, currentGameMode);
                return;
            }
            currentBattleMapData = pool[Math.floor(Math.random() * pool.length)];
        }

        function createFallbackRandomMap(isTeamMode, mode) {
            const rand = (min, max) => min + Math.random() * (max - min);
            const obstacles = [];
            const bushCells = [];
            const obstacleCount = isTeamMode ? 22 : 16;
            const bushCount = isTeamMode ? 70 : 48;
            const minSide = Math.min(MAP_WIDTH, MAP_HEIGHT);
            const obstacleMin = Math.max(100, Math.floor(minSide * 0.065));
            const obstacleMax = Math.max(obstacleMin + 40, Math.floor(minSide * 0.145));
            const edgePadding = Math.max(80, Math.floor(minSide * 0.06));
            const bushSize = Math.max(26, Math.floor(minSide * 0.018));

            const blockedZones = [
                { x: MAP_WIDTH / 2 - 140, y: 0, width: 280, height: MAP_HEIGHT },
                { x: 0, y: MAP_HEIGHT / 2 - 140, width: MAP_WIDTH, height: 280 },
                { x: 0, y: 0, width: 260, height: 260 },
                { x: MAP_WIDTH - 260, y: 0, width: 260, height: 260 },
                { x: 0, y: MAP_HEIGHT - 260, width: 260, height: 260 },
                { x: MAP_WIDTH - 260, y: MAP_HEIGHT - 260, width: 260, height: 260 }
            ];

            function intersectsBlocked(rect) {
                return blockedZones.some(z =>
                    rect.x < z.x + z.width &&
                    rect.x + rect.width > z.x &&
                    rect.y < z.y + z.height &&
                    rect.y + rect.height > z.y
                );
            }

            for (let i = 0; i < obstacleCount; i++) {
                const w = Math.floor(rand(obstacleMin, obstacleMax));
                const h = Math.floor(rand(obstacleMin, obstacleMax));
                const rect = {
                    x: Math.floor(rand(edgePadding, Math.max(edgePadding + 1, MAP_WIDTH - w - edgePadding))),
                    y: Math.floor(rand(edgePadding, Math.max(edgePadding + 1, MAP_HEIGHT - h - edgePadding))),
                    width: w,
                    height: h,
                    type: Math.random() < 0.2 ? 'water' : 'brick'
                };
                if (!intersectsBlocked(rect)) obstacles.push(rect);
            }

            for (let i = 0; i < bushCount; i++) {
                const size = bushSize;
                const bush = {
                    x: Math.floor(rand(edgePadding, Math.max(edgePadding + 1, MAP_WIDTH - size - edgePadding))),
                    y: Math.floor(rand(edgePadding, Math.max(edgePadding + 1, MAP_HEIGHT - size - edgePadding))),
                    size
                };
                if (!intersectsBlocked({ x: bush.x, y: bush.y, width: bush.size, height: bush.size })) {
                    bushCells.push(bush);
                }
            }

            const spawnPoints = {
                red: [
                    { x: 140, y: MAP_HEIGHT * 0.35 },
                    { x: 170, y: MAP_HEIGHT * 0.50 },
                    { x: 140, y: MAP_HEIGHT * 0.65 }
                ],
                blue: [
                    { x: MAP_WIDTH - 140, y: MAP_HEIGHT * 0.35 },
                    { x: MAP_WIDTH - 170, y: MAP_HEIGHT * 0.50 },
                    { x: MAP_WIDTH - 140, y: MAP_HEIGHT * 0.65 }
                ],
                green: [
                    { x: MAP_WIDTH * 0.35, y: 140 },
                    { x: MAP_WIDTH * 0.50, y: 170 },
                    { x: MAP_WIDTH * 0.65, y: 140 }
                ],
                yellow: [
                    { x: MAP_WIDTH * 0.35, y: MAP_HEIGHT - 140 },
                    { x: MAP_WIDTH * 0.50, y: MAP_HEIGHT - 170 },
                    { x: MAP_WIDTH * 0.65, y: MAP_HEIGHT - 140 }
                ]
            };

            let customGoals = [];
            if (mode === 'ballGoal' || mode === 'kingTown') {
                customGoals = [
                    { team: 'red', x: 18, y: MAP_HEIGHT / 2 - 110, w: 34, h: 220 },
                    { team: 'blue', x: MAP_WIDTH - 52, y: MAP_HEIGHT / 2 - 110, w: 34, h: 220 }
                ];
            }

            return { obstacles, bushCells, spawnPoints, customGoals };
        }

        function mergeGridToRects(grid, W, H, cellW, cellH, type = 'brick') {
            const visited = Array.from({length:H}, () => new Array(W).fill(false));
            const rects = [];
            for (let r = 0; r < H; r++) {
                for (let c = 0; c < W; c++) {
                    if (!grid[r][c] || visited[r][c]) continue;
                    let w = 1;
                    while (c + w < W && grid[r][c + w] && !visited[r][c + w]) w++;
                    let h = 1;
                    outer: while (r + h < H) {
                        for (let k = 0; k < w; k++)
                            if (!grid[r+h][c+k] || visited[r+h][c+k]) break outer;
                        h++;
                    }
                    for (let dr = 0; dr < h; dr++)
                        for (let dc = 0; dc < w; dc++)
                            visited[r+dr][c+dc] = true;
                    rects.push({ x: c*cellW, y: r*cellH, width: w*cellW, height: h*cellH, type });
                }
            }
            return rects;
        }
        // â”€â”€ END BATTLE MAP AUTO-LOADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // â”€â”€â”€ HERO MARKS / CREDITS SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        function getLockedCreditPlayersByRarity(rarity = null) {
            const all = Object.values(playersData)
                .filter(p => p && p.creditCost && !unlockedNexus.includes(p.id));
            const filtered = rarity ? all.filter(p => p.rarity === rarity) : all;
            return filtered.sort((a, b) => a.creditCost - b.creditCost || a.name.localeCompare(b.name));
        }

        function getCreditRarityOrder() {
            return ['epic', 'mythic', 'legendary'];
        }

        function getCurrentCreditTier() {
            const order = getCreditRarityOrder();
            for (const rarity of order) {
                if (getLockedCreditPlayersByRarity(rarity).length > 0) return rarity;
            }
            return null;
        }

        function getNextCreditPlayer() {
            const rarityOrder = getCreditRarityOrder();
            for (const rarity of rarityOrder) {
                const nextLocked = getLockedCreditPlayersByRarity(rarity)[0];
                if (nextLocked) return nextLocked;
            }
            return null;
        }

        function tryAutoUnlockCreditTier() {
            const { allLocked } = getActiveCreditTierState();
            if (!allLocked.length) return false;
            if (!selectedCreditTargetId) return false;
            if (!allLocked.some(p => p.id === selectedCreditTargetId)) return false;

            const pd = playersData[selectedCreditTargetId];
            if (!pd || !pd.creditCost) return false;
            if (playerCredits < pd.creditCost) return false;

            playerCredits -= pd.creditCost;
            if (!unlockedNexus.includes(pd.id)) unlockedNexus.push(pd.id);
            selectedCreditTargetId = null;
            saveProgress();
            return true;
        }

        function getActiveCreditTierState() {
            const rarityOrder = getCreditRarityOrder();
            const currentTier = getCurrentCreditTier();
            const currentTierIndex = currentTier ? rarityOrder.indexOf(currentTier) : -1;
            const lockedInTier = currentTier ? getLockedCreditPlayersByRarity(currentTier) : [];
            const allLocked = getLockedCreditPlayersByRarity();
            return { currentTier, lockedInTier, currentTierIndex, allLocked };
        }

        function selectCreditTarget(playerId) {
            const { allLocked } = getActiveCreditTierState();
            if (!allLocked.some(p => p.id === playerId)) return;
            selectedCreditTargetId = playerId;
            saveProgress();
            renderCreditsPanel();
        }

        function renderCreditsPanel() {
            const barEl = document.getElementById('credits-progress-bar');
            const list = document.getElementById('credits-tier-list');

            const { currentTier, lockedInTier, allLocked } = getActiveCreditTierState();

            if (!currentTier || allLocked.length === 0) {
                // All players unlocked
                const champRewarded = storageGetItem('champRewardGiven') === '1';
                if (!champRewarded) {
                    storageSetItem('champRewardGiven', '1');
                    playerCoins += 2000;
                    energySparks += 1000;
                    saveProgress();
                }
                barEl.innerHTML = '<div style="text-align:center; padding:20px 10px;"><div style="font-size:48px;">ðŸ†</div><h3 style="color:#ffcc00; margin:8px 0 4px; font-size:20px;">Master Attacker!</h3><p style="color:#aaa; font-size:13px; margin:0;">You unlocked all Hero Marks fighters.</p></div>';
                list.innerHTML = '';
                return;
            }

            if (!selectedCreditTargetId || unlockedNexus.includes(selectedCreditTargetId) || !allLocked.some(p => p.id === selectedCreditTargetId)) {
                selectedCreditTargetId = allLocked[0].id;
                saveProgress();
            }

            const target = playersData[selectedCreditTargetId];
            const rc = rarityColors[currentTier] || '#b44aff';
            const progressValue = Math.min(playerCredits, target.creditCost);
            const progressPct = Math.max(0, Math.min(100, Math.round((progressValue / target.creditCost) * 100)));
            const remaining = Math.max(0, target.creditCost - playerCredits);
            const canUnlockSelected = playerCredits >= target.creditCost;

            const totalInTier = Object.values(playersData).filter(p => p.rarity === currentTier && p.creditCost).length;
            const unlockedInTier = Object.values(playersData).filter(p => p.rarity === currentTier && p.creditCost && unlockedNexus.includes(p.id)).length;

            const tierLabel = currentTier === 'epic' ? 'âš« Epic' : (currentTier === 'mythic' ? 'ðŸ”´ Mythic' : 'ðŸŸ¡ Legendary');

            barEl.innerHTML = '<div style="color:#4ae8d8; font-size:13px; margin-bottom:4px; text-align:center;">ðŸŽ–ï¸ <strong>' + playerCredits + '</strong> Hero Marks</div>' +
                '<div style="background:#222; border-radius:8px; height:14px; overflow:hidden;"><div style="width:' + progressPct + '%; height:100%; background:linear-gradient(90deg,#4ae8d8,#44ccff); border-radius:8px;"></div></div>' +
                '<p style="color:' + rc + '; font-size:13px; text-align:center; margin:8px 0 0; font-weight:bold;">' + tierLabel + ' â€¢ ' + unlockedInTier + '/' + totalInTier + ' unlocked</p>' +
                '<p style="color:#aaa; font-size:11px; text-align:center; margin:6px 0 0;">Target: <strong>' + target.name + '</strong> â€¢ ' + progressValue + '/' + target.creditCost + '</p>' +
                (canUnlockSelected
                    ? '<p style="color:#7df7ab; font-size:11px; text-align:center; margin:6px 0 0;">Ready: unlock happens automatically</p>'
                    : '<p style="color:#999; font-size:11px; text-align:center; margin:6px 0 0;">Need ' + remaining + ' more marks for ' + target.name + '</p>');

            // Build scrollable card carousel (select target across all locked rarities)
            let cardsHtml = '<div class="credits-cards-shell" style="border-color:' + rc + '40;">' +
                '<div class="credits-cards-strip">';

            allLocked.forEach(pd => {
                const bBonus = getStatBonus(pd.id);
                const needed = Math.max(0, pd.creditCost - playerCredits);
                const preferredSrc = getPlayerPreferredImageSrc(pd);
                const isSelected = pd.id === selectedCreditTargetId;

                const hpVal = Math.round(pd.hp * bBonus * COMBAT_STAT_SCALE);
                const dmgVal = Math.round(pd.laserDamage * bBonus * COMBAT_STAT_SCALE);

                const cardImg = preferredSrc
                    ? '<img src="' + preferredSrc + '" alt="' + pd.name + '" style="width:100%; height:100%; object-fit:contain; padding:8px;">'
                    : '<span style="color:white; font-weight:bold; font-size:18px;">' + pd.name + '</span>';

                const cardBorder = isSelected ? '#ffcc00' : rc;
                const selectedBadge = isSelected ? '<p style="margin:0 0 4px; font-size:11px; color:#ffcc00; font-weight:bold;">âœ“ Selected</p>' : '';
                const actionText = isSelected ? (remaining > 0 ? ('Need ' + remaining) : 'Ready to unlock') : 'Select';

                cardsHtml += '<div class="credits-player-card' + (isSelected ? ' selected' : '') + '" onclick="selectCreditTarget(\'' + pd.id + '\')" style="border-color:' + cardBorder + '; box-shadow:' + (isSelected ? '0 0 16px #ffcc00aa' : ('0 0 16px ' + rc + '50')) + ';">' +
                    selectedBadge +
                    '<div class="credits-player-card-media" style="background:' + pd.color + ';">' +
                    cardImg +
                    '</div>' +
                    '<h3 class="credits-player-card-name">' + pd.name + '</h3>' +
                    '<p class="credits-player-card-rarity" style="color:' + (rarityColors[pd.rarity] || rc) + ';">' + rarityLabels[pd.rarity] + '</p>' +
                    '<div class="credits-player-card-stats">' +
                    '<span>HP ' + hpVal + '</span>  <span>DMG ' + dmgVal + '</span>' +
                    '</div>' +
                    '<button class="credits-player-card-action" style="background:' + (isSelected ? '#ffcc00' : '#2a2a3a') + '; color:' + (isSelected ? '#000' : '#ddd') + ';">' + actionText + '</button>' +
                    '</div>';
            });

            cardsHtml += '</div></div>';

            // Show tier preview info
            let nextTiersHtml = '';
            if (currentTier === 'epic') {
                const mythicTotal = Object.values(playersData).filter(p => p.rarity === 'mythic' && p.creditCost).length;
                const mythicUnlocked = Object.values(playersData).filter(p => p.rarity === 'mythic' && p.creditCost && unlockedNexus.includes(p.id)).length;
                nextTiersHtml += '<div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">' +
                    '<div style="flex:1; min-width:160px; padding:12px; background:#ff4a6a15; border:2px solid #ff4a6a40; border-radius:10px; text-align:center;">' +
                    '<p style="color:#ff4a6a; font-size:12px; font-weight:bold; margin:0 0 4px;">ðŸ”´ Mythic</p>' +
                    '<p style="color:#aaa; font-size:11px; margin:0;">' + mythicUnlocked + '/' + mythicTotal + ' unlocked</p>' +
                    '<p style="color:#999; font-size:10px; margin:4px 0 0;">Complete Epic to unlock</p>' +
                    '</div>' +
                    '<div style="flex:1; min-width:160px; padding:12px; background:#ffaa0015; border:2px solid #ffaa0040; border-radius:10px; text-align:center;">' +
                    '<p style="color:#ffaa00; font-size:12px; font-weight:bold; margin:0 0 4px;">ðŸŸ¡ Legendary</p>' +
                    '<p style="color:#aaa; font-size:11px; margin:0;">0/' + Object.values(playersData).filter(p => p.rarity === 'legendary' && p.creditCost).length + ' unlocked</p>' +
                    '<p style="color:#999; font-size:10px; margin:4px 0 0;">Need 1+ Mythic</p>' +
                    '</div>' +
                    '</div>';
            } else if (currentTier === 'mythic') {
                const legTotal = Object.values(playersData).filter(p => p.rarity === 'legendary' && p.creditCost).length;
                const legUnlocked = Object.values(playersData).filter(p => p.rarity === 'legendary' && p.creditCost && unlockedNexus.includes(p.id)).length;
                nextTiersHtml += '<div style="margin-top:16px; padding:12px; background:#ffaa0015; border:2px solid #ffaa0040; border-radius:10px; text-align:center;">' +
                    '<p style="color:#ffaa00; font-size:12px; font-weight:bold; margin:0 0 4px;">ðŸŸ¡ Legendary (Unlocked!)</p>' +
                    '<p style="color:#aaa; font-size:11px; margin:0;">' + legUnlocked + '/' + legTotal + ' unlocked</p>' +
                    '</div>';
            }

            list.innerHTML = cardsHtml + nextTiersHtml;
        }

        // Bazaar System (developer-defined redeem codes)
        const BAZZAR_CODE_DEFINITIONS = {
            // Add or edit your testing codes here.
            // Format: CODE: { coins: number, sparks: number, credits: number, medals?: number }
            // Codes have UNLIMITED uses â€” no maxUses needed.
            SOT: { coins: 10000, sparks: 10000, credits: 1000 },
            MEDALS: { coins: 0, sparks: 0, credits: 0, medals: 150 },
            // Special code: resets first-time tutorial and starts onboarding again.
            TUTORIAL: { coins: 0, sparks: 0, credits: 0 },
        };

        function applyUnlockAllPlayersInMaxCode() {
            // Unlock all playable characters.
            unlockedNexus = Object.values(playersData).map(p => p.id);

            // Set all players to max power level.
            if (!playerPowerLevels || typeof playerPowerLevels !== 'object' || Array.isArray(playerPowerLevels)) {
                playerPowerLevels = {};
            }
            Object.values(playersData).forEach(p => {
                playerPowerLevels[p.id] = 14;
            });

            // Unlock all gadget entries, including multi-gadget characters.
            unlockedGadgets = Object.keys(gadgetData);

            // With all players unlocked, no credit target selection is needed.
            selectedCreditTargetId = null;
        }

        function getBazzarUsageState() {
            try {
                const parsed = JSON.parse(localStorage.getItem('bazzarCodeUsageState') || '{}');
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return {};
            }
        }

        function saveBazzarUsageState(state) {
            localStorage.setItem('bazzarCodeUsageState', JSON.stringify(state || {}));
        }

        function setBazzarStatus(text, color = '#9aa8bf') {
            const el = document.getElementById('bazzar-status');
            if (!el) return;
            el.style.color = color;
            el.textContent = text || '';
        }

        function getBazzarRuntimeCodes() {
            const runtime = {};
            Object.entries(BAZZAR_CODE_DEFINITIONS).forEach(([code, cfg]) => {
                const key = String(code || '').toUpperCase().trim();
                if (!key) return;
                runtime[key] = {
                    coins: Math.max(0, toSafeInt(cfg.coins || 0)),
                    sparks: Math.max(0, toSafeInt(cfg.sparks || 0)),
                    credits: Math.max(0, toSafeInt(cfg.credits || 0)),
                    medals: Math.max(0, toSafeInt(cfg.medals || 0))
                };
            });
            return runtime;
        }

        function renderBazaarItems() {
            // Hidden by request: do not show configured codes in UI.
            return;
        }

        function initModalCloseXButtons() {
            document.querySelectorAll('.modal-panel').forEach(panel => {
                if (panel.querySelector('.modal-nav-back')) return;
                const btn = document.createElement('button');
                btn.className = 'modal-nav-back';
                btn.setAttribute('aria-label', 'Back');
                btn.textContent = '\u2190 Back';
                btn.addEventListener('click', () => {
                    const closer = panel.querySelector('.modal-close');
                    if (closer) { closer.click(); return; }
                    panel.style.display = 'none';
                });
                panel.insertBefore(btn, panel.firstChild);
            });
        }

        function initBazaar() {
            const openBtn = document.getElementById('bazzar-btn');
            const overlay = document.getElementById('bazzar-overlay');
            const closeBtn = document.getElementById('close-bazzar-panel');
            const redeemBtn = document.getElementById('bazzar-redeem-btn');

            if (!openBtn || !overlay || !closeBtn || !redeemBtn) return;

            function openBazzar() {
                overlay.style.display = 'flex';
                setBazzarStatus('');
                const input = document.getElementById('bazzar-redeem-input');
                if (input) setTimeout(() => input.focus(), 80);
            }

            function closeBazzar() {
                overlay.style.display = 'none';
            }

            openBtn.addEventListener('click', openBazzar);
            closeBtn.addEventListener('click', closeBazzar);

            // Click backdrop to close
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeBazzar();
            });

            // Escape key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.style.display === 'flex') closeBazzar();
            });

            // Enter key in input to redeem
            const redeemInput = document.getElementById('bazzar-redeem-input');
            if (redeemInput) {
                redeemInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') redeemBtn.click();
                });
            }

            redeemBtn.addEventListener('click', () => {
                const input = document.getElementById('bazzar-redeem-input');
                const key = (input?.value || '').trim().toUpperCase();
                if (!key) {
                    setBazzarStatus('Enter a code first.', '#ff9da0');
                    return;
                }

                if (key === 'TUTORIAL') {
                    storageRemoveItem('tutorialSeen');
                    setBazzarStatus('Tutorial reset! Starting onboarding...', '#7df7ab');
                    if (input) input.value = '';
                    closeBazzar();
                    if (!gameStarted) {
                        startOnboardingFlow();
                    }
                    return;
                }

                if (key === 'UNLOCK') {
                    applyUnlockAllPlayersInMaxCode();
                    saveProgress();
                    showCoins();
                    updatePlayerMenu();
                    updateCharShowcase();
                    renderCreditsPanel();
                    setBazzarStatus('All players unlocked, maxed to Lv 14, all gadgets unlocked!', '#7df7ab');
                    if (input) { input.value = ''; input.focus(); }
                    return;
                }

                if (key === 'NEW') {
                    startTemporaryNewAccountSession();
                    storageSetItem('experienceChoice', 'new');
                    storageRemoveItem('tutorialSeen');
                    setBazzarStatus('Started NEW temporary account. Tutorial is required now.', '#7df7ab');
                    if (input) input.value = '';
                    closeBazzar();
                    if (!gameStarted) startOnboardingFlow();
                    return;
                }

                const runtimeCodes = getBazzarRuntimeCodes();
                const cfg = runtimeCodes[key];
                if (!cfg) {
                    setBazzarStatus('Code not found.', '#ff9da0');
                    return;
                }

                playerCoins += cfg.coins;
                energySparks += cfg.sparks;
                playerCredits += cfg.credits;
                if (cfg.medals > 0) {
                    awardMedals(cfg.medals);
                }

                saveProgress();
                showCoins();
                renderBazaarItems();
                setBazzarStatus('Redeemed ' + key + '!', '#7df7ab');
                if (input) { input.value = ''; input.focus(); }
            });
        }

        function buyPlayer(playerId) {
            const playerData = playersData[playerId];
            if (playerData && !unlockedNexus.includes(playerId)) {
                unlockedNexus.push(playerId);
                saveProgress();
                showCoins();
            }
        }

        function buyPlayerWithCredits(playerId) {
            const pd = playersData[playerId];
            if (!pd || !pd.creditCost) return;
            if (unlockedNexus.includes(playerId)) return;
            const { allLocked } = getActiveCreditTierState();
            if (!allLocked.some(p => p.id === playerId)) return;
            if (playerCredits < pd.creditCost) return;
            playerCredits -= pd.creditCost;
            if (!unlockedNexus.includes(playerId)) unlockedNexus.push(playerId);
            selectedCreditTargetId = null; // clear selection after unlock
            saveProgress();
            showCoins();
            renderCreditsPanel();
        }

        // switchPlayerInTier removed â€” no switching allowed after unlocking a tier

        function showLootboxPopup(message) {
            // Alerts/popups are disabled by request.
            return;
        }

        // â”€â”€â”€ PLAYER MENU & CHARACTER SELECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function initPlayerMenu() {
            document.getElementById('switch-player-btn').addEventListener('click', () => {
                document.getElementById('player-menu').style.display = 'block';
                updatePlayerMenu();
            });

            document.getElementById('close-player-menu').addEventListener('click', () => {
                document.getElementById('player-menu').style.display = 'none';
            });
        }

        function updatePlayerMenu() {
            const container = document.getElementById('player-list');
            container.innerHTML = '';

            Object.values(playersData).forEach(playerData => {
                const playerId = playerData.id;
                const isUnlocked = unlockedNexus.includes(playerId);
                const isSelected = selectedNexusId === playerId;
                const pRarityColor = rarityColors[playerData.rarity] || '#b0b0b0';
                const pLevel = getPlayerPowerLevel(playerId);

                const card = document.createElement('div');
                card.style.cssText = `width:118px; height:118px; border-radius:8px; cursor:pointer; position:relative; transition:transform 0.15s;
                    border:3px solid ${isSelected ? '#ffcc00' : (isUnlocked ? pRarityColor : '#444')}; overflow:hidden;
                    box-shadow:${isSelected ? '0 0 14px #ffcc00' : (isUnlocked ? `0 0 10px ${pRarityColor}44` : 'none')};`;

                const thumbSrc = getPlayerPreferredImageSrc(playerData);
                if (thumbSrc) {
                    card.innerHTML = `<img src="${thumbSrc}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" />`;
                } else {
                    card.style.background = playerData.color;
                }

                if (!isUnlocked) {
                    card.style.filter = 'grayscale(0.95) brightness(0.75)';
                }

                // Level badge
                const badge = document.createElement('div');
                badge.style.cssText = 'position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.72); color:#44ccff; font-size:13px; font-weight:bold; padding:2px 6px; border-radius:5px;';
                badge.textContent = `Lv${pLevel}`;
                card.appendChild(badge);

                // Selected checkmark
                if (isSelected) {
                    const check = document.createElement('div');
                    check.style.cssText = 'position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.72); color:#ffcc00; font-size:19px; padding:0 5px; border-radius:5px;';
                    check.textContent = 'âœ“';
                    card.appendChild(check);
                }

                if (!isUnlocked) {
                    const lock = document.createElement('div');
                    lock.style.cssText = 'position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.72); color:#bbb; font-size:17px; padding:0 6px; border-radius:5px;';
                    lock.textContent = 'ðŸ”’';
                    card.appendChild(lock);
                }

                card.onmouseenter = () => card.style.transform = 'scale(1.1)';
                card.onmouseleave = () => card.style.transform = '';
                card.onclick = () => showPlayerDetail(playerId);

                container.appendChild(card);
            });
        }

        // â”€â”€â”€ PLAYER DETAIL & UPGRADE PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function showPlayerDetail(playerId) {
            const pd = playersData[playerId];
            const popup = document.getElementById('player-detail-popup');
            if (!pd) return;
            const pRarityColor = rarityColors[pd.rarity] || '#b0b0b0';
            const pRarityLabel = rarityLabels[pd.rarity] || 'Common';
            const pLevel = getPlayerPowerLevel(playerId);
            const bonus = getStatBonus(playerId);
            const isSelected = selectedNexusId === playerId;
            const isUnlocked = unlockedNexus.includes(playerId);
            const nexusMedals = getNexusMedals(playerId);
            const nextMedalMilestone = getNextNexusMedalMilestone(playerId);

            document.getElementById('pd-img').src = getPlayerPreferredImageSrc(pd) || '';
            document.getElementById('pd-img').style.borderColor = pRarityColor;
            document.getElementById('pd-name').textContent = pd.name;
            document.getElementById('pd-rarity').textContent = pRarityLabel;
            document.getElementById('pd-rarity').style.color = pRarityColor;
            document.getElementById('pd-level').textContent = `âš¡ Power Level ${pLevel}/14 â€¢ ðŸ… Medals ${nexusMedals}` +
                (nextMedalMilestone ? ` (next reward at ${nextMedalMilestone})` : ' (all mastery rewards claimed)');
            document.getElementById('pd-hp').textContent = Math.round(pd.hp * bonus * COMBAT_STAT_SCALE);
            document.getElementById('pd-dmg').textContent = Math.round(pd.laserDamage * bonus * COMBAT_STAT_SCALE);
            document.getElementById('pd-spd').textContent = pd.speed;
            document.getElementById('pd-rng').textContent = pd.laserRange;
            document.getElementById('player-detail-box').style.borderColor = pRarityColor;

            // Super ability description with visual indicator
            const superDiv = document.getElementById('pd-super-section');
            let superHtml = `<p style="color:#ffcc00; font-size:12px; font-weight:bold; margin:0 0 6px;">âœ¨ ${pd.superName || 'Super Ability'}</p>`;
            
            // Add zone indicator based on super type
            let superDesc = '';
            switch(pd.superType) {
                case 'firezone':
                case 'smokezone':
                case 'icestorm':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:50px; border:2px dashed #ffcc00; border-radius:50%; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">Large zone effect at target</p></div>`;
                    break;
                case 'burst':
                case 'megazord':
                case 'scream':
                case 'punchflurry':
                case 'groundslam':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:50px; border:2px dashed #ffcc00; border-radius:50%; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">AoE around self</p></div>`;
                    break;
                case 'cardcage':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:50px; border:2px dashed #ffcc00; border-radius:50%; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">Trap zone at target + radial cards</p></div>`;
                    break;
                case 'piercebeam':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:8px; background:#ffcc00; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">Beam across entire map</p></div>`;
                    break;
                case 'bigshot':
                case 'meteorstorm':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:50px; border:2px dashed #ffcc00; border-radius:50%; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">Projectile explosion zone</p></div>`;
                    break;
                case 'tornado':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><div style="width:50px; height:50px; border:2px dashed #ffcc00; border-radius:50%; margin:0 auto;"></div><p style="color:#aaa; font-size:11px; margin:4px 0;">Pull enemies into zone</p></div>`;
                    break;
                case 'snakeswarm':
                    superDesc = `<div style="text-align:center; margin:8px 0;"><p style="color:#aaa; font-size:11px;">Spawn 3 minions</p></div>`;
                    break;
                default:
                    superDesc = `<p style="color:#aaa; font-size:11px;">Special ability ready</p>`;
            }
            superHtml += superDesc;
            superDiv.innerHTML = superHtml;

            // Upgrade section
            const upgradeDiv = document.getElementById('pd-upgrade-section');
            if (!isUnlocked) {
                if (pd.creditCost) {
                    upgradeDiv.innerHTML = `
                        <p style="color:#aaa; font-size:13px; margin:4px 0;">Locked character</p>
                        <p style="font-size:13px; margin:2px 0;">ðŸŽ–ï¸ Cost: ${pd.creditCost} Hero Marks</p>
                        <p style="font-size:11px; color:#888; margin:2px 0;">You have: ðŸŽ–ï¸ ${playerCredits}</p>
                        <button id="pd-unlock-btn" class="btn"
                            style="font-size:14px; padding:6px 16px; margin-top:6px; background:#4ae8d8; color:#000;">
                            Set Hero Marks Target
                        </button>`;
                    const unlockBtn = upgradeDiv.querySelector('#pd-unlock-btn');
                    if (unlockBtn) {
                        unlockBtn.onclick = () => {
                            selectCreditTarget(playerId);
                            showPlayerDetail(playerId);
                            document.getElementById('credits-panel').style.display = 'block';
                            renderCreditsPanel();
                            updatePlayerMenu();
                            updateCharShowcase();
                        };
                    }
                } else if (!unlockedNexus.includes(playerId)) {
                    if (pd.rarity && pd.rarity !== 'common') {
                        // Rare+ without creditCost â†’ locked behind Medals Road
                        const roadMilestone = levelRewards.find(m => m.type === 'unlock' && m.playerId === playerId);
                        const reqLevel = roadMilestone ? roadMilestone.level : '?';
                        upgradeDiv.innerHTML = `
                            <p style="color:#aaa; font-size:13px; margin:4px 0;">Locked character</p>
                            <p style="font-size:13px; margin:4px 0;">ðŸ… Unlock via <strong style="color:#ffcc00;">Medals Road</strong></p>
                            <p style="font-size:12px; color:#aaa; margin:2px 0;">Reach Level ${reqLevel} in the Medals Road</p>
                            <p style="font-size:11px; color:#666; margin:2px 0;">You are Level ${playerLevel}</p>`;
                    } else {
                        upgradeDiv.innerHTML = `
                            <p style="color:#aaa; font-size:13px; margin:4px 0;">Locked character</p>
                            <p style="font-size:13px; margin:2px 0;">ðŸ†“ Free Unlock!</p>
                            <button id="pd-unlock-btn" class="btn"
                                style="font-size:14px; padding:6px 16px; margin-top:6px; background:#ffcc00; color:#000;">
                                Unlock
                            </button>`;
                        const unlockBtn = upgradeDiv.querySelector('#pd-unlock-btn');
                        if (unlockBtn) {
                            unlockBtn.onclick = () => {
                                buyPlayer(playerId);
                                showPlayerDetail(playerId);
                                updatePlayerMenu();
                                updateCharShowcase();
                            };
                        }
                    }
                } else {
                    upgradeDiv.innerHTML = '<p style="color:#aaa; font-size:13px; margin:4px 0;">Locked character</p>';
                }
            } else {
                const cost = getUpgradeCost(playerId);
                if (pLevel >= 14) {
                    upgradeDiv.innerHTML = '<p style="color:#ffcc00; font-weight:bold;">â­ MAX LEVEL â­</p>';
                } else {
                    const availableSparks = toSafeInt(energySparks);
                    const availableCoins = toSafeInt(playerCoins);
                    const canUpgrade = cost && availableSparks >= cost.sparks && availableCoins >= cost.coins;
                    upgradeDiv.innerHTML = `
                        <p style="color:#aaa; font-size:13px; margin:4px 0;">Upgrade to Lv ${pLevel + 1}:</p>
                        <p style="font-size:13px; margin:2px 0;">âš¡ ${cost.sparks} Sparks + ðŸ’° ${cost.coins} Coins</p>
                        <p style="font-size:11px; color:#888; margin:2px 0;">You have: âš¡ ${availableSparks} | ðŸ’° ${availableCoins}</p>
                        <button id="pd-upgrade-btn" class="btn"
                            style="font-size:14px; padding:6px 16px; margin-top:6px; background:${canUpgrade ? '#44ccff' : '#555'}; color:${canUpgrade ? '#000' : '#888'};">
                            âš¡ Upgrade
                        </button>`;
                    if (playerId === 'default') {
                        upgradeDiv.innerHTML += '<div class="phantom-finger-tip">ðŸ‘† Tap Upgrade to power up Soublaki Scorpio</div>';
                    }
                }

                const gadgetKeys = getCharacterGadgetKeys(playerId);
                const ownedGadgets = gadgetKeys.filter(k => unlockedGadgets.includes(k));
                const gadgetRows = gadgetKeys.map(k => {
                    const gInfo = gadgetData[k];
                    const owned = unlockedGadgets.includes(k);
                    const price = getGadgetPrice(k);
                    return `
                        <div style="margin-top:6px; padding:6px; border:1px solid #333; border-radius:8px; background:rgba(0,0,0,0.2);">
                            <div style="font-size:12px; color:#ddd;">${gInfo.icon} ${gInfo.name}</div>
                            <div style="font-size:11px; color:${owned ? '#66dd88' : '#aaa'}; margin-top:2px;">${owned ? 'âœ… Owned' : `ðŸ’° ${price} coins`}</div>
                            ${owned ? '' : `<button class="btn pd-gadget-buy" data-gadget="${k}" ${playerCoins >= price ? '' : 'disabled'}
                                style="font-size:12px; padding:4px 10px; margin-top:4px; background:${playerCoins >= price ? '#ffcc00' : '#555'}; color:${playerCoins >= price ? '#000' : '#888'};">Buy Gadget</button>`}
                        </div>`;
                }).join('');

                upgradeDiv.innerHTML += `
                    <div style="margin-top:10px; border-top:1px solid #333; padding-top:8px;">
                        <p style="color:#aaa; font-size:12px; margin:0 0 4px 0;">Gadgets: ${ownedGadgets.length}/${gadgetKeys.length} owned</p>
                        ${gadgetRows}
                    </div>`;

                upgradeDiv.querySelectorAll('.pd-gadget-buy').forEach(btn => {
                    btn.onclick = () => {
                        const key = btn.getAttribute('data-gadget');
                        if (buyGadget(key)) {
                            showPlayerDetail(playerId);
                        }
                    };
                });
                // Attach upgrade button onclick AFTER all innerHTML is set
                const uBtn = upgradeDiv.querySelector('#pd-upgrade-btn');
                if (uBtn) {
                    uBtn.onclick = () => {
                        const upgraded = upgradePlayer(playerId);
                        if (upgraded) {
                            showPlayerDetail(playerId);
                            updatePlayerMenu();
                        } else {
                            const latestCost = getUpgradeCost(playerId);
                            const s = toSafeInt(energySparks);
                            const c = toSafeInt(playerCoins);
                            if (latestCost) {
                                showLootboxPopup(`Need âš¡ ${latestCost.sparks} and ðŸ’° ${latestCost.coins}. You have âš¡ ${s} and ðŸ’° ${c}.`);
                            }
                        }
                    };
                }
            }

            // Select button
            const selectBtn = document.getElementById('pd-select-btn');
            selectBtn.textContent = !isUnlocked ? 'ðŸ”’ Locked' : (isSelected ? 'âœ… Selected' : 'Select');
            selectBtn.disabled = !isUnlocked || isSelected;
            selectBtn.style.background = (!isUnlocked || isSelected) ? '#555' : '#ffcc00';
            selectBtn.style.color = (!isUnlocked || isSelected) ? '#888' : '#000';
            selectBtn.onclick = () => {
                if (isUnlocked && !isSelected) {
                    selectedNexusId = playerId;
                    saveProgress();
                    updatePlayerMenu();
                    showPlayerDetail(playerId);
                    updateCharShowcase();
                }
            };

            // Close button
            document.getElementById('pd-close-btn').onclick = () => {
                popup.style.display = 'none';
            };
            const pdBackBtn = document.getElementById('pd-back-btn');
            if (pdBackBtn) {
                pdBackBtn.onclick = () => {
                    popup.style.display = 'none';
                };
            }
            // Click backdrop to close
            popup.onclick = (e) => {
                if (e.target === popup) popup.style.display = 'none';
            };

            popup.style.display = 'flex';
        }

        // Game Modes
        function initGameModes() {
            document.getElementById('game-mode-btn').addEventListener('click', () => {
                document.getElementById('game-modes-container').style.display = 'block';
            });

            document.getElementById('close-modes-btn').addEventListener('click', () => {
                document.getElementById('game-modes-container').style.display = 'none';
            });

            document.querySelectorAll('.mode-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.mode-card').forEach(c => c.style.background = '');
                    card.style.background = 'rgba(255, 204, 0, 0.3)';
                    currentGameMode = card.dataset.mode;
                });
            });
        }

        // Mouse shooting
        let lastMouseWorldX = 0, lastMouseWorldY = 0;
        function initMouseShooting() {
            function stopMouseAim() {
                mouseShootAimActive = false;
            }

            gameCanvas.addEventListener('mousemove', (e) => {
                if (!gameStarted) return;
                const rect = gameCanvas.getBoundingClientRect();
                lastMouseWorldX = e.clientX - rect.left + camera.x;
                lastMouseWorldY = e.clientY - rect.top + camera.y;
                if (mouseShootAimActive) {
                    mouseShootAimWorldX = lastMouseWorldX;
                    mouseShootAimWorldY = lastMouseWorldY;
                }
            });
            gameCanvas.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (!gameStarted || !player || player.currentHp <= 0) return;
                const rect = gameCanvas.getBoundingClientRect();
                const targetX = e.clientX - rect.left + camera.x;
                const targetY = e.clientY - rect.top + camera.y;
                lastMouseWorldX = targetX;
                lastMouseWorldY = targetY;
                mouseShootAimWorldX = targetX;
                mouseShootAimWorldY = targetY;
                mouseShootAimActive = true;
                playerShoot(targetX, targetY);
            });

            document.addEventListener('mouseup', (e) => {
                if (e.button !== 0) return;
                if (!mouseShootAimActive) return;
                stopMouseAim();
            });

            window.addEventListener('blur', stopMouseAim);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) stopMouseAim();
            });
        }

        // Supers that need the aim joystick on mobile
        const DIRECTIONAL_SUPERS = new Set(['firedash', 'piercebeam', 'bigshot', 'meteorstorm', 'firezone', 'tornado', 'rockrush', 'shadowburst', 'smokezone', 'icestorm', 'darkrift']);

        function initSuperButton() {
            const btn = document.getElementById('super-btn');
            const aimCanvas = document.getElementById('super-aim-canvas');
            const aimCtx = aimCanvas.getContext('2d');
            let aimActive = false;
            let curX = 0, curY = 0;

            function resizeAimCanvas() {
                aimCanvas.width = window.innerWidth;
                aimCanvas.height = window.innerHeight;
            }
            resizeAimCanvas();
            window.addEventListener('resize', resizeAimCanvas);

            function drawAimArrow() {
                aimCtx.clearRect(0, 0, aimCanvas.width, aimCanvas.height);
                if (!player) return;
                const originX = player.x + player.size / 2 - camera.x;
                const originY = player.y + player.size / 2 - camera.y;
                const dx = curX - originX, dy = curY - originY;
                const len = Math.hypot(dx, dy);
                if (len < 8) return;
                const nx = dx / len, ny = dy / len;
                drawAttackPreviewLines(aimCtx, {
                    originX,
                    originY,
                    dirX: nx,
                    dirY: ny,
                    range: player.laserRange,
                    attackType: player.attackType || 'standard',
                    lineColor: 'rgba(255, 200, 0, 0.88)',
                    shadowColor: 'rgba(255, 200, 0, 0.7)',
                    endpointColor: 'rgba(255, 220, 90, 0.95)',
                    dash: [8, 6]
                });

                aimCtx.save();
                // Arrowhead
                aimCtx.fillStyle = '#ffcc00';
                aimCtx.beginPath();
                const ax = curX - nx * 18, ay = curY - ny * 18;
                const px = -ny * 9, py = nx * 9;
                aimCtx.moveTo(curX, curY);
                aimCtx.lineTo(ax + px, ay + py);
                aimCtx.lineTo(ax - px, ay - py);
                aimCtx.closePath();
                aimCtx.fill();
                // Origin circle
                aimCtx.beginPath();
                aimCtx.arc(originX, originY, 22, 0, Math.PI * 2);
                aimCtx.strokeStyle = 'rgba(255,200,0,0.5)';
                aimCtx.lineWidth = 2;
                aimCtx.stroke();
                aimCtx.restore();
            }

            function fireDirectional() {
                aimCanvas.style.display = 'none';
                aimCtx.clearRect(0, 0, aimCanvas.width, aimCanvas.height);
                aimActive = false;
                if (!player) return;
                const originX = player.x + player.size / 2 - camera.x;
                const originY = player.y + player.size / 2 - camera.y;
                const dx = curX - originX, dy = curY - originY;
                const len = Math.hypot(dx, dy);
                const worldTX = len < 10
                    ? player.x + player.size / 2 + 200
                    : player.x + player.size / 2 + (dx / len) * 400;
                const worldTY = len < 10
                    ? player.y + player.size / 2
                    : player.y + player.size / 2 + (dy / len) * 400;
                activateSuper(player, worldTX, worldTY);
            }

            function beginDirectionalAim(clientX, clientY) {
                aimActive = true;
                curX = clientX;
                curY = clientY;
                aimCanvas.width = window.innerWidth;
                aimCanvas.height = window.innerHeight;
                aimCanvas.style.display = 'block';
                drawAimArrow();
            }

            function tryUseSuperFromPoint(clientX, clientY) {
                if (isOnboardingActive() && onboardingStepIndex === 2) {
                    const arenaEl = document.getElementById('onboarding-arena');
                    if (arenaEl) {
                        const r = arenaEl.getBoundingClientRect();
                        const dx = clientX - (r.left + onboardingArena.x);
                        const dy = clientY - (r.top + onboardingArena.y);
                        aimOnboardingPlayer(dx, dy);
                        attemptOnboardingSuper(dx, dy);
                    } else {
                        attemptOnboardingSuper(onboardingArena.aimX, onboardingArena.aimY);
                    }
                    return;
                }
                if (!gameStarted || !player || player.superCharge < 100 || player.superCooldown > 0) return;
                const type = player.superType || 'burst';
                if (DIRECTIONAL_SUPERS.has(type)) {
                    beginDirectionalAim(clientX, clientY);
                } else {
                    activateSuper(player, lastMouseWorldX || player.x + 200, lastMouseWorldY || player.y);
                }
            }

            // Touch: drag to aim directional supers
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tryUseSuperFromPoint(e.touches[0].clientX, e.touches[0].clientY);
            }, { passive: false });

            btn.addEventListener('touchmove', (e) => {
                if (!aimActive) return;
                e.preventDefault();
                curX = e.touches[0].clientX;
                curY = e.touches[0].clientY;
                drawAimArrow();
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                if (!aimActive) return;
                e.preventDefault();
                fireDirectional();
            }, { passive: false });

            // Desktop: drag with mouse to aim directional supers.
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                tryUseSuperFromPoint(e.clientX, e.clientY);
            });

            document.addEventListener('mousemove', (e) => {
                if (!aimActive) return;
                curX = e.clientX;
                curY = e.clientY;
                drawAimArrow();
            });

            document.addEventListener('mouseup', () => {
                if (!aimActive) return;
                fireDirectional();
            });

            window.addEventListener('blur', () => {
                if (!aimActive) return;
                aimActive = false;
                aimCanvas.style.display = 'none';
                aimCtx.clearRect(0, 0, aimCanvas.width, aimCanvas.height);
            });
        }

        // Initialize everything
        function updateCharShowcase() {
            const pd = playersData[selectedNexusId];
            if (!pd) return;
            const rc = rarityColors[pd.rarity] || '#b0b0b0';
            const rl = rarityLabels[pd.rarity] || 'Common';
            const bonus = getStatBonus(selectedNexusId);
            const imgEl = document.getElementById('char-showcase-img');
            const imgWrapEl = document.getElementById('char-showcase-img-wrap');
            const nameEl = document.getElementById('char-showcase-name');
            const rarityEl = document.getElementById('char-showcase-rarity');
            const statsEl = document.getElementById('char-showcase-stats');
            if (!imgEl || !imgWrapEl || !nameEl || !rarityEl || !statsEl) return;
            const showcaseSrc = getPlayerPreferredImageSrc(pd);
            imgEl.src = showcaseSrc || '';
            imgEl.style.display = showcaseSrc ? 'block' : 'none';
            imgWrapEl.style.borderColor = rc;
            nameEl.textContent = pd.name;
            rarityEl.textContent = rl;
            rarityEl.style.color = rc;
            statsEl.innerHTML =
                `HP ${Math.round(pd.hp * bonus * COMBAT_STAT_SCALE)}<br>DMG ${Math.round(pd.laserDamage * bonus * COMBAT_STAT_SCALE)} &nbsp;SPD ${pd.speed} &nbsp;RNG ${pd.laserRange}`;
        }

        function runRegressionChecks() {
            const report = [];
            const failures = [];
            const pass = (label, details) => report.push(`PASS - ${label}${details ? `: ${details}` : ''}`);
            const fail = (label, details) => {
                failures.push({ label, details });
                report.push(`FAIL - ${label}${details ? `: ${details}` : ''}`);
            };

            const invalidPlayers = Object.keys(playersData).filter(id => playersData[id]?.id !== id);
            if (invalidPlayers.length === 0) pass('Player ids match keys');
            else fail('Player ids match keys', invalidPlayers.join(', '));

            const modeKeys = Object.keys(gameModes || {});
            if (modeKeys.length >= 5 && modeKeys.includes('showdown')) pass('Game mode registry', `${modeKeys.length} modes`);
            else fail('Game mode registry', 'Missing expected modes');

            const dailyIds = new Set();
            let badDaily = null;
            for (const c of DAILY_CHALLENGE_DEFS) {
                if (!c?.id || dailyIds.has(c.id) || !Number.isFinite(c.target) || c.target <= 0) {
                    badDaily = c;
                    break;
                }
                dailyIds.add(c.id);
            }
            if (!badDaily) pass('Daily challenge definitions', `${dailyIds.size} valid entries`);
            else fail('Daily challenge definitions', JSON.stringify(badDaily));

            const badTier = chestTiers.find(t => t.upgradeChance < 0 || t.upgradeChance > 1);
            if (!badTier) pass('Chest tier upgrade ranges');
            else fail('Chest tier upgrade ranges', badTier.name || 'unknown tier');

            const sampleSpawns = [];
            let spawnOutOfBounds = false;
            for (let i = 0; i < 20; i++) {
                const pos = getSpawnPosition(40);
                sampleSpawns.push(pos);
                if (pos.x < 0 || pos.y < 0 || pos.x > MAP_WIDTH - 40 || pos.y > MAP_HEIGHT - 40) {
                    spawnOutOfBounds = true;
                    break;
                }
            }
            if (!spawnOutOfBounds) pass('Spawn position bounds', `${sampleSpawns.length} samples`);
            else fail('Spawn position bounds', 'Generated out-of-bounds spawn');

            return {
                ok: failures.length === 0,
                summary: failures.length === 0
                    ? `All ${report.length} checks passed.`
                    : `${failures.length} of ${report.length} checks failed.`,
                lines: report,
                failures
            };
        }

        function applyBalanceSandboxFromInputs() {
            const minInput = document.getElementById('dev-bot-super-min');
            const maxInput = document.getElementById('dev-bot-super-max');
            const shootInput = document.getElementById('dev-bot-shoot-mult');
            const cooldownInput = document.getElementById('dev-bot-cooldown-mult');
            const out = document.getElementById('dev-regression-output');
            if (!minInput || !maxInput || !shootInput || !cooldownInput) return;

            const minMs = Math.max(200, Number(minInput.value) || defaultBalanceSandboxSettings.botSuperMinMs);
            const maxMs = Math.max(minMs + 100, Number(maxInput.value) || defaultBalanceSandboxSettings.botSuperMaxMs);
            const shootMult = Math.max(0.2, Math.min(2.5, Number(shootInput.value) || 1));
            const cooldownMult = Math.max(0.5, Math.min(2.5, Number(cooldownInput.value) || 1));

            balanceSandboxSettings.botSuperMinMs = minMs;
            balanceSandboxSettings.botSuperMaxMs = maxMs;
            balanceSandboxSettings.botShootChanceMultiplier = shootMult;
            balanceSandboxSettings.botCooldownMultiplier = cooldownMult;

            minInput.value = String(minMs);
            maxInput.value = String(maxMs);
            shootInput.value = shootMult.toFixed(2);
            cooldownInput.value = cooldownMult.toFixed(2);

            if (out) {
                out.textContent = [
                    'Applied sandbox settings.',
                    `super gap: ${minMs}-${maxMs}ms`,
                    `shoot chance x: ${shootMult.toFixed(2)}`,
                    `cooldown x: ${cooldownMult.toFixed(2)}`
                ].join('\n');
            }
        }

        function resetBalanceSandboxInputs() {
            balanceSandboxSettings.botSuperMinMs = defaultBalanceSandboxSettings.botSuperMinMs;
            balanceSandboxSettings.botSuperMaxMs = defaultBalanceSandboxSettings.botSuperMaxMs;
            balanceSandboxSettings.botShootChanceMultiplier = defaultBalanceSandboxSettings.botShootChanceMultiplier;
            balanceSandboxSettings.botCooldownMultiplier = defaultBalanceSandboxSettings.botCooldownMultiplier;

            const minInput = document.getElementById('dev-bot-super-min');
            const maxInput = document.getElementById('dev-bot-super-max');
            const shootInput = document.getElementById('dev-bot-shoot-mult');
            const cooldownInput = document.getElementById('dev-bot-cooldown-mult');
            if (minInput) minInput.value = String(balanceSandboxSettings.botSuperMinMs);
            if (maxInput) maxInput.value = String(balanceSandboxSettings.botSuperMaxMs);
            if (shootInput) shootInput.value = balanceSandboxSettings.botShootChanceMultiplier.toFixed(2);
            if (cooldownInput) cooldownInput.value = balanceSandboxSettings.botCooldownMultiplier.toFixed(2);
        }

        function initDevSandbox() {
            const toggleBtn = document.getElementById('dev-sandbox-toggle');
            const panel = document.getElementById('dev-sandbox-panel');
            const closeBtn = document.getElementById('close-dev-sandbox-panel');
            const applyBtn = document.getElementById('dev-sandbox-apply');
            const resetBtn = document.getElementById('dev-sandbox-reset');
            const runBtn = document.getElementById('dev-run-regression');
            const out = document.getElementById('dev-regression-output');
            if (!toggleBtn || !panel || !closeBtn || !applyBtn || !resetBtn || !runBtn || !out) return;

            if (toggleBtn.dataset.bound === '1') return;

            let unlockBuffer = '';
            const openPanel = () => {
                panel.style.display = 'block';
                resetBalanceSandboxInputs();
            };
            const closePanel = () => {
                panel.style.display = 'none';
            };

            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
                    toggleBtn.classList.toggle('visible');
                }
                if (e.key === 'Escape' && panel.style.display === 'block') {
                    closePanel();
                }
                if (e.key && e.key.length === 1) {
                    unlockBuffer = (unlockBuffer + e.key.toLowerCase()).slice(-3);
                    if (unlockBuffer === 'dev') {
                        toggleBtn.classList.add('visible');
                    }
                }
            });

            toggleBtn.addEventListener('click', openPanel);
            closeBtn.addEventListener('click', closePanel);
            applyBtn.addEventListener('click', applyBalanceSandboxFromInputs);
            resetBtn.addEventListener('click', () => {
                resetBalanceSandboxInputs();
                out.textContent = 'Sandbox settings reset to defaults.';
            });
            runBtn.addEventListener('click', () => {
                const result = runRegressionChecks();
                out.textContent = [result.summary, ...result.lines].join('\n');
            });

            toggleBtn.dataset.bound = '1';
            resetBalanceSandboxInputs();
        }

        function initOutsideClickCloseMenus() {
            if (document.body.dataset.outsideCloseBound === '1') return;

            const closablePanelIds = [
                'profile-panel',
                'level-rewards-panel',
                'daily-panel',
                'history-panel',
                'tutorial-panel',
                'medal-road-panel',
                'credits-panel',
                'player-menu',
                'map-select-panel',
                'dev-sandbox-panel'
            ];

            document.addEventListener('pointerdown', (e) => {
                const target = e.target;

                for (const panelId of closablePanelIds) {
                    const panel = document.getElementById(panelId);
                    if (!panel) continue;
                    if (getComputedStyle(panel).display === 'none') continue;
                    if (panel.contains(target)) continue;
                    panel.style.display = 'none';
                }

                const bazzarOverlay = document.getElementById('bazzar-overlay');
                const bazzarPanel = document.getElementById('bazzar-panel');
                if (bazzarOverlay && bazzarPanel && getComputedStyle(bazzarOverlay).display !== 'none') {
                    if (!bazzarPanel.contains(target)) {
                        bazzarOverlay.style.display = 'none';
                    }
                }

                const accountChip = document.getElementById('account-chip');
                if (accountChipLevelExpanded && accountChip && !accountChip.contains(target)) {
                    accountChipLevelExpanded = false;
                    updateAccountChip();
                }
            });

            document.body.dataset.outsideCloseBound = '1';
        }

        function initGame() {
            const runInitStep = (name, fn) => {
                try {
                    fn();
                } catch (err) {
                    console.error(`Init step failed: ${name}`, err);
                    const debugEl = document.getElementById('debug-status');
                    if (debugEl) {
                        debugEl.style.display = 'block';
                        debugEl.textContent = `Init warning (${name}): ${err && err.message ? err.message : 'unknown error'}`;
                    }
                }
            };

            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            preloadImages(); // Preload images first
            runInitStep('joysticks', () => initJoysticks());
            runInitStep('game modes', () => initGameModes());
            runInitStep('mouse shooting', () => initMouseShooting());
            runInitStep('super button', () => initSuperButton());

            // Mobile gadget button
            (function initGadgetButton() {
                const btn = document.getElementById('gadget-btn');
                if (!btn) return;
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (isOnboardingActive() && onboardingStepIndex === 3) {
                        attemptOnboardingGadget(onboardingArena.aimX, onboardingArena.aimY);
                        renderOnboardingStep();
                        return;
                    }
                    if (player && (player.gadgetCooldown || 0) <= 0) {
                        activateGadget(player, lastMouseWorldX, lastMouseWorldY);
                    }
                }, { passive: false });
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (isOnboardingActive() && onboardingStepIndex === 3) {
                        attemptOnboardingGadget(onboardingArena.aimX, onboardingArena.aimY);
                        renderOnboardingStep();
                        return;
                    }
                    if (player && (player.gadgetCooldown || 0) <= 0) {
                        activateGadget(player, lastMouseWorldX, lastMouseWorldY);
                    }
                });
            })();
            runInitStep('bazaar', () => initBazaar());
            runInitStep('modal close buttons', () => initModalCloseXButtons());
            runInitStep('credits panel', () => initCreditsPanel());
            runInitStep('player menu', () => initPlayerMenu());
            runInitStep('profile panel', () => initProfilePanel());
            runInitStep('discover maps', () => discoverMaps());
            runInitStep('level rewards', () => initLevelRewards());
            runInitStep('onboarding flow', () => initOnboardingFlow());
            runInitStep('tutorial reward flow', () => initTutorialRewardFlow());
            runInitStep('tutorial check flow', () => initTutorialCheckFlow());
            runInitStep('experience choice flow', () => initExperienceChoiceFlow());
            runInitStep('developer sandbox', () => initDevSandbox());
            runInitStep('outside click close menus', () => initOutsideClickCloseMenus());
            runInitStep('account system', () => initAccountSystem());
            runInitStep('show coins', () => showCoins());
            runInitStep('character showcase', () => updateCharShowcase());

            const experienceChoice = storageGetItem('experienceChoice');
            if (!experienceChoice) {
                setTimeout(() => {
                    if (!gameStarted) openExperienceChoiceFlow();
                    ensureMainMenuVisible();
                }, 150);
            } else if (storageGetItem('tutorialSeen') !== 'true') {
                setTimeout(() => {
                    if (!gameStarted) startOnboardingFlow();
                    ensureMainMenuVisible();
                }, 150);
            } else {
                showAllUI();
            }
            ensureMainMenuVisible();
            //hide joystick on first screen
            const moveJoy = document.getElementById('joystick-container');
            const shootJoy = document.getElementById('shoot-joystick-container');
            if (!isOnboardingActive()) {
                if (moveJoy) moveJoy.style.display = 'none';
                if (shootJoy) shootJoy.style.display = 'none';
            }

            // Start game button
            const startBtn = document.getElementById('start-btn');
            if (startBtn) startBtn.addEventListener('click', startGame);

            const closeMapSelectBtn = document.getElementById('close-map-select');
            const mapSelectPanel = document.getElementById('map-select-panel');
            if (closeMapSelectBtn && mapSelectPanel) {
                closeMapSelectBtn.addEventListener('click', () => {
                    mapSelectPanel.style.display = 'none';
                });
            }

            // Return to menu button
            const returnToMenuBtn = document.getElementById('return-to-menu');
            if (returnToMenuBtn) returnToMenuBtn.addEventListener('click', () => {
                // Hide game over overlay
                const gameOverOverlay = document.getElementById('game-over-overlay');
                const leaderboard = document.getElementById('leaderboard');
                const stardropOverlay = document.getElementById('stardrop-overlay');
                if (gameOverOverlay) gameOverOverlay.style.display = 'none';
                if (leaderboard) leaderboard.style.display = 'none';
                if (stardropOverlay) stardropOverlay.style.display = 'none';

                // Remove game-active class to hide joysticks
                document.body.classList.remove('game-active');

                // Show main menu UI
                const guideEl = document.querySelector('.guide');
                const menuEl = document.querySelector('.menu');
                if (guideEl) guideEl.style.display = 'block';
                if (menuEl) menuEl.style.display = 'flex';

                // Hide joysticks explicitly
                if (moveJoy) moveJoy.style.display = 'none';
                if (shootJoy) shootJoy.style.display = 'none';

                // Reset camera and clear frame so stale battle visuals are not left on menu.
                camera = { x: 0, y: 0, width: gameCanvas.width, height: gameCanvas.height };
                ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

                showAllUI();
                updateCharShowcase();
                renderDailyWinsWidget();
                if (pendingStarDrops > 0 && (!stardropOverlay || stardropOverlay.style.display !== 'flex')) {
                    setTimeout(() => showStarDrop(), 350);
                }
            });

            // Debug
            function setDebug(msg) {
                document.getElementById('debug-status').textContent = msg;
            }
            setDebug('Game Ready - Click Battle!');
;
        }

        // Start the game when page loads
        window.addEventListener('load', initGame);
