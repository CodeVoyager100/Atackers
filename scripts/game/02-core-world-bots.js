        function normalizePlayerSelectionState() {
            if (!Array.isArray(unlockedNexus)) unlockedNexus = ['default'];
            unlockedNexus = unlockedNexus.filter(id => typeof id === 'string' && !!playersData[id]);
            if (!unlockedNexus.includes('default')) unlockedNexus.unshift('default');

            if (typeof selectedNexusId !== 'string' || !playersData[selectedNexusId]) {
                selectedNexusId = unlockedNexus[0] || 'default';
            }
            if (!unlockedNexus.includes(selectedNexusId)) unlockedNexus.unshift(selectedNexusId);

            storageSetItem('unlockedNexus', JSON.stringify(unlockedNexus));
            storageSetItem('selectedNexusId', selectedNexusId);
        }

        normalizePlayerSelectionState();

        function hasUnlockedRarity(rarity) {
            return Object.values(playersData).some(p => p.rarity === rarity && unlockedNexus.includes(p.id));
        }

        const gameModes = deepCloneConfig(
            externalGameData.gameModes,
            {
                easyStage: { name: 'Easy Stage', maxPlayers: 4, teams: false, fillBots: true, easyStage: true },
                showdown: { name: 'Showdown', maxPlayers: 10, teams: false, fillBots: true },
                '3v3': { name: '3v3 Team Battle', maxPlayers: 18, teams: true, teamSize: 3, teamNames: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'], fillBots: true },
                '2v2': { name: '2v2 Team Battle', maxPlayers: 10, teams: true, teamSize: 2, teamNames: ['red', 'blue', 'green', 'yellow', 'purple'], fillBots: true },
                ballGoal: { name: 'Ball-Goal', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true },
                bounty: { name: 'Bounty', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true, bountyMode: true },
                elimination: { name: 'Elimination', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true, noRespawn: true },
                kingTown: { name: 'King of the Town', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true },
                zoneCapture: { name: 'Zone Capture', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true }
            }
        );

        const teamColors = {
            red: '#ff4444',
            blue: '#4488ff',
            green: '#44cc44',
            yellow: '#ffcc00',
            purple: '#b065ff',
            orange: '#ff9740'
        };
        const teamScoreboardColors = {
            red: '#ff6666',
            blue: '#6699ff',
            green: '#66dd66',
            yellow: '#ffdd66',
            purple: '#cd93ff',
            orange: '#ffb16b'
        };

        // Input handling
        const keysPressed = {};
        function setMovementKeyFromCode(code, isDown) {
            if (code === 'KeyW') keysPressed['w'] = isDown;
            else if (code === 'KeyA') keysPressed['a'] = isDown;
            else if (code === 'KeyS') keysPressed['s'] = isDown;
            else if (code === 'KeyD') keysPressed['d'] = isDown;
            else if (code === 'ArrowUp') keysPressed['arrowup'] = isDown;
            else if (code === 'ArrowLeft') keysPressed['arrowleft'] = isDown;
            else if (code === 'ArrowDown') keysPressed['arrowdown'] = isDown;
            else if (code === 'ArrowRight') keysPressed['arrowright'] = isDown;
        }
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            keysPressed[k] = true;
            setMovementKeyFromCode(e.code, true);
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            keysPressed[k] = false;
            setMovementKeyFromCode(e.code, false);
        });

        // Core game functions
        function resizeCanvas() {
            gameCanvas.width = window.innerWidth;
            gameCanvas.height = window.innerHeight;
            camera.width = window.innerWidth;
            camera.height = window.innerHeight;
        }

        // ADD MISSING CAMERA FUNCTION
        function updateCamera() {
            if (!player) return;

            let focusTarget = player;

            // If player is dead in team play, follow a living teammate.
            if (player.currentHp <= 0 && player.team) {
                const livingTeammate = players.find(t => t !== player && t.team === player.team && t.currentHp > 0);
                if (livingTeammate) focusTarget = livingTeammate;
                else focusTarget = player;
            }

            // Center camera on focus target
            camera.x = focusTarget.x + focusTarget.size / 2 - camera.width / 2;
            camera.y = focusTarget.y + focusTarget.size / 2 - camera.height / 2;

            // Keep camera within map bounds
            camera.x = Math.max(0, Math.min(camera.x, MAP_WIDTH - camera.width));
            camera.y = Math.max(0, Math.min(camera.y, MAP_HEIGHT - camera.height));

            // Hit-shake when the human player takes or deals damage.
            if (screenShakeTimer > 0) {
                const shakeX = (Math.random() * 2 - 1) * screenShakeStrength;
                const shakeY = (Math.random() * 2 - 1) * screenShakeStrength;
                // Apply shake without re-clamping so it is always visible
                camera.x += shakeX;
                camera.y += shakeY;
                screenShakeTimer--;
                screenShakeStrength = Math.max(1.5, screenShakeStrength * 0.82);
            }
        }

        function getDistance(x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        }

        function getSpawnShieldFrames() {
            // 2-4 seconds at 60fps
            return 120 + Math.floor(Math.random() * 121);
        }

        function hasDamageShield(target) {
            return !!(target && (target.superInvincible || (target.spawnShieldTimer || 0) > 0));
        }

        function registerDamageFeedback(target, amount, color = '#ff6666') {
            if (!target || amount <= 0) return;
            damagePopups.push({
                x: target.x + target.size / 2 + (Math.random() - 0.5) * 16,
                y: target.y - 8,
                text: `-${Math.round(amount)}`,
                color,
                timer: 36,
                vy: -0.55
            });
            if (damagePopups.length > 80) damagePopups.shift();

            if (target === player || target.isHuman) {
                // Taking damage â€” strong shake, scales with hit size
                screenShakeTimer = Math.max(screenShakeTimer, 28);
                screenShakeStrength = Math.min(36, Math.max(screenShakeStrength, 14 + Math.sqrt(amount) * 0.22));
            }
        }

        function isKnockoutTeamMode(mode = currentGameMode) {
            return mode === '2v2' || mode === '3v3' || mode === 'elimination';
        }

        function getRespawnFramesForMode() {
            if (isKnockoutTeamMode() || currentGameMode === 'showdown' || currentGameMode === 'easyStage') return 0;
            return currentGameMode === 'bounty' ? 300 : 900;
        }

        function checkCollisionWithRect(rect1, rect2) {
            return rect1.x < rect2.x + rect2.width &&
                rect1.x + rect1.size > rect2.x &&
                rect1.y < rect2.y + rect2.height &&
                rect1.y + rect1.size > rect2.y;
        }

        function canWalkOnWater(entity) {
            const charId = entity?.characterId || entity?.id;
            if (!charId) return false;
            return ['fidas', 'kleftros', 'kapnas', 'tornader'].includes(charId);
        }

        function isBlockingObstacleForEntity(entity, obs) {
            if (obs.type === 'water' && canWalkOnWater(entity)) return false;
            return true;
        }

        function canEntityMoveTo(entity, x, y) {
            const testRect = { x, y, size: entity.size };
            for (const obs of obstacles) {
                if (!isBlockingObstacleForEntity(entity, obs)) continue;
                if (checkCollisionWithRect(testRect, obs)) return false;
            }
            return true;
        }

        function displaceEntitySafely(entity, deltaX, deltaY, stepSize = 10) {
            if (!entity || (deltaX === 0 && deltaY === 0)) return;
            const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / stepSize));
            const stepX = deltaX / steps;
            const stepY = deltaY / steps;

            for (let s = 0; s < steps; s++) {
                const nextX = Math.max(0, Math.min(MAP_WIDTH - entity.size, entity.x + stepX));
                if (canEntityMoveTo(entity, nextX, entity.y)) {
                    entity.x = nextX;
                }

                const nextY = Math.max(0, Math.min(MAP_HEIGHT - entity.size, entity.y + stepY));
                if (canEntityMoveTo(entity, entity.x, nextY)) {
                    entity.y = nextY;
                }
            }
        }

        // Only selected supers are allowed to break map environment (walls/bushes).
        const SUPER_ENV_BREAKERS = new Set(['boboshiros', 'kafekauboy', 'kleftikomegazord', 'petras']);

        function canEntitySuperBreakEnvironment(entity) {
            const charId = entity?.characterId || entity?.id;
            if (!charId) return false;
            return SUPER_ENV_BREAKERS.has(charId);
        }

        function canLaserBreakEnvironment(laser) {
            if (!laser?.isSuperLaser) return false;
            return canEntitySuperBreakEnvironment(laser.shooter);
        }

        function canSuperEffectBreakEnvironment(fx) {
            return canEntitySuperBreakEnvironment(fx?.shooter);
        }

        // NEW: Check if a position is valid (not inside obstacles)
        function isValidSpawnPosition(x, y, size) {
            for (let obs of obstacles) {
                if (x < obs.x + obs.width &&
                    x + size > obs.x &&
                    y < obs.y + obs.height &&
                    y + size > obs.y) {
                    return false;
                }
            }
            return true;
        }

        function getSpawnPosition(size) {
            const padding = 100;
            let attempts = 0;
            let pos;

            // Keep trying until we find a valid position not inside obstacles
            do {
                pos = {
                    x: padding + Math.random() * (MAP_WIDTH - padding * 2 - size),
                    y: padding + Math.random() * (MAP_HEIGHT - padding * 2 - size)
                };
                attempts++;
            } while (!isValidSpawnPosition(pos.x, pos.y, size) && attempts < 50);

            return pos;
        }

        // Initialize health for obstacles (destructible system)
        function initializeObstacleHealth(obs) {
            if (obs.type === 'brick') {
                obs.maxHealth = 30;
                obs.health = 30;
            } else if (obs.type === 'water') {
                obs.maxHealth = 30;
                obs.health = 30;
            }
            return obs;
        }

        // Damage an obstacle and return true if destroyed
        function damageObstacle(obs, damage) {
            if (!obs || obs.type === 'invisible' || obs.type === 'metal') return false; // metal is indestructible
            if (!('health' in obs)) {
                // Some editor-loaded maps may not include health fields; initialize lazily.
                if (obs.type === 'brick' || obs.type === 'water' || obs.type === 'wall') {
                    initializeObstacleHealth(obs);
                    if (!('health' in obs)) {
                        obs.maxHealth = 30;
                        obs.health = 30;
                    }
                } else {
                    return false;
                }
            }
            obs.health -= damage;
            return obs.health <= 0;
        }

        // Damage all obstacles in radius from a super effect
        function damageObstaclesInRadius(x, y, radius, damage) {
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                // Center of obstacle
                const obsX = obs.x + obs.width / 2;
                const obsY = obs.y + obs.height / 2;
                const dist = Math.hypot(obsX - x, obsY - y);
                if (dist < radius + Math.max(obs.width, obs.height) / 2) {
                    if (damageObstacle(obs, damage)) {
                        obstacles.splice(i, 1); // Remove destroyed obstacle
                    }
                }
            }
        }

        // Break bushes in radius
        function breakBushesInRadius(x, y, radius) {
            for (let i = bushes.length - 1; i >= 0; i--) {
                const bush = bushes[i];
                const bw = bush.width !== undefined ? bush.width : (bush.size || 50);
                const bh = bush.height !== undefined ? bush.height : (bush.size || 50);
                const bushX = bush.x + bw / 2;
                const bushY = bush.y + bh / 2;
                const dist = Math.hypot(bushX - x, bushY - y);
                if (dist < radius + Math.max(bw, bh) / 2) {
                    bushes.splice(i, 1);
                }
            }
        }

        function generateObstacles() {
            obstacles = [];
            const isTeamSideMode = currentGameMode === '3v3' || currentGameMode === '2v2';
            if (isTeamSideMode) {
                // Fixed symmetric water walls â€” 400px from each horizontal edge, centred vertically
                // Left water
                obstacles.push(initializeObstacleHealth({ x: 400, y: 750, width: 50, height: 500, type: 'water' }));
                // Right water (mirrored)
                obstacles.push(initializeObstacleHealth({ x: 1550, y: 750, width: 50, height: 500, type: 'water' }));

                // Central water pool (200Ã—200)
                obstacles.push(initializeObstacleHealth({ x: 900, y: 900, width: 200, height: 200, type: 'water' }));

                // 4 corner walls (50Ã—50) at the outer corners of the bush strips
                obstacles.push(initializeObstacleHealth({ x: 850, y: 850, width: 50, height: 50, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1100, y: 850, width: 50, height: 50, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 850, y: 1100, width: 50, height: 50, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1100, y: 1100, width: 50, height: 50, type: 'brick' }));

                // Top walls (y=300): left group x=300â€“800, right group x=1200â€“1700
                obstacles.push(initializeObstacleHealth({ x: 300, y: 300, width: 500, height: 50, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1200, y: 300, width: 500, height: 50, type: 'brick' }));
                // Bottom walls (y=1650): left group, right group
                obstacles.push(initializeObstacleHealth({ x: 300, y: 1650, width: 500, height: 50, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1200, y: 1650, width: 500, height: 50, type: 'brick' }));

                // Mid-lane extra cover to make team maps feel less empty
                obstacles.push(initializeObstacleHealth({ x: 640, y: 900, width: 80, height: 200, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1280, y: 900, width: 80, height: 200, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 860, y: 640, width: 280, height: 50, type: 'metal' }));
                obstacles.push(initializeObstacleHealth({ x: 860, y: 1310, width: 280, height: 50, type: 'metal' }));
                obstacles.push(initializeObstacleHealth({ x: 760, y: 970, width: 80, height: 60, type: 'water' }));
                obstacles.push(initializeObstacleHealth({ x: 1160, y: 970, width: 80, height: 60, type: 'water' }));
                obstacles.push(initializeObstacleHealth({ x: 520, y: 620, width: 70, height: 140, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1410, y: 620, width: 70, height: 140, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 520, y: 1240, width: 70, height: 140, type: 'brick' }));
                obstacles.push(initializeObstacleHealth({ x: 1410, y: 1240, width: 70, height: 140, type: 'brick' }));
                return;
            }
            const obstacleCount = currentGameMode === 'ballGoal' ? 14 : 34;
            const edgeClear = 200;
            let attempts = 0;
            let placed = 0;
            while (placed < obstacleCount && attempts < obstacleCount * 20) {
                attempts++;
                const w = 60 + Math.random() * 60;
                const h = 60 + Math.random() * 60;
                const x = Math.random() * (MAP_WIDTH - 100);
                const y = Math.random() * (MAP_HEIGHT - 100);
                if (x < edgeClear || x + w > MAP_WIDTH - edgeClear ||
                    y < edgeClear || y + h > MAP_HEIGHT - edgeClear) continue;
                const r = Math.random();
                const type = r < 0.4 ? 'brick' : r < 0.8 ? 'water' : 'metal';
                const obs = { x, y, width: w, height: h, type };
                initializeObstacleHealth(obs);
                obstacles.push(obs);
                placed++;
            }
        }

        function generateHealthPacks(fixedCrateSpawns = null) {
            healthPacks = [];
            crateBoxes = [];
            pickupItems = [];
            if (Array.isArray(fixedCrateSpawns) && fixedCrateSpawns.length > 0) {
                for (const s of fixedCrateSpawns) {
                    const x = Math.max(0, Math.min(MAP_WIDTH - 44, (s.x || 0) - 22));
                    const y = Math.max(0, Math.min(MAP_HEIGHT - 44, (s.y || 0) - 22));
                    crateBoxes.push({ x, y, size: 44, hp: 4, maxHp: 4, spawnX: x, spawnY: y });
                }
                const fixedPackCount = currentGameMode === 'ballGoal' ? 4 : 6;
                for (let i = 0; i < fixedPackCount; i++) {
                    const pos = getSpawnPosition(26);
                    healthPacks.push({ x: pos.x, y: pos.y, size: 26, healAmount: Math.round(8 * COMBAT_STAT_SCALE) });
                }
                return;
            }
            // Spawn 10 destructible crates instead of plain health packs
            for (let i = 0; i < 10; i++) {
                const pos = getSpawnPosition(44);
                crateBoxes.push({ x: pos.x, y: pos.y, size: 44, hp: 4, maxHp: 4 });
            }

            // Also spawn classic direct heal packs across the map
            const packCount = currentGameMode === 'ballGoal' ? 4 : 6;
            for (let i = 0; i < packCount; i++) {
                const pos = getSpawnPosition(26);
                healthPacks.push({ x: pos.x, y: pos.y, size: 26, healAmount: Math.round(8 * COMBAT_STAT_SCALE) });
            }
        }

        function generateBushes() {
            bushes = [];
            // For team side modes: fixed layout only, no random
            if (currentGameMode === '3v3' || currentGameMode === '2v2') {
                // Left bush (right of left water, x=450)
                bushes.push({ x: 450, y: 750, width: 50, height: 500 });
                // Right bush (left of right water, x=1500)
                bushes.push({ x: 1500, y: 750, width: 50, height: 500 });

                // Central bushes (200Ã—50) on each side of the central water pool
                bushes.push({ x: 900, y: 850, width: 200, height: 50 });  // top
                bushes.push({ x: 900, y: 1100, width: 200, height: 50 }); // bottom
                bushes.push({ x: 850, y: 900, width: 50, height: 200 });  // left
                bushes.push({ x: 1100, y: 900, width: 50, height: 200 }); // right

                // Top bushes inward of top walls (y=350)
                bushes.push({ x: 300, y: 350, width: 500, height: 50 });
                bushes.push({ x: 1200, y: 350, width: 500, height: 50 });
                // Bottom bushes inward of bottom walls (y=1600)
                bushes.push({ x: 300, y: 1600, width: 500, height: 50 });
                bushes.push({ x: 1200, y: 1600, width: 500, height: 50 });
                return;
            }
            // Place bushes near existing obstacles (walls and lakes)
            for (let obs of obstacles) {
                const bushCount = 1 + Math.floor(Math.random() * 2); // 1-2 bushes per obstacle
                for (let i = 0; i < bushCount; i++) {
                    // Pick a random side of the obstacle
                    const side = Math.floor(Math.random() * 4);
                    let bx, by;
                    const bSize = 50 + Math.random() * 30; // 50-80px
                    if (side === 0) { // top
                        bx = obs.x + Math.random() * obs.width - bSize / 2;
                        by = obs.y - bSize - Math.random() * 20;
                    } else if (side === 1) { // bottom
                        bx = obs.x + Math.random() * obs.width - bSize / 2;
                        by = obs.y + obs.height + Math.random() * 20;
                    } else if (side === 2) { // left
                        bx = obs.x - bSize - Math.random() * 20;
                        by = obs.y + Math.random() * obs.height - bSize / 2;
                    } else { // right
                        bx = obs.x + obs.width + Math.random() * 20;
                        by = obs.y + Math.random() * obs.height - bSize / 2;
                    }
                    // Clamp to map bounds
                    bx = Math.max(10, Math.min(bx, MAP_WIDTH - bSize - 10));
                    by = Math.max(10, Math.min(by, MAP_HEIGHT - bSize - 10));
                    bushes.push({ x: bx, y: by, size: bSize });
                }
            }
            // Add some random bushes scattered around
            const randomBushCount = currentGameMode === 'ballGoal' ? 2 : 6;
            for (let i = 0; i < randomBushCount; i++) {
                const bSize = 50 + Math.random() * 30;
                const pos = getSpawnPosition(bSize);
                bushes.push({ x: pos.x, y: pos.y, size: bSize });
            }
        }

        function isInBush(entity) {
            for (let bush of bushes) {
                const cx = entity.x + entity.size / 2;
                const cy = entity.y + entity.size / 2;
                const bw = bush.width !== undefined ? bush.width : bush.size;
                const bh = bush.height !== undefined ? bush.height : bush.size;
                if (cx > bush.x && cx < bush.x + bw &&
                    cy > bush.y && cy < bush.y + bh) {
                    return true;
                }
            }
            return false;
        }

        function findNearestBush(entity) {
            let nearest = null;
            let minDist = Infinity;
            for (let bush of bushes) {
                const dist = getDistance(entity.x, entity.y, bush.x + bush.size / 2, bush.y + bush.size / 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = bush;
                }
            }
            return nearest;
        }

        // NEW: Check laser collision with obstacles (swept AABB - checks full path)
        function checkLaserObstacleCollision(laser) {
            const canBreakEnvironment = canLaserBreakEnvironment(laser);
            // Use nullish coalescing to handle prevX=0 correctly
            if (laser._prevX === undefined) laser._prevX = laser.x;
            if (laser._prevY === undefined) laser._prevY = laser.y;
            
            // Swept bounding box for the laser's path this frame
            // Add 6px padding so near-zero-height sweeps (horizontal lasers) still register
            const pad = 6;
            const minX = Math.min(laser._prevX, laser.x) - pad;
            const maxX = Math.max(laser._prevX, laser.x) + pad;
            const minY = Math.min(laser._prevY, laser.y) - pad;
            const maxY = Math.max(laser._prevY, laser.y) + pad;

            // Check obstacle array (walls + lakes)
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                if (obs.type === 'invisible') continue;
                if (obs.type === 'water') continue; // Attacks are allowed to travel over water.

                if (maxX >= obs.x && minX <= obs.x + obs.width &&
                    maxY >= obs.y && minY <= obs.y + obs.height) {
                    // Non-breaking attacks are blocked, but do not damage environment.
                    if (canBreakEnvironment) {
                        if (damageObstacle(obs, laser.damage)) {
                            obstacles.splice(i, 1);
                        }
                    }
                    return true;
                }
            }

            // Bushes no longer block lasers â€” attacks pass through freely.
            // (Environment-breaking supers still destroy bushes on direct hit.)

            return false;
        }

        // NEW: Line-rectangle intersection detection
        function lineIntersectsRect(x1, y1, x2, y2, rect) {
            // Check if either end is inside the rectangle
            if ((x1 >= rect.x && x1 <= rect.x + rect.width && y1 >= rect.y && y1 <= rect.y + rect.height) ||
                (x2 >= rect.x && x2 <= rect.x + rect.width && y2 >= rect.y && y2 <= rect.y + rect.height)) {
                return true;
            }

            // Check line intersections with rectangle edges
            const left = lineIntersectsLine(x1, y1, x2, y2, rect.x, rect.y, rect.x, rect.y + rect.height);
            const right = lineIntersectsLine(x1, y1, x2, y2, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height);
            const top = lineIntersectsLine(x1, y1, x2, y2, rect.x, rect.y, rect.x + rect.width, rect.y);
            const bottom = lineIntersectsLine(x1, y1, x2, y2, rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height);

            return left || right || top || bottom;
        }

        // NEW: Line-line intersection detection
        function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
            const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
            if (denominator === 0) return false;

            const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
            const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

            return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
        }

        // â”€â”€ CRATE & PICKUP SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const PICKUP_TYPES = ['heal'];  // Crates now always drop heal packs
        const PICKUP_ICONS = { heal: 'â¤ï¸', speed: 'âš¡', damage: 'ðŸ”¥', shield: 'ðŸ›¡ï¸' };

        function spawnPickupAt(x, y) {
            const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)] || 'heal';
            pickupItems.push({ x: x - 18, y: y - 18, size: 36, type });
        }

        function dropPlayerItems(entity) {
            if (!entity.items || entity.items.length === 0) return;
            for (const type of entity.items) {
                if (!PICKUP_ICONS[type]) continue;
                pickupItems.push({ x: entity.x + Math.random() * 30 - 15, y: entity.y + Math.random() * 30 - 15, size: 36, type });
            }
            entity.items = [];
        }

        // Check if a laser hits a crate â€” damages it and returns true if it did
        function checkLaserCrateCollision(laser) {
            const lx = laser.x, ly = laser.y;
            for (let i = crateBoxes.length - 1; i >= 0; i--) {
                const c = crateBoxes[i];
                if (lx >= c.x && lx <= c.x + c.size && ly >= c.y && ly <= c.y + c.size) {
                    c.hp -= laser.damage || 1;
                    if (c.hp <= 0) {
                        spawnPickupAt(c.x + c.size / 2, c.y + c.size / 2);
                        const fixedSpawn = (c.spawnX !== undefined && c.spawnY !== undefined)
                            ? { x: c.spawnX, y: c.spawnY }
                            : null;
                        crateBoxes.splice(i, 1);
                        // Respawn a new crate after 25s
                        setTimeout(() => {
                            if (!gameStarted) return;
                            if (fixedSpawn) {
                                crateBoxes.push({ x: fixedSpawn.x, y: fixedSpawn.y, size: 44, hp: 4, maxHp: 4, spawnX: fixedSpawn.x, spawnY: fixedSpawn.y });
                            } else {
                                const pos = getSpawnPosition(44);
                                crateBoxes.push({ x: pos.x, y: pos.y, size: 44, hp: 4, maxHp: 4 });
                            }
                        }, 25000);
                    }
                    return true;
                }
            }
            return false;
        }

        // Pick up items from ground and auto-use immediately.
        function checkPickupCollision(entity) {
            for (let i = pickupItems.length - 1; i >= 0; i--) {
                const item = pickupItems[i];
                if (!PICKUP_ICONS[item.type]) {
                    pickupItems.splice(i, 1);
                    continue;
                }
                if (entity.x < item.x + item.size && entity.x + entity.size > item.x &&
                    entity.y < item.y + item.size && entity.y + entity.size > item.y) {
                    if (item.type === 'heal') {
                        spawnHealPickupEffect(entity.x + entity.size / 2, entity.y + entity.size / 2);
                    }
                    pickupItems.splice(i, 1);
                    entity.items.push(item.type);
                    useItem(entity);
                }
            }
        }

        function useItem(entity) {
            if (!entity.items || entity.items.length === 0) return;
            const type = entity.items.shift();
            if (type === 'heal') {
                const amount = ITEM_HEAL_AMOUNT;
                entity.currentHp = Math.min(entity.maxHp, entity.currentHp + amount);
                spawnHealPickupEffect(entity.x + entity.size / 2, entity.y + entity.size / 2, 2);
                if (entity.isHuman) healMessage = { text: `+${amount} HP`, timer: 110 };
                entity.healingReceived += amount;
            } else if (type === 'speed') {
                entity._speedTimer = 600; // 10 seconds
                if (entity.isHuman) healMessage = { text: 'âš¡ Speed Boost!', timer: 90 };
            } else if (type === 'damage') {
                entity._damageTimer = 600;
                if (entity.isHuman) healMessage = { text: 'ðŸ”¥ Damage Boost!', timer: 90 };
            } else if (type === 'shield') {
                entity._shieldHp = ITEM_SHIELD_AMOUNT;
                if (entity.isHuman) healMessage = { text: 'ðŸ›¡ï¸ Shield Up!', timer: 90 };
            }
        }

        // Health pack collision â€” kept for backward compat but does nothing now (replaced by crate system)
        function checkHealthPackCollision(entity) {
            for (let i = healthPacks.length - 1; i >= 0; i--) {
                const pack = healthPacks[i];
                if (entity.x < pack.x + pack.size && entity.x + entity.size > pack.x &&
                    entity.y < pack.y + pack.size && entity.y + entity.size > pack.y) {
                    const amount = pack.healAmount || Math.round(8 * COMBAT_STAT_SCALE);
                    const beforeHp = entity.currentHp;
                    entity.currentHp = Math.min(entity.maxHp, entity.currentHp + amount);
                    entity._damageTimer = Math.max(entity._damageTimer || 0, 180);
                    const healed = Math.max(0, entity.currentHp - beforeHp);
                    if (healed > 0) {
                        entity.healingReceived = (entity.healingReceived || 0) + healed;
                        spawnHealPickupEffect(entity.x + entity.size / 2, entity.y + entity.size / 2, 1);
                        if (entity.isHuman) {
                            healMessage = { text: `+${healed} HP + Damage!`, timer: 90 };
                        }
                    }

                    healthPacks.splice(i, 1);
                    setTimeout(() => {
                        if (!gameStarted) return;
                        const pos = getSpawnPosition(26);
                        healthPacks.push({ x: pos.x, y: pos.y, size: 26, healAmount: Math.round(8 * COMBAT_STAT_SCALE) });
                    }, 14000);
                }
            }
            checkPickupCollision(entity);
        }


        function playerShoot(targetX, targetY) {
            if (!player || player.currentHp <= 0 || player.shootCooldown > 0) return;

            const startX = player.x + player.size / 2;
            const startY = player.y + player.size / 2;
            const dx = targetX - startX;
            const dy = targetY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance === 0) return;

            // If carrying the ball in Ball-Goal, kick it instead of shooting
            if (currentGameMode === 'ballGoal' && player.hasBall && ball) {
                kickBall(player, dx, dy);
                player.shootCooldown = 20;
                return;
            }

            const speed = 12;
            const nx = dx / distance, ny = dy / distance;
            const aType = player.attackType || 'standard';

            function makeLaser(ox, oy, vx, vy, life, dmg, extra) {
                return {
                    x: startX + ox,
                    y: startY + oy,
                    vx,
                    vy,
                    life,
                    damage: dmg,
                    shooter: player,
                    attackType: aType,
                    startX: startX + ox,
                    startY: startY + oy,
                    maxRange: player.laserRange,
                    ...extra
                };
            }
            function rotated(nx, ny, angle) {
                const c = Math.cos(angle), s = Math.sin(angle);
                return { vx: (nx * c - ny * s) * speed, vy: (nx * s + ny * c) * speed };
            }

            if (aType === 'spread') {
                for (const angle of [-0.22, 0, 0.22]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx, r.vy, 80, Math.max(1, Math.round(player.laserDamage * 0.75)), {}));
                }
                player.shootCooldown = 18;
            } else if (aType === 'triple') {
                for (const angle of [-0.35, 0, 0.35]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx, r.vy, 80, player.laserDamage, {}));
                }
                player.shootCooldown = 25;
            } else if (aType === 'double') {
                const px = -ny * 9, py = nx * 9;
                for (const s of [-1, 1]) {
                    lasers.push(makeLaser(px * s, py * s, nx * speed, ny * speed, 90, player.laserDamage, {}));
                }
                player.shootCooldown = 20;
            } else if (aType === 'magnetshot') {
                if (player._magnetsMinus) {
                    // Minus form: single heavy magnetic pulse (different from plus dual-beam).
                    lasers.push(makeLaser(0, 0, nx * 9.2, ny * 9.2, 82, Math.max(1, Math.round(player.laserDamage * 1.35)), {
                        magnetColor: '#f97316',
                        radius: 10,
                        aoeRadius: 42,
                        freezeSlow: true
                    }));
                    player.shootCooldown = 24;
                } else {
                    const ox = -ny * 9, oy = nx * 9;
                    lasers.push(makeLaser( ox,  oy, nx * speed, ny * speed, 90, player.laserDamage, { magnetColor: '#ef4444' }));
                    lasers.push(makeLaser(-ox, -oy, nx * speed, ny * speed, 90, player.laserDamage, { magnetColor: '#3b82f6' }));
                    player.shootCooldown = 20;
                }
            } else if (aType === 'heavy') {
                lasers.push(makeLaser(0, 0, nx * 5, ny * 5, 130, Math.round(player.laserDamage * 2.5), { radius: 12, aoeRadius: 60 }));
                player.shootCooldown = 38;
            } else if (aType === 'clustercannon') {
                for (const angle of [-0.16, 0, 0.16]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.55, r.vy * 0.55, 120, Math.max(1, Math.round(player.laserDamage * 1.6)), { radius: 10, aoeRadius: 36 }));
                }
                player.shootCooldown = 30;
            } else if (aType === 'rapid') {
                lasers.push(makeLaser(0, 0, nx * speed, ny * speed, 80, player.laserDamage, {}));
                // Second shot fires after a short delay via a scheduled push
                setTimeout(() => {
                    if (!gameStarted || player.currentHp <= 0) return;
                    lasers.push({ x: startX, y: startY, vx: nx * speed, vy: ny * speed, life: 80, damage: player.laserDamage, shooter: player, attackType: 'rapid', startX, startY, maxRange: player.laserRange });
                }, 100);
                player.shootCooldown = 14;
            } else if (aType === 'combojab') {
                for (const angle of [-0.1, 0.1]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.82, r.vy * 0.82, 52, Math.max(1, Math.round(player.laserDamage * 1.05)), { radius: 8, aoeRadius: 24 }));
                }
                setTimeout(() => {
                    if (!gameStarted || player.currentHp <= 0) return;
                    lasers.push({ x: startX, y: startY, vx: nx * speed * 0.86, vy: ny * speed * 0.86, life: 50, damage: Math.max(1, Math.round(player.laserDamage * 1.2)), shooter: player, attackType: 'combojab', radius: 8, aoeRadius: 26, startX, startY, maxRange: player.laserRange });
                }, 70);
                player.shootCooldown = 13;
            } else if (aType === 'cardslash') {
                for (const angle of [-0.42, -0.14, 0.14, 0.42]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.72, r.vy * 0.72, 58, Math.max(1, Math.round(player.laserDamage * 0.9)), { boomerang: true, returnTimer: 26, origVx: r.vx * 0.72, origVy: r.vy * 0.72 }));
                }
                player.shootCooldown = 17;
            } else if (aType === 'shockknuckle') {
                lasers.push(makeLaser(0, 0, nx * 7, ny * 7, 54, Math.max(1, Math.round(player.laserDamage * 1.75)), { radius: 11, aoeRadius: 42, freezeSlow: true }));
                player.shootCooldown = 20;
            } else if (aType === 'homing') {
                const homingCfg = player.id === 'kafekauboy'
                    ? { homingSpeed: 7, homingFrames: 20, homingTurn: 0.04 }
                    : { homingSpeed: 8, homingFrames: 30, homingTurn: 0.055 };
                lasers.push(makeLaser(0, 0, nx * homingCfg.homingSpeed, ny * homingCfg.homingSpeed, 150, player.laserDamage, homingCfg));
                player.shootCooldown = 22;
            } else if (aType === 'boomerang') {
                lasers.push(makeLaser(0, 0, nx * 9, ny * 9, 80, player.laserDamage, { boomerang: true, returnTimer: 40, origVx: nx * 9, origVy: ny * 9 }));
                player.shootCooldown = 28;
            } else if (aType === 'aoehit') {
                lasers.push(makeLaser(0, 0, nx * speed, ny * speed, 90, player.laserDamage, { aoeRadius: 55 }));
                player.shootCooldown = 22;
            } else if (aType === 'venomshot') {
                lasers.push(makeLaser(0, 0, nx * 11, ny * 11, 95, player.laserDamage, { poisonTicks: 3 }));
                player.shootCooldown = 17;
            } else if (aType === 'shadowshot') {
                lasers.push(makeLaser(0, 0, nx * 12.6, ny * 12.6, 88, Math.max(1, Math.round(player.laserDamage * 1.1)), { poisonTicks: 2 }));
                player.shootCooldown = 14;
            } else if (aType === 'thiefshot') {
                lasers.push(makeLaser(0, 0, nx * 9.5, ny * 9.5, 92, Math.max(1, Math.round(player.laserDamage * 1.2)), { boomerang: true, returnTimer: 34, origVx: nx * 9.5, origVy: ny * 9.5, coinSteal: 3 }));
                player.shootCooldown = 20;
            } else if (aType === 'bananaburst') {
                for (const angle of [-0.24, 0, 0.24]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.82, r.vy * 0.82, 78, Math.max(1, Math.round(player.laserDamage * 0.9)), { aoeRadius: 30, bananaSlow: true }));
                }
                player.shootCooldown = 21;
            } else if (aType === 'bombshot') {
                lasers.push(makeLaser(0, 0, nx * 6.2, ny * 6.2, 130, Math.max(1, Math.round(player.laserDamage * 1.9)), { radius: 11, aoeRadius: 70 }));
                player.shootCooldown = 26;
            } else if (aType === 'pumpburst') {
                for (const angle of [-0.32, -0.1, 0.1, 0.32]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.85, r.vy * 0.85, 55, Math.max(1, Math.round(player.laserDamage * 0.7)), {}));
                }
                player.shootCooldown = 19;
            } else if (aType === 'iceshot') {
                lasers.push(makeLaser(0, 0, nx * 11, ny * 11, 100, player.laserDamage, { freezeSlow: true }));
                player.shootCooldown = 20;
            } else if (aType === 'darkpulse') {
                lasers.push(makeLaser(0, 0, nx * 13, ny * 13, 95, player.laserDamage, { darkPulse: true }));
                player.shootCooldown = 18;
            } else if (aType === 'arrowshot') {
                lasers.push(makeLaser(0, 0, nx * 14, ny * 14, 90, player.laserDamage, { arrowShot: true }));
                setTimeout(() => {
                    if (!gameStarted || player.currentHp <= 0) return;
                    lasers.push({ x: startX, y: startY, vx: nx * 14, vy: ny * 14, life: 90, damage: player.laserDamage, shooter: player, attackType: 'arrowshot', arrowShot: true, startX, startY, maxRange: player.laserRange });
                }, 1000);
                player.shootCooldown = 20;
            } else if (aType === 'bubbleshot') {
                // Fire 3 expanding bubble projectiles in a spread
                for (const angle of [-0.18, 0, 0.18]) {
                    const r = rotated(nx, ny, angle);
                    lasers.push(makeLaser(0, 0, r.vx * 0.88, r.vy * 0.88, 180, Math.max(1, Math.round(player.laserDamage * 0.95)), { bubbleShot: true, bubbleSize: 8, bubbleExpand: 0.3, bounceCount: 0 }));
                }
                player.shootCooldown = 19;
            } else {
                // standard
                lasers.push(makeLaser(0, 0, nx * speed, ny * speed, 90, player.laserDamage, {}));
                player.shootCooldown = 15;
            }

            // Berserk super: 2Ã— fire rate (halve cooldown)
            if (player.superActive && player.superBuffType === 'berserk') {
                player.shootCooldown = Math.max(1, Math.floor(player.shootCooldown / 2));
            }

            // Shooting reveals you from bush
            player.bushRevealTimer = 90;
        }

        // â”€â”€ Bot attack type helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function botFireAttack(bot, dirX, dirY, laserSpeed) {
            const cx = bot.x + bot.size / 2;
            const cy = bot.y + bot.size / 2;
            const aType = bot.attackType || 'standard';

            function rotated(dx, dy, angle) {
                const c = Math.cos(angle), s = Math.sin(angle);
                return { vx: (dx * c - dy * s) * laserSpeed, vy: (dx * s + dy * c) * laserSpeed };
            }

            if (aType === 'spread') {
                for (const angle of [-0.22, 0, 0.22]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx, vy: r.vy, life: 80, damage: Math.max(1, Math.round(bot.laserDamage * 0.75)), shooter: bot, attackType: aType });
                }
            } else if (aType === 'triple') {
                for (const angle of [-0.35, 0, 0.35]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx, vy: r.vy, life: 80, damage: bot.laserDamage, shooter: bot, attackType: aType });
                }
            } else if (aType === 'double') {
                const px = -dirY * 9, py = dirX * 9;
                for (const s of [-1, 1]) {
                    aiLasers.push({ x: cx + px * s, y: cy + py * s, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 90, damage: bot.laserDamage, shooter: bot, attackType: aType });
                }
            } else if (aType === 'magnetshot') {
                if (bot._magnetsMinus) {
                    aiLasers.push({
                        x: cx,
                        y: cy,
                        vx: dirX * 9.2,
                        vy: dirY * 9.2,
                        life: 82,
                        damage: Math.max(1, Math.round(bot.laserDamage * 1.35)),
                        shooter: bot,
                        attackType: aType,
                        magnetColor: '#f97316',
                        radius: 10,
                        aoeRadius: 42,
                        freezeSlow: true
                    });
                } else {
                    const ox = -dirY * 9, oy = dirX * 9;
                    aiLasers.push({ x: cx + ox, y: cy + oy, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 90, damage: bot.laserDamage, shooter: bot, attackType: aType, magnetColor: '#ef4444' });
                    aiLasers.push({ x: cx - ox, y: cy - oy, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 90, damage: bot.laserDamage, shooter: bot, attackType: aType, magnetColor: '#3b82f6' });
                }
            } else if (aType === 'heavy') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 5, vy: dirY * 5, life: 130, damage: Math.round(bot.laserDamage * 2.5), shooter: bot, attackType: aType, radius: 12, aoeRadius: 60 });
            } else if (aType === 'clustercannon') {
                for (const angle of [-0.16, 0, 0.16]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx * 0.55, vy: r.vy * 0.55, life: 120, damage: Math.max(1, Math.round(bot.laserDamage * 1.6)), shooter: bot, attackType: aType, radius: 10, aoeRadius: 36 });
                }
            } else if (aType === 'rapid') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 80, damage: bot.laserDamage, shooter: bot, attackType: aType, startX: cx, startY: cy, maxRange: bot.laserRange });
                setTimeout(() => {
                    if (!gameStarted || bot.currentHp <= 0) return;
                    aiLasers.push({ x: bot.x + bot.size / 2, y: bot.y + bot.size / 2, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 80, damage: bot.laserDamage, shooter: bot, attackType: 'rapid', startX: bot.x + bot.size / 2, startY: bot.y + bot.size / 2, maxRange: bot.laserRange });
                }, 120);
            } else if (aType === 'combojab') {
                for (const angle of [-0.1, 0.1]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx * 0.82, vy: r.vy * 0.82, life: 52, damage: Math.max(1, Math.round(bot.laserDamage * 1.05)), shooter: bot, attackType: aType, radius: 8, aoeRadius: 24 });
                }
                setTimeout(() => {
                    if (!gameStarted || bot.currentHp <= 0) return;
                    aiLasers.push({ x: bot.x + bot.size / 2, y: bot.y + bot.size / 2, vx: dirX * laserSpeed * 0.86, vy: dirY * laserSpeed * 0.86, life: 50, damage: Math.max(1, Math.round(bot.laserDamage * 1.2)), shooter: bot, attackType: aType, radius: 8, aoeRadius: 26, startX: bot.x + bot.size / 2, startY: bot.y + bot.size / 2, maxRange: bot.laserRange });
                }, 90);
            } else if (aType === 'cardslash') {
                for (const angle of [-0.42, -0.14, 0.14, 0.42]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx * 0.72, vy: r.vy * 0.72, life: 58, damage: Math.max(1, Math.round(bot.laserDamage * 0.9)), shooter: bot, attackType: aType, boomerang: true, returnTimer: 26, origVx: r.vx * 0.72, origVy: r.vy * 0.72 });
                }
            } else if (aType === 'shockknuckle') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 7, vy: dirY * 7, life: 54, damage: Math.max(1, Math.round(bot.laserDamage * 1.75)), shooter: bot, attackType: aType, radius: 11, aoeRadius: 42, freezeSlow: true });
            } else if (aType === 'homing') {
                const homingCfg = bot.id === 'kafekauboy'
                    ? { homingSpeed: 7, homingFrames: 20, homingTurn: 0.04 }
                    : { homingSpeed: 8, homingFrames: 30, homingTurn: 0.055 };
                aiLasers.push({ x: cx, y: cy, vx: dirX * homingCfg.homingSpeed, vy: dirY * homingCfg.homingSpeed, life: 150, damage: bot.laserDamage, shooter: bot, attackType: aType, homingSpeed: homingCfg.homingSpeed, homingFrames: homingCfg.homingFrames, homingTurn: homingCfg.homingTurn, startX: cx, startY: cy, maxRange: bot.laserRange });
            } else if (aType === 'boomerang') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 9, vy: dirY * 9, life: 80, damage: bot.laserDamage, shooter: bot, attackType: aType, boomerang: true, returnTimer: 40, origVx: dirX * 9, origVy: dirY * 9 });
            } else if (aType === 'aoehit') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 90, damage: bot.laserDamage, shooter: bot, attackType: aType, aoeRadius: 55 });
            } else if (aType === 'venomshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 11, vy: dirY * 11, life: 95, damage: bot.laserDamage, shooter: bot, attackType: aType, poisonTicks: 3 });
            } else if (aType === 'shadowshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 12.6, vy: dirY * 12.6, life: 88, damage: Math.max(1, Math.round(bot.laserDamage * 1.1)), shooter: bot, attackType: aType, poisonTicks: 2 });
            } else if (aType === 'thiefshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 9.5, vy: dirY * 9.5, life: 92, damage: Math.max(1, Math.round(bot.laserDamage * 1.2)), shooter: bot, attackType: aType, boomerang: true, returnTimer: 34, origVx: dirX * 9.5, origVy: dirY * 9.5, coinSteal: 3 });
            } else if (aType === 'bananaburst') {
                for (const angle of [-0.24, 0, 0.24]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx * 0.82, vy: r.vy * 0.82, life: 78, damage: Math.max(1, Math.round(bot.laserDamage * 0.9)), shooter: bot, attackType: aType, aoeRadius: 30, bananaSlow: true });
                }
            } else if (aType === 'bombshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 6.2, vy: dirY * 6.2, life: 130, damage: Math.max(1, Math.round(bot.laserDamage * 1.9)), shooter: bot, attackType: aType, radius: 11, aoeRadius: 70 });
            } else if (aType === 'pumpburst') {
                for (const angle of [-0.32, -0.1, 0.1, 0.32]) {
                    const r = rotated(dirX, dirY, angle);
                    aiLasers.push({ x: cx, y: cy, vx: r.vx * 0.85, vy: r.vy * 0.85, life: 55, damage: Math.max(1, Math.round(bot.laserDamage * 0.7)), shooter: bot, attackType: aType });
                }
            } else if (aType === 'iceshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 11, vy: dirY * 11, life: 100, damage: bot.laserDamage, shooter: bot, attackType: aType, freezeSlow: true });
            } else if (aType === 'darkpulse') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 13, vy: dirY * 13, life: 95, damage: bot.laserDamage, shooter: bot, attackType: aType, darkPulse: true });
            } else if (aType === 'arrowshot') {
                aiLasers.push({ x: cx, y: cy, vx: dirX * 14, vy: dirY * 14, life: 90, damage: bot.laserDamage, shooter: bot, attackType: aType, arrowShot: true, startX: cx, startY: cy, maxRange: bot.laserRange });
                setTimeout(() => {
                    if (!gameStarted || bot.currentHp <= 0) return;
                    const bx = bot.x + bot.size / 2, by = bot.y + bot.size / 2;
                    aiLasers.push({ x: bx, y: by, vx: dirX * 14, vy: dirY * 14, life: 90, damage: bot.laserDamage, shooter: bot, attackType: 'arrowshot', arrowShot: true, startX: bx, startY: by, maxRange: bot.laserRange });
                }, 1000);
            } else if (aType === 'bubbleshot') {
                // Fire 3 expanding bubble projectiles in a spread
                for (const angle of [-0.18, 0, 0.18]) {
                    const c = Math.cos(angle), s = Math.sin(angle);
                    const vx = (dirX * c - dirY * s) * laserSpeed * 0.88;
                    const vy = (dirX * s + dirY * c) * laserSpeed * 0.88;
                    aiLasers.push({ x: cx, y: cy, vx, vy, life: 180, damage: Math.max(1, Math.round(bot.laserDamage * 0.95)), shooter: bot, attackType: 'bubbleshot', bubbleShot: true, bubbleSize: 8, bubbleExpand: 0.3, bounceCount: 0 });
                }
            } else {
                aiLasers.push({ x: cx, y: cy, vx: dirX * laserSpeed, vy: dirY * laserSpeed, life: 90, damage: bot.laserDamage, shooter: bot, attackType: 'standard' });
            }
        }

        const BOT_TACTIC_PROFILES = {
            balanced: { healThreshold: 0.6, optimalRangeRatio: 0.6, chaseSpeedMult: 0.55, retreatSpeedMult: 0.45, strafeSpeedMult: 0.45, shootChance: 0.4, shootCooldown: 30, prefersBush: false, bushSearchRange: 260 },
            aggressive: { healThreshold: 0.4, optimalRangeRatio: 0.45, chaseSpeedMult: 0.75, retreatSpeedMult: 0.2, strafeSpeedMult: 0.35, shootChance: 0.58, shootCooldown: 24, prefersBush: false, bushSearchRange: 220 },
            healer: { healThreshold: 0.78, optimalRangeRatio: 0.75, chaseSpeedMult: 0.45, retreatSpeedMult: 0.65, strafeSpeedMult: 0.4, shootChance: 0.3, shootCooldown: 34, prefersBush: true, bushSearchRange: 340 },
            ambush: { healThreshold: 0.62, optimalRangeRatio: 0.7, chaseSpeedMult: 0.42, retreatSpeedMult: 0.55, strafeSpeedMult: 0.25, shootChance: 0.45, shootCooldown: 30, prefersBush: true, bushSearchRange: 420 },
            sniper: { healThreshold: 0.55, optimalRangeRatio: 0.88, chaseSpeedMult: 0.38, retreatSpeedMult: 0.7, strafeSpeedMult: 0.3, shootChance: 0.48, shootCooldown: 32, prefersBush: true, bushSearchRange: 360 }
        };

        const BOT_TACTIC_POOL = Object.keys(BOT_TACTIC_PROFILES);

        const BOT_PERSONALITY_PRESETS = [
            { id: 'aggressive', label: 'Aggro', icon: 'ðŸ”¥', tactic: 'aggressive' },
            { id: 'sniper', label: 'Sniper', icon: 'ðŸŽ¯', tactic: 'sniper' },
            { id: 'healer', label: 'Medic', icon: 'ðŸ’š', tactic: 'healer' },
            { id: 'ambush', label: 'Ambush', icon: 'ðŸ•¶ï¸', tactic: 'ambush' },
            { id: 'balanced', label: 'Balanced', icon: 'âš–ï¸', tactic: 'balanced' }
        ];

        const BOT_DIFFICULTY_PROFILES = [
            {
                id: 'starter',
                maxMatches: 12,
                rarities: ['rare', 'epic'],
                hpMult: 0.86,
                damageMult: 0.84,
                speedMult: 0.93,
                shootChanceMult: 0.78,
                cooldownMult: 1.22,
                spreadMult: 1.35,
                aimLeadMult: 0.18
            },
            {
                id: 'learning',
                maxMatches: 35,
                rarities: ['rare', 'epic'],
                hpMult: 0.94,
                damageMult: 0.92,
                speedMult: 0.97,
                shootChanceMult: 0.88,
                cooldownMult: 1.12,
                spreadMult: 1.2,
                aimLeadMult: 0.22
            },
            {
                id: 'regular',
                maxMatches: 80,
                rarities: ['rare', 'epic', 'mythic'],
                hpMult: 1.0,
                damageMult: 1.0,
                speedMult: 1.0,
                shootChanceMult: 1.0,
                cooldownMult: 1.0,
                spreadMult: 1.0,
                aimLeadMult: 0.25
            },
            {
                id: 'advanced',
                maxMatches: 160,
                rarities: ['epic', 'mythic', 'legendary'],
                hpMult: 1.08,
                damageMult: 1.06,
                speedMult: 1.04,
                shootChanceMult: 1.08,
                cooldownMult: 0.93,
                spreadMult: 0.9,
                aimLeadMult: 0.3
            },
            {
                id: 'veteran',
                maxMatches: Infinity,
                rarities: ['epic', 'mythic', 'legendary'],
                hpMult: 1.14,
                damageMult: 1.1,
                speedMult: 1.06,
                shootChanceMult: 1.14,
                cooldownMult: 0.88,
                spreadMult: 0.84,
                aimLeadMult: 0.34
            }
        ];

        function getPlayerSkillScore() {
            const clamp01 = (v) => Math.max(0, Math.min(1, v));
            const matches = Math.max(0, Number.isFinite(playerMatchesPlayed) ? playerMatchesPlayed : 0);
            const medals = Math.max(0, Number.isFinite(playerMedals) ? playerMedals : 0);
            const streak = Math.max(0, Number.isFinite(currentWinStreak) ? currentWinStreak : 0);

            const medalsScore = clamp01(medals / 320);
            const matchesScore = clamp01(matches / 220);
            const streakScore = clamp01(streak / 6);

            const recentHistory = loadMatchHistory().slice(0, 12);
            let winRateScore = 0.35;
            if (recentHistory.length >= 4) {
                const wins = recentHistory.filter(h => h.result === 'win').length;
                const winRate = wins / recentHistory.length;
                // 35% WR starts baseline, 75%+ means highly consistent player.
                winRateScore = clamp01((winRate - 0.35) / 0.4);
            }

            // Weighted mix: medals and win consistency dominate, but experience still matters.
            const raw = (medalsScore * 0.45) + (winRateScore * 0.3) + (matchesScore * 0.15) + (streakScore * 0.1);
            return clamp01(raw);
        }

        function getBotDifficultyProfile() {
            if (currentGameMode === 'easyStage') return BOT_DIFFICULTY_PROFILES[0];

            const clamp01 = (v) => Math.max(0, Math.min(1, v));
            const lerp = (a, b, t) => a + (b - a) * t;
            const skill = clamp01(getPlayerSkillScore());
            const maxIndex = BOT_DIFFICULTY_PROFILES.length - 1;
            const scaled = skill * maxIndex;
            const lowIdx = Math.floor(scaled);
            const highIdx = Math.min(maxIndex, lowIdx + 1);
            const t = scaled - lowIdx;

            const low = BOT_DIFFICULTY_PROFILES[lowIdx];
            const high = BOT_DIFFICULTY_PROFILES[highIdx];

            const raritySet = new Set(low.rarities || []);
            if (t > 0.35) {
                for (const r of (high.rarities || [])) raritySet.add(r);
            }

            return {
                id: t > 0 ? `${low.id}_to_${high.id}` : low.id,
                maxMatches: Infinity,
                rarities: Array.from(raritySet),
                hpMult: lerp(low.hpMult, high.hpMult, t),
                damageMult: lerp(low.damageMult, high.damageMult, t),
                speedMult: lerp(low.speedMult, high.speedMult, t),
                shootChanceMult: lerp(low.shootChanceMult, high.shootChanceMult, t),
                cooldownMult: lerp(low.cooldownMult, high.cooldownMult, t),
                spreadMult: lerp(low.spreadMult, high.spreadMult, t),
                aimLeadMult: lerp(low.aimLeadMult, high.aimLeadMult, t)
            };
        }

        function pickBotIdForDifficulty(excludedId, profile) {
            const allowedRarities = profile?.rarities || ['rare', 'epic'];
            const candidates = Object.keys(playersData).filter(id => {
                if (id === excludedId) return false;
                const p = playersData[id];
                return p && allowedRarities.includes(p.rarity);
            });
            if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)];

            const fallback = Object.keys(playersData).filter(id => id !== excludedId);
            return fallback[Math.floor(Math.random() * fallback.length)] || 'default';
        }

        function applyBotDifficulty(bot, profile) {
            if (!bot || !profile) return;
            bot.maxHp = Math.max(1, Math.round(bot.maxHp * profile.hpMult));
            bot.currentHp = bot.maxHp;
            bot.laserDamage = Math.max(1, Math.round(bot.laserDamage * profile.damageMult));
            bot.speed = bot.speed * profile.speedMult;
            bot.difficultyProfileId = profile.id;
            bot._difficultyProfile = profile;
        }

        function assignRandomBotTactic(bot) {
            if (!bot) return;
            bot.aiTactic = BOT_TACTIC_POOL[Math.floor(Math.random() * BOT_TACTIC_POOL.length)] || 'balanced';
        }

        function assignBotPersonality(bot, index = 0) {
            if (!bot) return;
            const preset = BOT_PERSONALITY_PRESETS[index % BOT_PERSONALITY_PRESETS.length] || BOT_PERSONALITY_PRESETS[0];
            bot.aiTactic = preset.tactic;
            bot.botPersonalityId = preset.id;
            bot.botPersonalityLabel = preset.label;
            bot.botPersonalityIcon = preset.icon;
        }

        function isBotEnemyTargetCandidate(bot, target) {
            if (!bot || !target) return false;
            if (target === bot) return false;
            if ((target.currentHp || 0) <= 0) return false;
            if (bot.team && target.team === bot.team) return false;
            if (target.inBush && !(target.bushRevealTimer > 0)) return false;
            if (target.gadgetInvisibleTimer > 0) return false;
            return true;
        }

        function getBotTargetScore(bot, target) {
            const botCx = bot.x + bot.size / 2;
            const botCy = bot.y + bot.size / 2;
            const tx = target.x + target.size / 2;
            const ty = target.y + target.size / 2;
            const dist = Math.hypot(tx - botCx, ty - botCy);
            let score = dist;

            if (target === player) score *= 0.9;

            const hpRatio = (target.maxHp > 0) ? (target.currentHp / target.maxHp) : 1;
            if (hpRatio < 0.35) score *= 0.75;

            if ((currentGameMode === 'ballGoal' || currentGameMode === 'kingTown') && target.hasBall) {
                score *= 0.52;
            }

            if (!hasLineOfSight(bot, target)) score *= 1.12;

            return score;
        }

        function findIncomingProjectileThreat(bot) {
            const botCx = bot.x + bot.size / 2;
            const botCy = bot.y + bot.size / 2;
            const nearbyRadius = Math.max(140, bot.size * 4.8);
            const allProjectiles = [];
            if (lasers && lasers.length) allProjectiles.push(...lasers);
            if (aiLasers && aiLasers.length) allProjectiles.push(...aiLasers);

            let nearest = null;
            let nearestDist = Infinity;

            for (const l of allProjectiles) {
                if (!l || !l.shooter || (l.life || 0) <= 0) continue;
                if (l.shooter === bot) continue;
                if (bot.team && l.shooter.team === bot.team) continue;

                const lx = l.x;
                const ly = l.y;
                const dx = botCx - lx;
                const dy = botCy - ly;
                const dist = Math.hypot(dx, dy);
                if (dist > nearbyRadius || dist >= nearestDist) continue;

                const speed = Math.hypot(l.vx || 0, l.vy || 0) || 1;
                const pvx = (l.vx || 0) / speed;
                const pvy = (l.vy || 0) / speed;
                const toBotX = dx / (dist || 1);
                const toBotY = dy / (dist || 1);
                const headingDot = pvx * toBotX + pvy * toBotY;
                if (headingDot < 0.74) continue;

                const cross = Math.abs(pvx * dy - pvy * dx);
                const hitWidth = (bot.size * 0.6) + (l.radius || 0) + 10;
                if (cross > hitWidth) continue;

                nearest = l;
                nearestDist = dist;
            }

            return nearest;
        }

        // IMPROVED AI SYSTEM - Bots fight each other and don't always chase player
        function updateAllBots() {
            bots.forEach(bot => {
                if (bot.currentHp <= 0) return;
                if (!bot.aiTactic) assignRandomBotTactic(bot);
                const tactic = BOT_TACTIC_PROFILES[bot.aiTactic] || BOT_TACTIC_PROFILES.balanced;
                const difficulty = bot._difficultyProfile || getBotDifficultyProfile();

                // Stunned â€” skip all AI this frame
                if (bot._stunTimer > 0) return;

                // Init stuck-detection state once
                if (bot.stuckTimer === undefined) {
                    bot.stuckTimer = 0; bot.stuckCheckX = bot.x; bot.stuckCheckY = bot.y;
                    bot.escapeTimer = 0; bot.escapeVx = 0; bot.escapeVy = 0;
                }

                // Escape mode: skip all AI movement, just push in escape direction
                const isEscaping = bot.escapeTimer > 0;
                if (isEscaping) {
                    bot.escapeTimer--;
                    bot.vx = bot.escapeVx;
                    bot.vy = bot.escapeVy;
                }

                if (!isEscaping) {
                    // Find closest target (could be player OR another bot in showdown mode)
                    let closestTarget = findClosestTarget(bot);
                    let objectiveLocksMovement = false;
                    const isObjectiveMode = currentGameMode === 'ballGoal' || currentGameMode === 'kingTown' || currentGameMode === 'zoneCapture';

                    // King of the Town: prioritize shooting the enemy flag carrier.
                    if (currentGameMode === 'kingTown' && ball && ball.carrier && ball.carrier.currentHp > 0 && ball.carrier.team !== bot.team) {
                        closestTarget = ball.carrier;
                    }

                    // Check for health packs when low health
                    if (bot.currentHp < bot.maxHp * tactic.healThreshold) {
                        const nearestHealthPack = findNearestHealthPack(bot);
                        if (nearestHealthPack && getDistance(bot.x, bot.y, nearestHealthPack.x, nearestHealthPack.y) < 400) {
                            // Move toward health pack
                            const dx = nearestHealthPack.x - bot.x;
                            const dy = nearestHealthPack.y - bot.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance > 15) {
                                bot.vx = (dx / distance) * bot.speed;
                                bot.vy = (dy / distance) * bot.speed;
                            }
                            checkHealthPackCollision(bot);
                            return;
                        }

                        // No health pack nearby â€” try to hide in a bush
                        if (!bot.inBush) {
                            const nearestBush = findNearestBush(bot);
                            if (nearestBush && getDistance(bot.x, bot.y, nearestBush.x + nearestBush.size / 2, nearestBush.y + nearestBush.size / 2) < 350) {
                                const bx = nearestBush.x + nearestBush.size / 2 - bot.x;
                                const by = nearestBush.y + nearestBush.size / 2 - bot.y;
                                const bd = Math.sqrt(bx * bx + by * by);
                                if (bd > 10) {
                                    bot.vx = (bx / bd) * bot.speed;
                                    bot.vy = (by / bd) * bot.speed;
                                }
                                checkHealthPackCollision(bot);
                                return;
                            }
                        }
                    }

                    // Ambush and healer tactics: look for bushes to set up safer fights.
                    if (!objectiveLocksMovement && tactic.prefersBush && !bot.inBush) {
                        const nearestBush = findNearestBush(bot);
                        if (nearestBush) {
                            const bushCx = nearestBush.x + nearestBush.size / 2;
                            const bushCy = nearestBush.y + nearestBush.size / 2;
                            const bushDist = getDistance(bot.x, bot.y, bushCx, bushCy);
                            const targetDist = closestTarget ? getDistance(bot.x, bot.y, closestTarget.x, closestTarget.y) : Infinity;
                            const shouldHide = bushDist < tactic.bushSearchRange && (!closestTarget || targetDist > bot.laserRange * 0.65 || bot.currentHp < bot.maxHp * 0.75);
                            if (shouldHide) {
                                const bdx = bushCx - bot.x;
                                const bdy = bushCy - bot.y;
                                const bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
                                if (bd > 8) {
                                    bot.vx = (bdx / bd) * bot.speed * 0.85;
                                    bot.vy = (bdy / bd) * bot.speed * 0.85;
                                    objectiveLocksMovement = true;
                                }
                            }
                        }
                    }

                    // Objective modes: carrying should always override normal combat movement.
                    // This prevents bots from behaving like showdown while holding objective.
                    if (currentGameMode === 'ballGoal' && bot.hasBall && ball) {
                        const targetGoal = goals.find(g => g.team !== bot.team);
                        if (targetGoal) {
                            const gx = targetGoal.x + targetGoal.w / 2 - bot.x;
                            const gy = targetGoal.y + targetGoal.h / 2 - bot.y;
                            const gd = Math.sqrt(gx * gx + gy * gy) || 1;
                            bot.vx = (gx / gd) * bot.speed;
                            bot.vy = (gy / gd) * bot.speed;
                            objectiveLocksMovement = true;
                            // Kick toward goal when close enough
                            if (gd < 350 && bot.shootCooldown <= 0) {
                                kickBall(bot, gx, gy);
                                bot.shootCooldown = 30;
                            }
                        }
                    }
                    // King of the Town: if carrying flag, run to own base and hold
                    else if (currentGameMode === 'kingTown' && bot.hasBall && ball) {
                        const ownBase = goals.find(g => g.team === bot.team);
                        if (ownBase) {
                            const bx = ownBase.x + ownBase.w / 2 - bot.x;
                            const by = ownBase.y + ownBase.h / 2 - bot.y;
                            const bd = Math.sqrt(bx * bx + by * by) || 1;
                            bot.vx = (bx / bd) * bot.speed;
                            bot.vy = (by / bd) * bot.speed;
                            objectiveLocksMovement = true;
                        }
                    }
                    // Zone Capture: prioritize uncaptured zones and contest enemies inside them.
                    else if (currentGameMode === 'zoneCapture' && captureZones.length > 0) {
                        const openZones = captureZones.filter(z => !z.capturedBy);
                        if (openZones.length > 0) {
                            const botCx = bot.x + bot.size / 2;
                            const botCy = bot.y + bot.size / 2;
                            let targetZone = openZones[0];
                            let minD = Infinity;
                            for (const z of openZones) {
                                const d = Math.hypot(z.x - botCx, z.y - botCy);
                                if (d < minD) {
                                    minD = d;
                                    targetZone = z;
                                }
                            }

                            const zx = targetZone.x - botCx;
                            const zy = targetZone.y - botCy;
                            const zd = Math.sqrt(zx * zx + zy * zy) || 1;
                            if (zd > targetZone.radius * 0.8) {
                                bot.vx = (zx / zd) * bot.speed * 0.9;
                                bot.vy = (zy / zd) * bot.speed * 0.9;
                            } else {
                                bot.vx *= 0.5;
                                bot.vy *= 0.5;
                            }
                            objectiveLocksMovement = true;

                            const zoneEnemy = players.find(p => {
                                if (p.currentHp <= 0) return false;
                                if (p.team === bot.team) return false;
                                const px = p.x + p.size / 2;
                                const py = p.y + p.size / 2;
                                return Math.hypot(px - targetZone.x, py - targetZone.y) <= targetZone.radius;
                            });
                            if (zoneEnemy) closestTarget = zoneEnemy;
                        }
                    }
                    // Objective modes: free objective should be prioritized over random fights.
                    else if (isObjectiveMode && ball && !ball.carrier) {
                        const ballDist = getDistance(bot.x, bot.y, ball.x, ball.y);
                        if (ballDist < 1000) {
                            const dx = ball.x - bot.x;
                            const dy = ball.y - bot.y;
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            const chaseMult = currentGameMode === 'kingTown' ? 1.08 : 0.9;
                            bot.vx = (dx / dist) * bot.speed * chaseMult;
                            bot.vy = (dy / dist) * bot.speed * chaseMult;
                            objectiveLocksMovement = true;
                        }
                    }

                    // If no target, wander; otherwise chase/shoot
                    if (!objectiveLocksMovement) {
                        if (!closestTarget) {
                            wanderBehavior(bot);
                        } else {
                        const dx = closestTarget.x - bot.x;
                        const dy = closestTarget.y - bot.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const targetCx = closestTarget.x + closestTarget.size / 2;
                        const targetCy = closestTarget.y + closestTarget.size / 2;

                        const incomingThreat = findIncomingProjectileThreat(bot);
                        if (incomingThreat && (!bot.hasBall || currentGameMode === 'showdown')) {
                            const pvx = incomingThreat.vx || 0;
                            const pvy = incomingThreat.vy || 0;
                            const pLen = Math.hypot(pvx, pvy) || 1;
                            if (!bot._dodgeDir || Math.random() < 0.035) {
                                bot._dodgeDir = Math.random() < 0.5 ? -1 : 1;
                            }
                            const dodgeX = (-pvy / pLen) * bot._dodgeDir;
                            const dodgeY = (pvx / pLen) * bot._dodgeDir;
                            const dodgeMult = Math.max(0.9, tactic.strafeSpeedMult * 1.55);
                            bot.vx = dodgeX * bot.speed * dodgeMult;
                            bot.vy = dodgeY * bot.speed * dodgeMult;
                        }

                        if (distance > 0 && !incomingThreat) {
                            const optimalDistance = bot.laserRange * tactic.optimalRangeRatio;

                            if (distance > optimalDistance + 20) {
                                // Chase target
                                bot.vx = (dx / distance) * bot.speed * tactic.chaseSpeedMult;
                                bot.vy = (dy / distance) * bot.speed * tactic.chaseSpeedMult;
                            } else if (distance < optimalDistance - 30) {
                                // Back away
                                bot.vx = (-dx / distance) * bot.speed * tactic.retreatSpeedMult;
                                bot.vy = (-dy / distance) * bot.speed * tactic.retreatSpeedMult;
                            } else {
                                // Strafe at optimal distance, change direction occasionally
                                if (!bot.strafeDir || Math.random() < 0.015) bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
                                const strafeAngle = Math.atan2(dy, dx) + Math.PI / 2;
                                bot.vx = Math.cos(strafeAngle) * bot.speed * tactic.strafeSpeedMult * bot.strafeDir;
                                bot.vy = Math.sin(strafeAngle) * bot.speed * tactic.strafeSpeedMult * bot.strafeDir;
                            }
                        }

                        // Use gadget in meaningful moments (engage or low HP panic).
                        const gadgetInfo = getEquippedGadgetInfo(bot);
                        if (gadgetInfo && bot.gadgetCooldown <= 0) {
                            const hpRatio = (bot.maxHp > 0) ? (bot.currentHp / bot.maxHp) : 1;
                            const engageRange = bot.laserRange * 0.72;
                            const shouldUseGadget = (distance <= engageRange && Math.random() < 0.018) || (hpRatio < 0.38 && Math.random() < 0.06);
                            if (shouldUseGadget) {
                                activateGadget(bot, targetCx, targetCy);
                            }
                        }

                        // Shoot when ready â€” 40% chance per frame so bots miss sometimes
                        // If bot has ball in Ball-Goal, kick toward opponent's goal instead
                        if (currentGameMode === 'ballGoal' && bot.hasBall && ball && bot.shootCooldown <= 0) {
                            const targetGoal = goals.find(g => g.team !== bot.team);
                            if (targetGoal) {
                                const goalCx = targetGoal.x + targetGoal.w / 2 - (bot.x + bot.size / 2);
                                const goalCy = targetGoal.y + targetGoal.h / 2 - (bot.y + bot.size / 2);
                                kickBall(bot, goalCx, goalCy);
                                bot.shootCooldown = 30;
                            }
                        } else if (bot.shootCooldown <= 0 && distance < bot.laserRange) {
                            const baseShootChance = bot.inBush ? Math.min(0.8, tactic.shootChance + 0.14) : tactic.shootChance;
                            const adjustedShootChance = Math.min(0.92, baseShootChance * (difficulty.shootChanceMult || 1) * balanceSandboxSettings.botShootChanceMultiplier);
                            if (!hasLineOfSight(bot, closestTarget) || Math.random() >= adjustedShootChance) {
                                // Skip shot this frame.
                            } else {

                            const laserSpeed = 10;
                            const timeToHit = distance / laserSpeed;

                            // Mild lead shot â€” slight prediction, not perfect
                            const targetVx = closestTarget.vx || 0;
                            const targetVy = closestTarget.vy || 0;
                            const lead = difficulty.aimLeadMult || 0.25;
                            const predictedX = closestTarget.x + closestTarget.size / 2 + targetVx * timeToHit * lead;
                            const predictedY = closestTarget.y + closestTarget.size / 2 + targetVy * timeToHit * lead;

                            const aimDx = predictedX - (bot.x + bot.size / 2);
                            const aimDy = predictedY - (bot.y + bot.size / 2);
                            const aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy) || 1;

                            // Aim spread increases with distance
                            const spread = (distance / bot.laserRange) * 0.25 * (difficulty.spreadMult || 1);
                            const spreadAngle = (Math.random() - 0.5) * spread;
                            const cos = Math.cos(spreadAngle), sin = Math.sin(spreadAngle);
                            const dirX = aimDx / aimDist;
                            const dirY = aimDy / aimDist;

                            botFireAttack(bot, (dirX * cos - dirY * sin), (dirX * sin + dirY * cos), laserSpeed);
                            const cooldown = Math.round(tactic.shootCooldown * (difficulty.cooldownMult || 1) * balanceSandboxSettings.botCooldownMultiplier);
                            bot.shootCooldown = Math.max(16, cooldown);
                            // Shooting reveals bot from bush
                            bot.bushRevealTimer = 90;
                            }
                        }
                    }
                    }
                } // end !isEscaping

                if (bot.shootCooldown > 0) bot.shootCooldown--;

                // Apply movement â€” stop on obstacle collision
                const botSpeedMult = (bot._slowTimer > 0) ? 0.4 : (bot._speedTimer > 0) ? 1.6 : 1;
                if (bot._speedTimer > 0) bot._speedTimer--;
                if (bot._damageTimer > 0) bot._damageTimer--;
                const oldX = bot.x, oldY = bot.y;
                bot.x = Math.max(0, Math.min(bot.x + bot.vx * botSpeedMult, MAP_WIDTH - bot.size));
                bot.y = Math.max(0, Math.min(bot.y + bot.vy * botSpeedMult, MAP_HEIGHT - bot.size));

                let hitObstacle = false;
                for (let obs of obstacles) {
                    if (!isBlockingObstacleForEntity(bot, obs)) continue;
                    if (checkCollisionWithRect(bot, obs)) {
                        bot.x = oldX;
                        bot.y = oldY;
                        bot.vx = 0;
                        bot.vy = 0;
                        hitObstacle = true;
                        break;
                    }
                }

                // Stuck detection â€” check every 180 frames (~3s); trigger escape if barely moved
                bot.stuckTimer++;
                if (bot.stuckTimer >= 180) {
                    const moved = Math.abs(bot.x - bot.stuckCheckX) + Math.abs(bot.y - bot.stuckCheckY);
                    if (moved < 8 && bot.escapeTimer <= 0) {
                        // Pick a random escape angle, biased away from current facing to break loop
                        const angle = Math.random() * Math.PI * 2;
                        bot.escapeVx = Math.cos(angle) * bot.speed;
                        bot.escapeVy = Math.sin(angle) * bot.speed;
                        bot.escapeTimer = 90; // escape for 1.5 seconds
                    }
                    bot.stuckTimer = 0;
                    bot.stuckCheckX = bot.x;
                    bot.stuckCheckY = bot.y;
                }

                checkHealthPackCollision(bot);
            });
        }

        // NEW: Find closest target (player OR other bots in showdown)
        function findClosestTarget(bot) {
            let closest = null;
            let bestScore = Infinity;

            if (bot._preferredTargetId) {
                const preferred = players.find(p => p.id === bot._preferredTargetId);
                if (preferred && isBotEnemyTargetCandidate(bot, preferred)) {
                    bestScore = getBotTargetScore(bot, preferred) * 0.88;
                    closest = preferred;
                }
            }

            players.forEach(other => {
                if (!isBotEnemyTargetCandidate(bot, other)) return;
                const score = getBotTargetScore(bot, other);
                if (score < bestScore) {
                    bestScore = score;
                    closest = other;
                }
            });

            for (const { owner, companion } of getLivingMagnetsCompanions()) {
                if (owner === bot || companion === bot) continue;
                if (bot.team && companion.team === bot.team) continue;
                const score = getBotTargetScore(bot, companion);
                if (score < bestScore) {
                    bestScore = score;
                    closest = companion;
                }
            }

            if (closest && !closest.isMagnetClone && closest.id) {
                bot._preferredTargetId = closest.id;
            } else if (!closest) {
                bot._preferredTargetId = null;
            }

            return closest;
        }

        // NEW: Check line of sight for shooting (now considers obstacles)
        function hasLineOfSight(shooter, target) {
            const distance = getDistance(shooter.x, shooter.y, target.x, target.y);
            if (distance > shooter.laserRange) return false;

            // Check if there are any blocking obstacles between shooter and target.
            for (let obs of obstacles) {
                if (!isBlockingObstacleForEntity(shooter, obs)) continue;
                // Simple line of sight check using line-rectangle intersection.
                if (lineIntersectsRect(
                    shooter.x + shooter.size / 2, shooter.y + shooter.size / 2,
                    target.x + target.size / 2, target.y + target.size / 2,
                    obs
                )) {
                    return false;
                }
            }
            return true;
        }

        // NEW: Improved wandering behavior
        function wanderBehavior(bot) {
            if (!bot.wanderTarget || getDistance(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 30) {
                // Set a random walk point that is not inside a wall.
                let bestTarget = null;
                for (let i = 0; i < 8; i++) {
                    const candidate = {
                        x: 40 + Math.random() * Math.max(40, MAP_WIDTH - 80),
                        y: 40 + Math.random() * Math.max(40, MAP_HEIGHT - 80),
                        size: bot.size
                    };
                    const blocked = obstacles.some(obs => isBlockingObstacleForEntity(bot, obs) && checkCollisionWithRect(candidate, obs));
                    if (!blocked) {
                        bestTarget = { x: candidate.x, y: candidate.y };
                        break;
                    }
                }
                bot.wanderTarget = bestTarget || getSpawnPosition(10);
                bot.wanderTimer = 60 + Math.floor(Math.random() * 60);
            }

            const dx = bot.wanderTarget.x - bot.x;
            const dy = bot.wanderTarget.y - bot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 20) {
                bot.vx = (dx / distance) * bot.speed * 0.5;
                bot.vy = (dy / distance) * bot.speed * 0.5;
            } else {
                bot.vx = (Math.random() - 0.5) * bot.speed * 0.3;
                bot.vy = (Math.random() - 0.5) * bot.speed * 0.3;
            }
        }

        function findNearestHealthPack(bot) {
            let nearest = null;
            let minDistance = Infinity;
            // Prefer direct heal packs, otherwise heal pickups from crates, otherwise any pickup
            let targets = healthPacks;
            if (!targets || targets.length === 0) {
                targets = pickupItems.filter(p => p.type === 'heal');
            }
            if (!targets || targets.length === 0) {
                targets = pickupItems;
            }
            for (let item of targets) {
                const dist = getDistance(bot.x, bot.y, item.x, item.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearest = item;
                }
            }
            return nearest;
        }

        // Game setup
        // Game setup
        function setupGameMode(mode) {
            const modeConfig = gameModes[mode];
            players = [];
            bots = [];
            lasers = [];
            aiLasers = [];
            killFeed = [];
            matchStatsList = [];

            function buildBotProfileName(index, characterId) {
                const directNames = [
                   'Viper','NPC kid','Speedrunner'
                ];
                const prefixes = ['Big', 'Dark', 'Mega', 'Neo', 'Ultra', 'Wild', 'Iron', 'Fire', 'Ice', 'Shadow', 'Cyber', 'Storm'];
                const roots = [ 'Rider', 'Hunter', 'Knight', 'Wolf', 'Blaze', 'Ghost', 'Sniper', 'Striker', 'Viper', 'Titan', 'Phantom'];
                const suffixes = ['', 'X', 'Pro', 'Prime', 'MK2'];
                const seed = `${characterId || 'bot'}_${index}_${Date.now()}`;
                let hash = 0;
                for (let i = 0; i < seed.length; i++) {
                    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                    hash |= 0;
                }
                const a = Math.abs(hash);
                if (index < directNames.length) {
                    return directNames[(a + index) % directNames.length];
                }
                const prefix = prefixes[a % prefixes.length];
                const root = roots[Math.floor(a / prefixes.length) % roots.length];
                const suffix = suffixes[Math.floor(a / (prefixes.length * roots.length)) % suffixes.length];
                return `${prefix}${root}${suffix}`;
            }

            // Set map size per mode
            if (mode === 'ballGoal' || mode === 'elimination' || mode === 'kingTown') {
                MAP_WIDTH = 1500;
                MAP_HEIGHT = 1000;
            } else {
                MAP_WIDTH = 2000;
                MAP_HEIGHT = 2000;
            }

            pickMap(!!modeConfig.teams);

            if (currentBattleMapData) {
                obstacles = currentBattleMapData.obstacles.map(o => initializeObstacleHealth({ ...o }));
                bushes    = currentBattleMapData.bushCells.map(b => ({...b}));
            } else {
                generateObstacles();
                generateBushes();
            }
            generateHealthPacks(currentBattleMapData?.healBoxSpawns || null);

            // Team spawn zones: each team spawns in a different quadrant (used for bounty/ballGoal)
            const halfW = MAP_WIDTH / 2;
            const halfH = MAP_HEIGHT / 2;
            const teamSpawnZones = {
                red:    { xMin: 50,  xMax: halfW - 50,   yMin: 50,  yMax: halfH - 50 },
                blue:   { xMin: halfW + 50, xMax: MAP_WIDTH - 50, yMin: 50,  yMax: halfH - 50 },
                green:  { xMin: 50,  xMax: halfW - 50,   yMin: halfH + 50, yMax: MAP_HEIGHT - 50 },
                yellow: { xMin: halfW + 50, xMax: MAP_WIDTH - 50, yMin: halfH + 50, yMax: MAP_HEIGHT - 50 }
            };

            // For 3v3/2v2: track how many players placed per team for ordered side-spawns
            const teamIndexCounters = {};

            function getTeamSpawnPosition(size, team) {
                // Use battlemap spawn circles if available
                if (currentBattleMapData && currentBattleMapData.spawnPoints[team] && currentBattleMapData.spawnPoints[team].length > 0) {
                    const pts = currentBattleMapData.spawnPoints[team];
                    for (let attempt = 0; attempt < 40; attempt++) {
                        const pt = pts[Math.floor(Math.random() * pts.length)];
                        const x = pt.x - size / 2;
                        const y = pt.y - size / 2;
                        if (isValidSpawnPosition(x, y, size)) return {x, y};
                    }
                    const pt = pts[Math.floor(Math.random() * pts.length)];
                    return { x: pt.x - size / 2, y: pt.y - size / 2 };
                }

                // 3v3 / 2v2: place teams around the arena ring; teammates line up per team.
                if (mode === '3v3' || mode === '2v2') {
                    const idx = teamIndexCounters[team] || 0;
                    teamIndexCounters[team] = idx + 1;
                    const teamList = modeConfig.teamNames || [];
                    const teamIdx = Math.max(0, teamList.indexOf(team));
                    const teamCount = Math.max(1, teamList.length);
                    const spacing = size + 32;
                    const teamSize = modeConfig.teamSize;
                    const totalSpan = (teamSize - 1) * spacing;
                    const cx = MAP_WIDTH / 2;
                    const cy = MAP_HEIGHT / 2;
                    const radius = Math.max(220, Math.min(MAP_WIDTH, MAP_HEIGHT) * 0.37);
                    const angle = (Math.PI * 2 * teamIdx / teamCount) - Math.PI / 2;
                    const baseX = cx + Math.cos(angle) * radius;
                    const baseY = cy + Math.sin(angle) * radius;
                    const perpX = -Math.sin(angle);
                    const perpY = Math.cos(angle);
                    const offset = -totalSpan / 2 + idx * spacing;
                    const x = Math.max(20, Math.min(MAP_WIDTH - size - 20, baseX + perpX * offset - size / 2));
                    const y = Math.max(20, Math.min(MAP_HEIGHT - size - 20, baseY + perpY * offset - size / 2));
                    return { x, y };
                }

                // Default: random within quadrant zone
                if (!team || !teamSpawnZones[team]) return getSpawnPosition(size);
                const zone = teamSpawnZones[team];
                let attempts = 0;
                let pos;
                do {
                    pos = {
                        x: zone.xMin + Math.random() * (zone.xMax - zone.xMin - size),
                        y: zone.yMin + Math.random() * (zone.yMax - zone.yMin - size)
                    };
                    attempts++;
                } while (!isValidSpawnPosition(pos.x, pos.y, size) && attempts < 50);
                return pos;
            }

            function isFarEnoughFromPlacedPlayers(pos, size, minDistance) {
                if (!Array.isArray(players) || players.length === 0) return true;
                const cx = pos.x + size / 2;
                const cy = pos.y + size / 2;
                for (const placed of players) {
                    if (!placed) continue;
                    const px = placed.x + (placed.size || size) / 2;
                    const py = placed.y + (placed.size || size) / 2;
                    if (getDistance(cx, cy, px, py) < minDistance) return false;
                }
                return true;
            }

            function getFarSpawnPosition(size, team = null) {
                const modeTeam = !!modeConfig.teams;
                const targetTeam = modeTeam ? team : null;
                const nearAlliesMin = Math.max(190, size + 120);
                const enemyDistanceFloor = modeTeam
                    ? ((mode === '3v3' || mode === '2v2') ? 450 : 390)
                    : 460;

                // Retry with a relaxing distance threshold so we avoid impossible layouts.
                for (let attempt = 0; attempt < 110; attempt++) {
                    const base = modeTeam ? getTeamSpawnPosition(size, targetTeam) : getSpawnPosition(size);
                    const minDistance = Math.max(nearAlliesMin, enemyDistanceFloor - attempt * 2.8);
                    if (isFarEnoughFromPlacedPlayers(base, size, minDistance)) {
                        return base;
                    }
                }

                // Final fallback keeps gameplay flowing even on tight maps.
                return modeTeam ? getTeamSpawnPosition(size, targetTeam) : getSpawnPosition(size);
            }

            // Create player
            const playerData = playersData[selectedNexusId];
            const playerTeam = modeConfig.teams ? 'red' : null;
            const playerPos = getFarSpawnPosition(playerData.size, playerTeam);
            const playerBonus = getStatBonus(selectedNexusId);
            player = {
                ...playerData,
                name: getCurrentProfile()?.username || playerData.name,
                characterId: playerData.id,
                x: playerPos.x,
                y: playerPos.y,
                isHuman: true,
                team: playerTeam,
                maxHp: Math.round(playerData.hp * playerBonus * COMBAT_STAT_SCALE),
                currentHp: Math.round(playerData.hp * playerBonus * COMBAT_STAT_SCALE),
                laserDamage: Math.round(playerData.laserDamage * playerBonus * COMBAT_STAT_SCALE),
                shootCooldown: 1,
                healCooldown: 1,
                regenCooldown: 0,
                regenTimer: 0,
                vx: 0,
                vy: 0,
                prevX: playerPos.x,
                prevY: playerPos.y,
                kills: 0,
                damageDealt: 0,
                healingReceived: 0,
                bushRevealTimer: 0,
                superCharge: 0,       // 0-100
                superCooldown: 0,     // frames before can use again after activation
                superActive: false,   // buff supers (berserk, coffeerush, etc.)
                superTimer: 0,        // frames remaining for active buff
                superInvincible: false, // for rockshield / megazord
                items: [],            // held pickups (max 3)
                _speedTimer: 0,
                _damageTimer: 0,
                _shieldHp: 0,
                gadgetCooldown: 0,
                gadgetInvisibleTimer: 0,
                _stunTimer: 0,
                _fireBoostTimer: 0,
                _poisonTicks: 0,
                _poisonTickTimer: 0,
                _poisonBy: null,
                spawnShieldTimer: getSpawnShieldFrames()
            };
            players.push(player);

            // Create bots
            const botCount = modeConfig.maxPlayers - 1;
            const botDifficultyProfile = forceEasyIntroBattle
                ? {
                    id: 'tutorial_easy',
                    maxMatches: Infinity,
                    rarities: ['common', 'rare'],
                    hpMult: 0.72,
                    damageMult: 0.65,
                    speedMult: 0.86,
                    shootChanceMult: 0.58,
                    cooldownMult: 1.45,
                    spreadMult: 1.55,
                    aimLeadMult: 0.12
                }
                : getBotDifficultyProfile();
            currentBotDifficultyInfo = {
                skillPct: (currentGameMode === 'easyStage' || forceEasyIntroBattle) ? 0 : Math.round(getPlayerSkillScore() * 100),
                label: botDifficultyProfile?.id || 'starter'
            };
            for (let i = 0; i < botCount; i++) {
                const botPlayerId = pickBotIdForDifficulty(selectedNexusId, botDifficultyProfile);
                const botData = playersData[botPlayerId];
                const botTeam = modeConfig.teams ? modeConfig.teamNames[Math.floor((i + 1) / modeConfig.teamSize)] || modeConfig.teamNames[modeConfig.teamNames.length - 1] : null;
                const botPos = getFarSpawnPosition(botData.size, botTeam);

                const bot = {
                    ...botData,
                    name: buildBotProfileName(i, botPlayerId),
                    id: `bot_${i}`,
                    characterId: botPlayerId,
                    aiTactic: 'balanced',
                    x: botPos.x,
                    y: botPos.y,
                    isBot: true,
                    team: botTeam,
                    maxHp: Math.round(botData.hp * COMBAT_STAT_SCALE),
                    currentHp: Math.round(botData.hp * COMBAT_STAT_SCALE),
                    laserDamage: Math.round(botData.laserDamage * COMBAT_STAT_SCALE),
                    vx: 0,
                    vy: 0,
                    shootCooldown: 0,
                    healCooldown: 0,
                    wanderTarget: null,
                    wanderTimer: 0,
                    kills: 0,
                    damageDealt: 0,
                    healingReceived: 0,
                    bushRevealTimer: 0,
                    superCharge: 0,
                    superCooldown: 0,
                    superActive: false,
                    superTimer: 0,
                    superInvincible: false,
                    items: [],
                    _speedTimer: 0,
                    _damageTimer: 0,
                    _shieldHp: 0,
                    gadgetCooldown: 0,
                    gadgetInvisibleTimer: 0,
                    _stunTimer: 0,
                    _fireBoostTimer: 0,
                    _poisonTicks: 0,
                    _poisonTickTimer: 0,
                    _poisonBy: null,
                    spawnShieldTimer: getSpawnShieldFrames(),
                    _nextSuperAttemptTs: 0
                };

                assignBotPersonality(bot, i);

                applyBotDifficulty(bot, botDifficultyProfile);

                if (modeConfig.easyStage) {
                    bot.maxHp = Math.round(bot.maxHp * 0.72);
                    bot.currentHp = bot.maxHp;
                    bot.laserDamage = Math.max(1, Math.round(bot.laserDamage * 0.68));
                    bot.speed = bot.speed * 0.9;
                }

                players.push(bot);
                bots.push(bot);
            }

            totalPlayersAtStart = players.length;
            forceEasyIntroBattle = false;

            // Reset super effects
            superEffects = [];
            snakeMinions = [];
            healPickupEffects = [];
            gasWisps = [];

            // Init poison zone for Showdown
            poisonZone = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT, shrinking: false, timer: 0, phase: 0 };

            // Init Ball-Goal
            if (mode === 'ballGoal') {
                initBallGoal();
            } else if (mode === 'kingTown') {
                initKingTown();
            } else {
                ball = null;
                goals = [];
                teamScores = {};
            }

            // Init Bounty timer
            bountyTimerFrames = (mode === 'bounty') ? BOUNTY_DURATION_FRAMES : 0;

            // Init King of the Town timer/state
            if (mode !== 'kingTown') {
                kingTown = { timerFrames: 0, overtime: false, drawBanner: false, holdTeam: null, holdFrames: 0 };
            }

            // Init Zone Capture
            if (mode === 'zoneCapture') {
                initZoneCapture();
            } else {
                captureZones = [];
            }
        }

        function initZoneCapture() {
            captureZones = [];
            const zoneCount = 1 + Math.floor(Math.random() * 2); // 1-2 zones
            const positions = zoneCount === 1
                ? [{ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }]
                : [
                    { x: MAP_WIDTH * 0.35, y: MAP_HEIGHT / 2 },
                    { x: MAP_WIDTH * 0.65, y: MAP_HEIGHT / 2 }
                ];

            positions.forEach((p, idx) => {
                captureZones.push({
                    id: idx,
                    x: p.x,
                    y: p.y,
                    radius: 110,
                    redProgress: 0,
                    blueProgress: 0,
                    capturedBy: null
                });
            });
        }

        function updateZoneCapture() {
            if (currentGameMode !== 'zoneCapture' || !gameStarted) return;
            if (!captureZones || captureZones.length === 0) return;

            for (const zone of captureZones) {
                if (zone.capturedBy) continue;

                let redCount = 0;
                let blueCount = 0;
                for (const p of players) {
                    if (p.currentHp <= 0) continue;
                    const px = p.x + p.size / 2;
                    const py = p.y + p.size / 2;
                    if (Math.hypot(px - zone.x, py - zone.y) <= zone.radius) {
                        if (p.team === 'red') redCount++;
                        else if (p.team === 'blue') blueCount++;
                    }
                }

                // Contested zones do not progress.
                if (redCount > 0 && blueCount > 0) continue;

                if (redCount > 0) {
                    zone.redProgress = Math.min(ZONE_CAPTURE_MAX, zone.redProgress + redCount / 60);
                } else if (blueCount > 0) {
                    zone.blueProgress = Math.min(ZONE_CAPTURE_MAX, zone.blueProgress + blueCount / 60);
                }

                if (zone.redProgress >= ZONE_CAPTURE_MAX) zone.capturedBy = 'red';
                else if (zone.blueProgress >= ZONE_CAPTURE_MAX) zone.capturedBy = 'blue';
            }

            const redCaptured = captureZones.filter(z => z.capturedBy === 'red').length;
            const blueCaptured = captureZones.filter(z => z.capturedBy === 'blue').length;
            const needed = captureZones.length;
            if (redCaptured >= needed) {
                endGame(`Red Team Wins! Captured ${needed}/${needed} zones`, player.team === 'red');
            } else if (blueCaptured >= needed) {
                endGame(`Blue Team Wins! Captured ${needed}/${needed} zones`, player.team === 'blue');
            }
        }

        function drawCaptureZones() {
            if (currentGameMode !== 'zoneCapture' || !captureZones || captureZones.length === 0) return;

            ctx.save();
            for (const zone of captureZones) {
                const zx = zone.x - camera.x;
                const zy = zone.y - camera.y;

                // Base circle
                ctx.beginPath();
                ctx.arc(zx, zy, zone.radius, 0, Math.PI * 2);
                ctx.fillStyle = zone.capturedBy === 'red'
                    ? 'rgba(255, 80, 80, 0.25)'
                    : zone.capturedBy === 'blue'
                        ? 'rgba(80, 130, 255, 0.25)'
                        : 'rgba(255,255,255,0.12)';
                ctx.fill();
                ctx.strokeStyle = zone.capturedBy === 'red' ? '#ff6666' : zone.capturedBy === 'blue' ? '#6699ff' : '#ddd';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Progress arcs (if not captured)
                if (!zone.capturedBy) {
                    const redPct = zone.redProgress / ZONE_CAPTURE_MAX;
                    const bluePct = zone.blueProgress / ZONE_CAPTURE_MAX;
                    ctx.lineWidth = 6;
                    if (redPct > 0) {
                        ctx.strokeStyle = '#ff4444';
                        ctx.beginPath();
                        ctx.arc(zx, zy, zone.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * redPct);
                        ctx.stroke();
                    }
                    if (bluePct > 0) {
                        ctx.strokeStyle = '#4488ff';
                        ctx.beginPath();
                        ctx.arc(zx, zy, zone.radius + 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bluePct);
                        ctx.stroke();
                    }
                }

                // Label
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                const label = zone.capturedBy
                    ? `${zone.capturedBy.toUpperCase()} CAPTURED`
                    : `R ${Math.floor(zone.redProgress)}%  |  B ${Math.floor(zone.blueProgress)}%`;
                ctx.fillText(label, zx, zy + 4);
            }
            ctx.restore();
        }

        // Drawing functions
