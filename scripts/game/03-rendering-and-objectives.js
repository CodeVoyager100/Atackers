        function drawBackground() {
            const isTeamMap = currentGameMode === '3v3' || currentGameMode === '2v2';
            const bgKey = isTeamMap ? 'images/teammap.png' : 'images/background.png';
            const bgImage = imageCache[bgKey];
            if (bgImage && bgImage.complete) {
                ctx.drawImage(bgImage, 0 - camera.x, 0 - camera.y, MAP_WIDTH, MAP_HEIGHT);
            } else {
                // Fallback to gradient background
                const gradient = ctx.createLinearGradient(0, 0, MAP_WIDTH, MAP_HEIGHT);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                ctx.fillStyle = gradient;
                ctx.fillRect(0 - camera.x, 0 - camera.y, MAP_WIDTH, MAP_HEIGHT);
            }
        }

        function drawObstacles() {
            ctx.save();
            const brickTexture = loadImage('images/brick new.png');
            const waterTexture = loadImage('images/water new.png');
            for (let obs of obstacles) {
                if (obs.type === 'water') {
                    const ox = obs.x - camera.x;
                    const oy = obs.y - camera.y;
                    if (waterTexture && waterTexture.complete && !waterTexture._failed && waterTexture.naturalWidth > 0) {
                        ctx.drawImage(waterTexture, ox, oy, obs.width, obs.height);
                        ctx.fillStyle = 'rgba(0, 90, 140, 0.12)';
                        ctx.fillRect(ox, oy, obs.width, obs.height);
                        ctx.strokeStyle = 'rgba(0, 190, 255, 0.45)';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(ox, oy, obs.width, obs.height);
                    } else {
                        ctx.fillStyle = '#0077aa';
                        ctx.fillRect(ox, oy, obs.width, obs.height);
                        ctx.strokeStyle = '#00aaff';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(ox, oy, obs.width, obs.height);
                    }
                } else if (obs.type === 'metal') {
                    // Metal wall style (unbreakable)
                    ctx.fillStyle = '#6b7280';
                    ctx.fillRect(obs.x - camera.x, obs.y - camera.y, obs.width, obs.height);

                    ctx.strokeStyle = '#9ca3af';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(obs.x - camera.x, obs.y - camera.y, obs.width, obs.height);
                    for (let i = 0; i < obs.width; i += 14) {
                        ctx.beginPath();
                        ctx.moveTo(obs.x - camera.x + i, obs.y - camera.y);
                        ctx.lineTo(obs.x - camera.x + i + 10, obs.y - camera.y + obs.height);
                        ctx.stroke();
                    }
                } else {
                    const ox = obs.x - camera.x;
                    const oy = obs.y - camera.y;
                    if (brickTexture && brickTexture.complete && !brickTexture._failed && brickTexture.naturalWidth > 0) {
                        ctx.drawImage(brickTexture, ox, oy, obs.width, obs.height);
                        ctx.strokeStyle = 'rgba(70, 35, 18, 0.55)';
                        ctx.lineWidth = 1.2;
                        ctx.strokeRect(ox, oy, obs.width, obs.height);
                    } else {
                        // Fallback brick pattern
                        ctx.fillStyle = '#8B4513';
                        ctx.fillRect(ox, oy, obs.width, obs.height);
                        ctx.strokeStyle = '#654321';
                        ctx.lineWidth = 1;
                        for (let i = 0; i < obs.width; i += 10) {
                            ctx.beginPath();
                            ctx.moveTo(ox + i, oy);
                            ctx.lineTo(ox + i, oy + obs.height);
                            ctx.stroke();
                        }
                        for (let i = 0; i < obs.height; i += 10) {
                            ctx.beginPath();
                            ctx.moveTo(ox, oy + i);
                            ctx.lineTo(ox + obs.width, oy + i);
                            ctx.stroke();
                        }
                    }
                }
            }
            ctx.restore();
        }

        function drawHealthPacks() {
            // â”€â”€ Draw direct heal packs â”€â”€
            ctx.save();
            const healPulse = Math.sin(Date.now() / 260) * 0.12 + 1;
            for (const hp of healthPacks) {
                const cx = hp.x - camera.x + hp.size / 2;
                const cy = hp.y - camera.y + hp.size / 2;
                const r = (hp.size / 2) * healPulse;

                ctx.shadowColor = '#22cc55';
                ctx.shadowBlur = 12;
                ctx.fillStyle = 'rgba(34, 204, 85, 0.35)';
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();

                
            }
            ctx.restore();

            // â”€â”€ Draw destructible crates â”€â”€
            ctx.save();
            for (const c of crateBoxes) {
                const cx = c.x - camera.x, cy = c.y - camera.y;
                const s = c.size;
                // Shadow
                ctx.shadowColor = '#8B4513';
                ctx.shadowBlur = 6;
                // Wood body
                ctx.fillStyle = '#8B5E3C';
                ctx.fillRect(cx, cy, s, s);
                // Board lines
                ctx.strokeStyle = '#5C3317';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx, cy, s, s);
                ctx.beginPath(); ctx.moveTo(cx, cy + s / 2); ctx.lineTo(cx + s, cy + s / 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + s / 2, cy); ctx.lineTo(cx + s / 2, cy + s); ctx.stroke();
                // Metal cross
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(cx + 4, cy + 4); ctx.lineTo(cx + s - 4, cy + s - 4); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + s - 4, cy + 4); ctx.lineTo(cx + 4, cy + s - 4); ctx.stroke();
                ctx.shadowBlur = 0;
                // HP bar
                const hpPct = c.hp / c.maxHp;
                ctx.fillStyle = '#333';
                ctx.fillRect(cx, cy - 7, s, 4);
                ctx.fillStyle = hpPct > 0.5 ? '#22dd55' : '#ff4444';
                ctx.fillRect(cx, cy - 7, s * hpPct, 4);
            }

            // â”€â”€ Draw pickup items on ground â”€â”€
            const pulse = Math.sin(Date.now() / 280) * 0.12 + 1;
            for (const item of pickupItems) {
                const ix = item.x - camera.x + item.size / 2;
                const iy = item.y - camera.y + item.size / 2;
                const r = (item.size / 2) * pulse;
                const colors = { heal: '#22cc55', speed: '#44aaff', damage: '#ff4422', shield: '#ffcc00' };
                const col = colors[item.type] || '#fff';
                ctx.shadowColor = col;
                ctx.shadowBlur = 12;
                ctx.fillStyle = col + '44';
                ctx.beginPath(); ctx.arc(ix, iy, r, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.font = `${Math.round(item.size * 0.7)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(PICKUP_ICONS[item.type] || PICKUP_ICONS.heal, ix, iy);
                ctx.textBaseline = 'alphabetic';
            }
            ctx.restore();
        }

        function drawBushes() {
            ctx.save();
            for (let bush of bushes) {
                const bx = bush.x - camera.x;
                const by = bush.y - camera.y;
                const bw = bush.width !== undefined ? bush.width : bush.size;
                const bh = bush.height !== undefined ? bush.height : bush.size;

                // Bush base (dark green)
                ctx.fillStyle = 'rgba(34, 120, 34, 0.85)';
                ctx.fillRect(bx, by, bw, bh);

                // Lighter inner patches
                ctx.fillStyle = 'rgba(50, 160, 50, 0.7)';
                ctx.fillRect(bx + bw * 0.1, by + bh * 0.1, bw * 0.4, bh * 0.4);
                ctx.fillRect(bx + bw * 0.45, by + bh * 0.5, bw * 0.4, bh * 0.35);

                // Outline
                ctx.strokeStyle = 'rgba(20, 80, 20, 0.6)';
                ctx.lineWidth = 2;
                ctx.strokeRect(bx, by, bw, bh);
            }
            ctx.restore();
        }

        function drawPlayers() {
            players.forEach(p => {
                // Draw respawn indicator for dead players in team modes
                if (p.currentHp <= 0) {
                    if (p.respawnTimer > 0) {
                        const px = p.x - camera.x;
                        const py = p.y - camera.y;
                        ctx.save();
                        ctx.globalAlpha = 0.4;
                        ctx.font = 'bold 30px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText('ðŸ’€', px + p.size / 2, py + p.size / 2 + 5);
                        const seconds = Math.ceil(p.respawnTimer / 60);
                        ctx.font = 'bold 16px Arial';
                        ctx.fillStyle = '#ffcc00';
                        ctx.fillText(seconds + 's', px + p.size / 2, py + p.size / 2 + 28);
                        ctx.restore();
                    }
                    return;
                }

                p.inBush = isInBush(p);

                // Tick down bush reveal timer
                if (p.bushRevealTimer > 0) p.bushRevealTimer--;

                // Revealed if shot or took damage recently
                const isRevealed = p.bushRevealTimer > 0;

                // Bushes reduce visibility for everyone, but no one is fully invisible.
                // This avoids confusion when many players are inside bushes.

                ctx.save();

                // Fade players who are in a bush (and not revealed)
                if (p.inBush && !isRevealed) {
                    if (p.isHuman) {
                        ctx.globalAlpha = 0.72;
                    } else {
                        ctx.globalAlpha = 0.66;
                    }
                }

                // Shaado super phase: partially transparent while dashing
                const isShadowPhasing = (p.shadowPhaseTimer || 0) > 0;
                if (isShadowPhasing) {
                    ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.55);
                }

                // Invisible (gadget cloak) â€” keep enemies faintly visible for fairness/readability
                const isInvisible = (p.gadgetInvisibleTimer || 0) > 0;
                if (isInvisible) {
                    if (p.isHuman) ctx.globalAlpha = 0.7;
                    else ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.62);
                }

                const teamColor = p.team ? teamColors[p.team] : null;
                const px = p.x - camera.x;
                const py = p.y - camera.y;

                // Team outline (drawn before sprite so it appears behind)
                if (teamColor) {
                    ctx.strokeStyle = teamColor;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px - 3, py - 3, p.size + 6, p.size + 6);
                }

                // Cloaked players still get a visible silhouette ring so they are never lost.
                if (isInvisible) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 4]);
                    ctx.strokeRect(px - 2, py - 2, p.size + 4, p.size + 4);
                    ctx.setLineDash([]);
                }

                // Try to draw player image if available
                const spriteSrc = getPlayerPreferredImageSrc(p);
                const imgEntry = spriteSrc ? loadImage(spriteSrc) : null;
                if (imgEntry && imgEntry.complete && !imgEntry._failed && imgEntry.naturalWidth > 0) {
                    ctx.drawImage(imgEntry, px, py, p.size, p.size);

                    // Add glow effect for human player
                    if (p.isHuman) {
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 15;
                        ctx.drawImage(imgEntry, px, py, p.size, p.size);
                        ctx.shadowBlur = 0;
                    }
                } else {
                    // Fallback to colored rectangle
                    ctx.fillStyle = p.color;
                    if (p.isHuman) {
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 15;
                    }
                    ctx.fillRect(px, py, p.size, p.size);
                    ctx.shadowBlur = 0;
                }

                // HP bar background
                ctx.fillStyle = '#333';
                ctx.fillRect(px, py - 12, p.size, 6);

                // HP bar
                const hpPercent = p.currentHp / p.maxHp;
                ctx.fillStyle = hpPercent > 0.6 ? '#00ff00' : hpPercent > 0.3 ? '#ffff00' : '#ff0000';
                ctx.fillRect(px, py - 12, p.size * hpPercent, 6);

                // Team dot above HP bar
                if (teamColor) {
                    ctx.fillStyle = teamColor;
                    ctx.beginPath();
                    ctx.arc(px + p.size / 2, py - 20, 5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // HP number + name tag above HP bar
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'white';
                ctx.fillText(`${Math.ceil(p.currentHp)}/${p.maxHp}`, px + p.size / 2, py - 15);

                // Show fighter name above every character.
                ctx.font = '12px Arial';
                ctx.fillStyle = p.isHuman ? 'white' : '#d9f2ff';
                ctx.fillText(p.name, px + p.size / 2, py - 28);

                if (p.isHuman) {
                    const activeTitle = getEquippedTitle(getCurrentProfile());
                    ctx.font = '10px Arial';
                    ctx.fillStyle = '#ffcc66';
                    ctx.fillText(`[${activeTitle}]`, px + p.size / 2, py - 40);
                }

                // Item icons above name
                if (p.items && p.items.length > 0) {
                    const iconY = py - (p.isHuman ? 54 : 32);
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    const iconStr = p.items.map(t => PICKUP_ICONS[t] || '?').join(' ');
                    ctx.fillText(iconStr, px + p.size / 2, iconY);
                }
                // Shield indicator
                if (p._shieldHp > 0) {
                    ctx.font = 'bold 11px Arial';
                    ctx.fillStyle = '#ffcc00';
                    ctx.fillText(`ðŸ›¡ï¸${p._shieldHp}`, px + p.size / 2, py - (p.isHuman ? 54 : 44));
                }


                // Spawn shield indicator (temporary damage immunity)
                if ((p.spawnShieldTimer || 0) > 0) {
                    const secs = (p.spawnShieldTimer / 60).toFixed(1);
                    ctx.strokeStyle = 'rgba(90, 200, 255, 0.95)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(px + p.size / 2, py + p.size / 2, p.size * 0.62, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.font = 'bold 11px Arial';
                    ctx.fillStyle = '#7dd3fc';
                    ctx.fillText(`Shield ${secs}s`, px + p.size / 2, py - (p.isHuman ? 66 : 56));
                }

                // Stars above player in bounty mode
                if (currentGameMode === 'bounty' && p.kills > 0) {

                    ctx.font = 'bold 13px Arial';
                    ctx.textAlign = 'center';
                    const starY = py - (p.isHuman ? 42 : 32);
                    ctx.fillStyle = '#ffe600';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    const starText = 'â­'.repeat(Math.min(p.kills, 5)) + (p.kills > 5 ? ` Ã—${p.kills}` : '');
                    ctx.strokeText(starText, px + p.size / 2, starY);
                    ctx.fillText(starText, px + p.size / 2, starY);
                }

                // Gadget cooldown arc (drawn below the player sprite)
                {
                    const gInfo = getEquippedGadgetInfo(p);
                    const gdCD = p.gadgetCooldown || 0;
                    const gdMax = gInfo?.cooldown || 480;
                    const gdReady = !!gInfo && gdCD <= 0;
                    const arcCx = px + p.size / 2;
                    const arcCy = py + p.size + 8;
                    const arcR = 7;
                    // Background ring
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(arcCx, arcCy, arcR, 0, Math.PI * 2);
                    ctx.stroke();
                    // Fill arc (clockwise from top)
                    const fillFraction = gInfo ? (gdReady ? 1 : 1 - gdCD / gdMax) : 0;
                    ctx.strokeStyle = !gInfo ? '#663333' : (gdReady ? '#44ff88' : '#2a7a44');
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(arcCx, arcCy, arcR, -Math.PI / 2, -Math.PI / 2 + fillFraction * Math.PI * 2);
                    ctx.stroke();
                    if (gdReady || !gInfo) {
                        ctx.fillStyle = gdReady ? '#44ff88' : '#ff7777';
                        ctx.font = 'bold 9px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(gdReady ? 'G' : 'ðŸ”’', arcCx, arcCy + 3);
                    }
                }

                // Show stun indicator
                if (p._stunTimer > 0) {
                    ctx.save();
                    ctx.fillStyle = '#ffaa00';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('â­ STUNNED', px + p.size / 2, py + p.size / 2);
                    ctx.restore();
                }

                // Magnets +/- form indicator
                if ((p.characterId || p.id) === 'magnets' || p._magnetsMinus !== undefined) {
                    const symbol = p._magnetsMinus ? 'âˆ’' : '+';
                    const symColor = p._magnetsMinus ? '#f87171' : '#4ade80';
                    ctx.save();
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = symColor;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    ctx.strokeText(symbol, px + p.size / 2, py + p.size * 0.65);
                    ctx.fillText(symbol, px + p.size / 2, py + p.size * 0.65);
                    ctx.restore();
                }

                ctx.restore();
            });
        }

        function drawLasers() {
            ctx.save();

            function drawOneLaser(laser, isAI) {
                const lx = laser.x - camera.x, ly = laser.y - camera.y;
                const aType = laser.attackType;
                const isSuperLaser = laser.isSuperLaser;

                if (aType === 'heavy') {
                    // Slow cannon ball rendered as a glowing circle
                    const r = laser.radius || 10;
                    ctx.shadowColor = '#ff8800';
                    ctx.shadowBlur = 14;
                    ctx.fillStyle = '#ff6600';
                    ctx.beginPath();
                    ctx.arc(lx, ly, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffcc00';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (aType === 'bombshot') {
                    const r = laser.radius || 10;
                    ctx.shadowColor = '#ffb347';
                    ctx.shadowBlur = 16;
                    ctx.fillStyle = '#d97706';
                    ctx.beginPath();
                    ctx.arc(lx, ly, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fde68a';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.fillStyle = '#2b2b2b';
                    ctx.beginPath();
                    ctx.arc(lx - r * 0.25, ly - r * 0.2, Math.max(2, r * 0.22), 0, Math.PI * 2);
                    ctx.fill();
                } else if (aType === 'homing') {
                    ctx.strokeStyle = '#00ff88';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#00ff88';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2, ly - laser.vy * 2);
                    ctx.stroke();
                } else if (aType === 'boomerang') {
                    ctx.strokeStyle = '#ff88ff';
                    ctx.lineWidth = 4;
                    ctx.shadowColor = '#ff00ff';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 7, 0, Math.PI * 1.5);
                    ctx.stroke();
                } else if (aType === 'aoehit') {
                    ctx.strokeStyle = '#aa44ff';
                    ctx.lineWidth = 4;
                    ctx.shadowColor = '#aa44ff';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2.5, ly - laser.vy * 2.5);
                    ctx.stroke();
                } else if (aType === 'shadowshot') {
                    ctx.strokeStyle = '#8b5cf6';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#7c3aed';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2.6, ly - laser.vy * 2.6);
                    ctx.stroke();
                } else if (aType === 'thiefshot') {
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 6, 0, Math.PI * 1.7);
                    ctx.stroke();
                } else if (aType === 'bananaburst') {
                    ctx.shadowColor = '#facc15';
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = '#facc15';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ca8a04';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                } else if (aType === 'iceshot') {
                    ctx.shadowColor = '#7dd3fc';
                    ctx.shadowBlur = 14;
                    ctx.fillStyle = '#bae6fd';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#0ea5e9';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    // small trail
                    ctx.strokeStyle = 'rgba(125,211,252,0.55)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2.2, ly - laser.vy * 2.2);
                    ctx.stroke();
                } else if (aType === 'darkpulse') {
                    ctx.shadowColor = '#c084fc';
                    ctx.shadowBlur = 16;
                    ctx.fillStyle = '#6b21a8';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#d946ef';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(192,132,252,0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2.5, ly - laser.vy * 2.5);
                    ctx.stroke();
                } else if (laser.magnetColor) {
                    const mc = laser.magnetColor;
                    ctx.strokeStyle = mc;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = mc;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2.2, ly - laser.vy * 2.2);
                    ctx.stroke();
                } else if (aType === 'bubbleshot' || laser.bubbleShot) {
                    // Bubble: rendered as a translucent circle
                    const bubbleR = laser.bubbleSize || 8;
                    ctx.shadowColor = '#0ea5e9';
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
                    ctx.strokeStyle = '#0ea5e9';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(lx, ly, bubbleR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    // Bubble shine
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.beginPath();
                    ctx.arc(lx - bubbleR * 0.3, ly - bubbleR * 0.3, bubbleR * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                } else if (aType === 'arrowshot' || laser.arrowShot) {
                    // Arrow: a line with an arrowhead tip
                    // Arrow: a line with an arrowhead tip
                    const spd = Math.hypot(laser.vx, laser.vy) || 1;
                    const dx = laser.vx / spd, dy = laser.vy / spd;
                    const len = 18;
                    const ex = lx - dx * len, ey = ly - dy * len;
                    ctx.strokeStyle = '#b45309';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(lx, ly); ctx.stroke();
                    // Arrowhead
                    const hw = 5;
                    const px2 = -dy, py2 = dx;
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - dx * 10 + px2 * hw, ly - dy * 10 + py2 * hw);
                    ctx.lineTo(lx - dx * 10 - px2 * hw, ly - dy * 10 - py2 * hw);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    // standard / spread / triple / double / rapid
                    const color = isSuperLaser ? '#ffcc00' : isAI ? '#ff4444' : '#00ffff';
                    ctx.strokeStyle = color;
                    ctx.lineWidth = isSuperLaser ? 5 : 3;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = isSuperLaser ? 12 : 5;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly);
                    ctx.lineTo(lx - laser.vx * 2, ly - laser.vy * 2);
                    ctx.stroke();
                }
            }

            lasers.forEach(laser => drawOneLaser(laser, false));
            aiLasers.forEach(laser => drawOneLaser(laser, true));

            ctx.shadowBlur = 0;
            ctx.restore();
        }

        function drawShootAimPreview() {
            if (!gameStarted || !player || player.currentHp <= 0) return;
            const sx = player.x + player.size / 2 - camera.x;
            const sy = player.y + player.size / 2 - camera.y;

            let dirX = 0;
            let dirY = 0;

            if (shootJoystickActive && shootJoystick.magnitude >= SHOOT_JOYSTICK_FIRE_THRESHOLD) {
                dirX = shootJoystick.x;
                dirY = shootJoystick.y;
            } else if (mouseShootAimActive) {
                const playerCenterX = player.x + player.size / 2;
                const playerCenterY = player.y + player.size / 2;
                const dx = mouseShootAimWorldX - playerCenterX;
                const dy = mouseShootAimWorldY - playerCenterY;
                const dist = Math.hypot(dx, dy);
                if (dist < 6) return;
                dirX = dx / dist;
                dirY = dy / dist;
            } else {
                return;
            }

            drawAttackPreviewLines(ctx, {
                originX: sx,
                originY: sy,
                dirX,
                dirY,
                range: player.laserRange,
                attackType: player.attackType || 'standard',
                lineColor: 'rgba(255, 120, 120, 0.95)',
                shadowColor: 'rgba(255, 90, 90, 0.95)',
                endpointColor: 'rgba(255, 120, 120, 0.9)',
                dash: [10, 8]
            });
        }

        function getPreviewAnglesForAttackType(attackType) {
            switch (attackType || 'standard') {
                case 'double':
                case 'magnetshot':
                    return [-0.09, 0.09];
                case 'spread':
                    return [-0.22, 0, 0.22];
                case 'triple':
                    return [-0.35, 0, 0.35];
                case 'clustercannon':
                    return [-0.16, 0, 0.16];
                case 'bananaburst':
                    return [-0.24, 0, 0.24];
                case 'pumpburst':
                    return [-0.32, -0.1, 0.1, 0.32];
                case 'combojab':
                    return [-0.1, 0.1];
                case 'cardslash':
                    return [-0.42, -0.14, 0.14, 0.42];
                case 'shockknuckle':
                    return [0];
                default:
                    return [0];
            }
        }

        function drawAttackPreviewLines(drawCtx, cfg) {
            const {
                originX,
                originY,
                dirX,
                dirY,
                range,
                attackType,
                lineColor,
                shadowColor,
                endpointColor,
                dash
            } = cfg;

            const base = Math.atan2(dirY, dirX);
            const offsets = getPreviewAnglesForAttackType(attackType);

            drawCtx.save();
            if (dash && dash.length) drawCtx.setLineDash(dash);
            drawCtx.strokeStyle = lineColor || 'rgba(255, 120, 120, 0.95)';
            drawCtx.lineWidth = 3;
            drawCtx.shadowColor = shadowColor || 'rgba(255, 90, 90, 0.95)';
            drawCtx.shadowBlur = 10;

            const endpoints = [];
            for (const off of offsets) {
                const a = base + off;
                const ex = originX + Math.cos(a) * range;
                const ey = originY + Math.sin(a) * range;
                endpoints.push({ x: ex, y: ey });
                drawCtx.beginPath();
                drawCtx.moveTo(originX, originY);
                drawCtx.lineTo(ex, ey);
                drawCtx.stroke();
            }

            drawCtx.setLineDash([]);
            drawCtx.fillStyle = endpointColor || 'rgba(255, 120, 120, 0.9)';
            for (const p of endpoints) {
                drawCtx.beginPath();
                drawCtx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
                drawCtx.fill();
            }

            drawCtx.restore();
        }

        function drawHUD() {
            if (!player) return;
            ctx.save();

            const isTeamMode = gameModes[currentGameMode].teams;
            const isBallGoal = currentGameMode === 'ballGoal';
            const isBounty   = currentGameMode === 'bounty';
            const isKingTown = currentGameMode === 'kingTown';
            const isZoneCapture = currentGameMode === 'zoneCapture';
            const hudHeight = (isBallGoal || isBounty || isKingTown || isZoneCapture) ? 120 : isTeamMode ? 110 : 80;
            const hudWidth = isTeamMode ? 280 : 200;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(10, 10, hudWidth, hudHeight);

            ctx.font = '14px Arial';
            ctx.fillStyle = 'white';
            ctx.fillText(`HP: ${player.currentHp}/${player.maxHp}`, 20, 30);
            ctx.fillText(`Mode: ${gameModes[currentGameMode].name}`, 20, 50);
            const botDiffLabel = `Bot AI: ${Math.max(0, Math.min(100, currentBotDifficultyInfo.skillPct || 0))}%`;
            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#ffcc66';
            ctx.textAlign = 'right';
            ctx.fillText(botDiffLabel, 10 + hudWidth - 8, 30);
            ctx.textAlign = 'left';

            if (isBounty) {
                // Bounty: show countdown + team star counts
                const secsLeft = Math.ceil(bountyTimerFrames / 60);
                const mins = Math.floor(secsLeft / 60);
                const secs = secsLeft % 60;
                const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                const redStars  = players.filter(p => p.team === 'red').reduce((s, p) => s + p.kills, 0);
                const blueStars = players.filter(p => p.team === 'blue').reduce((s, p) => s + p.kills, 0);
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = secsLeft <= 30 ? '#ff4444' : '#ffcc00';
                ctx.fillText(`â± ${timeStr}`, 20, 72);
                ctx.fillStyle = '#ff4444';
                ctx.fillText(`â­ Red: ${redStars}`, 100, 72);
                ctx.fillStyle = '#4488ff';
                ctx.fillText(`â­ Blue: ${blueStars}`, 185, 72);
                ctx.fillStyle = player.team === 'red' ? '#ff4444' : '#4488ff';
                ctx.font = '11px Arial';
                ctx.fillText(`You: ${player.team} (${player.kills} kills)`, 20, 90);
            } else if (isBallGoal) {
                // Ball-Goal score display
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#ff4444';
                ctx.fillText(`Red: ${teamScores.red || 0}`, 20, 72);
                ctx.fillStyle = '#4488ff';
                ctx.fillText(`Blue: ${teamScores.blue || 0}`, 100, 72);
                ctx.fillStyle = '#aaa';
                ctx.font = '12px Arial';
                ctx.fillText(`First to ${BALL_GOAL_WIN_SCORE} wins`, 20, 90);
            } else if (isKingTown) {
                const secsLeft = Math.ceil(kingTown.timerFrames / 60);
                const mins = Math.floor(secsLeft / 60);
                const secs = secsLeft % 60;
                const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                const flagCarrier = ball && ball.carrier ? ball.carrier : null;

                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = kingTown.overtime ? '#ff4444' : '#ffcc00';
                ctx.fillText(kingTown.overtime ? 'DRAW?? OVERTIME' : `â± ${timeStr}`, 20, 72);

                if (kingTown.holdTeam && !kingTown.overtime) {
                    const holdLeft = Math.max(0, Math.ceil((KING_TOWN_HOLD_FRAMES - kingTown.holdFrames) / 60));
                    ctx.fillStyle = kingTown.holdTeam === 'red' ? '#ff6666' : '#6699ff';
                    ctx.fillText(`${kingTown.holdTeam.toUpperCase()} hold: ${holdLeft}s`, 20, 90);
                } else if (flagCarrier) {
                    ctx.fillStyle = flagCarrier.team === 'red' ? '#ff6666' : '#6699ff';
                    ctx.fillText(`Carrier: ${flagCarrier.name}`, 20, 90);
                } else {
                    ctx.fillStyle = '#aaa';
                    ctx.fillText(kingTown.overtime ? 'Touch any base with flag to win' : 'Hold flag in own base for 10s', 20, 90);
                }

                ctx.fillStyle = player.team === 'red' ? '#ff4444' : '#4488ff';
                ctx.font = '11px Arial';
                ctx.fillText(`You: ${player.team}`, 20, 108);
            } else if (isZoneCapture) {
                const total = captureZones.length || 0;
                const redCaptured = captureZones.filter(z => z.capturedBy === 'red').length;
                const blueCaptured = captureZones.filter(z => z.capturedBy === 'blue').length;
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#ff6666';
                ctx.fillText(`Red: ${redCaptured}/${total}`, 20, 72);
                ctx.fillStyle = '#6699ff';
                ctx.fillText(`Blue: ${blueCaptured}/${total}`, 130, 72);
                ctx.fillStyle = '#aaa';
                ctx.font = '12px Arial';
                ctx.fillText('Capture all zones to win', 20, 90);
                ctx.fillStyle = player.team === 'red' ? '#ff4444' : '#4488ff';
                ctx.font = '11px Arial';
                ctx.fillText(`You: ${player.team}`, 20, 108);
            } else if (isTeamMode) {
                const teamSize = gameModes[currentGameMode].teamSize;
                const teams = gameModes[currentGameMode].teamNames;
                ctx.font = '13px Arial';
                let tx = 20;
                teams.forEach(t => {
                    const alive = players.filter(p => p.currentHp > 0 && p.team === t).length;
                    ctx.fillStyle = teamColors[t];
                    const label = t.charAt(0).toUpperCase() + t.slice(1);
                    const text = `${label}: ${alive}/${teamSize}`;
                    ctx.fillText(text, tx, 70);
                    tx += ctx.measureText(text).width + 10;
                });

                ctx.fillStyle = teamColors[player.team];
                ctx.font = '11px Arial';
                ctx.fillText(`(you are ${player.team})`, 20, 90);
            } else {
                const alive = players.filter(p => p.currentHp > 0).length;
                ctx.fillStyle = 'white';
                ctx.fillText(`Players: ${alive}/${totalPlayersAtStart}`, 20, 70);
            }

            // â”€â”€ Super charge bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const superData = playersData[player.id] || playersData[selectedNexusId];
            const superName = superData?.superName || 'âš¡ Super';
            const charge = player.superCharge || 0;
            const barW = 160, barH = 14;
            const barX = 10, barY = hudHeight + 18;
            const medalsToNextLevel = Math.max(0, 10 - (playerMedals % 10));

            // Dedicated medals progress row, placed above super bar to avoid overlap with mode HUD text.
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffcc66';
            ctx.fillText(`Medals ${playerMedals} | ${medalsToNextLevel} to Lv ${playerLevel + 1}`, barX + 1, barY - 5);

            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(barX, barY, barW + 2, barH + 2);
            // Background track
            ctx.fillStyle = '#333';
            ctx.fillRect(barX + 1, barY + 1, barW, barH);
            // Fill
            const fillColor = charge >= 100 ? '#ffcc00' : '#aa66ff';
            ctx.fillStyle = fillColor;
            ctx.fillRect(barX + 1, barY + 1, Math.round(barW * charge / 100), barH);
            // Label
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = charge >= 100 ? '#ffcc00' : '#ccaaff';
            ctx.fillText(charge >= 100 ? `${superName} â€” Press E!` : `${superName}  ${Math.round(charge)}%`, barX + 3, barY + barH - 2);
            // Super active indicator
            if (player.superActive) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('âš¡ SUPER ACTIVE', barX, barY + barH + 16);
            }

            // Update mobile super button label and glow
            const superBtn = document.getElementById('super-btn');
            const superFill = document.getElementById('super-btn-fill');
            const superLabel = document.getElementById('super-btn-label');
            if (superBtn && superFill && superLabel) {
                superFill.style.height = charge + '%';
                superLabel.textContent = charge >= 100 ? (superData?.superName || 'E') : 'E ' + Math.round(charge) + '%';
                if (charge >= 100) superBtn.classList.add('ready');
                else superBtn.classList.remove('ready');
            }

            // â”€â”€ Gadget cooldown bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const gdInfo = getEquippedGadgetInfo(player);
            const hasGadget = !!gdInfo;
            const gdCD = hasGadget ? (player.gadgetCooldown || 0) : 0;
            const gdMax = gdInfo?.cooldown || 480;
            const gdReady = hasGadget && gdCD <= 0;
            const gdPct = hasGadget ? (gdReady ? 1 : 1 - gdCD / gdMax) : 0;
            const gdBarY = barY + barH + (player.superActive ? 32 : 18);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(barX, gdBarY, 162, 13);
            ctx.fillStyle = '#111';
            ctx.fillRect(barX + 1, gdBarY + 1, 160, 11);
            ctx.fillStyle = !hasGadget ? '#663333' : (gdReady ? '#44ff88' : '#1d6e3d');
            ctx.fillRect(barX + 1, gdBarY + 1, Math.round(160 * gdPct), 11);
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = !hasGadget ? '#ff8080' : (gdReady ? '#44ff88' : '#779966');
            ctx.fillText(!hasGadget ? 'No Gadget Owned' : (gdReady ? `${gdInfo?.name}  SPACE!` : `${gdInfo?.name}  ${Math.round(gdPct * 100)}%`), barX + 3, gdBarY + 9);

            // Update mobile gadget button
            const gadgetBtn  = document.getElementById('gadget-btn');
            const gadgetFill = document.getElementById('gadget-btn-fill');
            const gadgetLbl  = document.getElementById('gadget-btn-label');
            const gadgetBtnContainer = document.getElementById('gadget-btn-container');
            if (gadgetBtnContainer) gadgetBtnContainer.style.display = hasGadget ? '' : 'none';
            if (gadgetBtn && gadgetFill && gadgetLbl) {
                gadgetFill.style.height = Math.round(gdPct * 100) + '%';
                gadgetLbl.textContent   = gdReady ? (gdInfo?.icon || 'G') : Math.ceil(gdCD / 60) + 's';
                if (gdReady) gadgetBtn.classList.add('ready');
                else gadgetBtn.classList.remove('ready');
            }

            ctx.restore();
        }

        function drawSuperEffects() {
            if (superEffects.length === 0) return;
            ctx.save();
            for (const fx of superEffects) {
                const sx = fx.x - camera.x;
                const sy = fx.y - camera.y;
                if (fx.type === 'firezone') {
                    const alpha = Math.min(1, fx.timer / 30) * 0.55;
                    ctx.beginPath();
                    ctx.arc(sx, sy, fx.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,120,0,${alpha})`;
                    ctx.fill();
                    ctx.strokeStyle = `rgba(255,60,0,${alpha + 0.2})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    // Embers
                    ctx.fillStyle = '#ffdd00';
                    for (let e = 0; e < 5; e++) {
                        const ang = Math.random() * Math.PI * 2;
                        const r = Math.random() * fx.radius;
                        ctx.beginPath();
                        ctx.arc(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (fx.type === 'tornado') {
                    ctx.save();
                    ctx.translate(sx, sy);
                    for (let ring = 0; ring < 4; ring++) {
                        const r = fx.radius * (ring + 1) / 4;
                        const alpha = 0.25 + ring * 0.1;
                        ctx.beginPath();
                        ctx.arc(0, 0, r, fx.angle + ring * 0.5, fx.angle + ring * 0.5 + Math.PI * 1.6);
                        ctx.strokeStyle = `rgba(180,140,255,${alpha})`;
                        ctx.lineWidth = 6 - ring;
                        ctx.stroke();
                    }
                    ctx.restore();
                } else if (fx.type === 'bigshot') {
                    ctx.beginPath();
                    ctx.arc(sx, sy, fx.radius, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,80,0,0.85)';
                    ctx.fill();
                    ctx.strokeStyle = '#ffcc00';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                } else if (fx.type === 'screamflash') {
                    const alpha = Math.min(0.65, fx.timer / 30 * 0.65);
                    ctx.beginPath();
                    ctx.arc(sx, sy, fx.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,220,60,${alpha})`;
                    ctx.fill();
                } else if (fx.type === 'smokezone') {
                    const alpha = Math.min(0.5, fx.timer / 60) * 0.6;
                    ctx.beginPath();
                    ctx.arc(sx, sy, fx.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(100,110,120,${alpha})`;
                    ctx.fill();
                    ctx.strokeStyle = `rgba(80,90,100,${alpha + 0.15})`;
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    // Smoke wisps
                    ctx.fillStyle = `rgba(160,170,180,${alpha * 0.7})`;
                    for (let e = 0; e < 6; e++) {
                        const ang = (Date.now() / 800 + e * Math.PI / 3) % (Math.PI * 2);
                        const r = fx.radius * 0.6 * Math.random();
                        ctx.beginPath();
                        ctx.arc(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r, 8 + Math.random() * 10, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        function drawHealMessage() {
            if (!healMessage || healMessage.timer <= 0) return;
            const alpha = Math.min(1, healMessage.timer / 30);
            const y = gameCanvas.height / 2 + 20 - (1 - healMessage.timer / 90) * 30;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ff88';
            ctx.shadowColor = '#00cc44';
            ctx.shadowBlur = 15;
            ctx.fillText(healMessage.text, gameCanvas.width / 2, y);
            ctx.restore();
            healMessage.timer--;
        }

        function drawHealPickupEffects() {
            if (!healPickupEffects.length) return;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = healPickupEffects.length - 1; i >= 0; i--) {
                const fx = healPickupEffects[i];
                fx.x += fx.vx;
                fx.y += fx.vy;
                fx.vy -= 0.018;
                fx.timer--;
                const alpha = Math.max(0, fx.timer / 40);
                const sx = fx.x - camera.x;
                const sy = fx.y - camera.y;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#33ff8c';
                ctx.shadowColor = '#14d85f';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(sx, sy, fx.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = Math.min(1, alpha + 0.15);
                ctx.font = 'bold 12px Arial';
                ctx.fillText('+HP', sx, sy - 1);
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                if (fx.timer <= 0) healPickupEffects.splice(i, 1);
            }
            ctx.restore();
        }

        function drawDamagePopups() {
            if (!damagePopups.length) return;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 16px Arial';
            for (let i = damagePopups.length - 1; i >= 0; i--) {
                const d = damagePopups[i];
                d.y += d.vy;
                d.vy -= 0.01;
                d.timer--;
                const alpha = Math.max(0, d.timer / 36);
                const sx = d.x - camera.x;
                const sy = d.y - camera.y;
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 3;
                ctx.strokeText(d.text, sx, sy);
                ctx.fillStyle = d.color;
                ctx.fillText(d.text, sx, sy);
                ctx.globalAlpha = 1;
                if (d.timer <= 0) damagePopups.splice(i, 1);
            }
            ctx.restore();
        }

        function drawRespawnOverlay() {
            if (!player || player.currentHp > 0) return;

            if (currentGameMode === 'elimination') {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
                ctx.font = 'bold 46px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ff3333';
                ctx.shadowColor = '#990000';
                ctx.shadowBlur = 18;
                ctx.fillText('KNOCKED OUT', gameCanvas.width / 2, gameCanvas.height / 2 - 28);
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#ffcc00';
                ctx.shadowColor = '#cc8800';
                ctx.shadowBlur = 10;
                const hasLivingTeammate = players.some(t => t !== player && t.team === player.team && t.currentHp > 0);
                ctx.fillText(
                    hasLivingTeammate ? 'Spectating teammates until round ends' : 'Team eliminated',
                    gameCanvas.width / 2,
                    gameCanvas.height / 2 + 20
                );
                ctx.restore();
                return;
            }

            if (!player.respawnTimer || player.respawnTimer <= 0) return;

            ctx.save();
            // Keep gameplay visible while waiting to respawn.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

            // "YOU DIED" text
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff3333';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 20;
            ctx.fillText('YOU DIED', gameCanvas.width / 2, gameCanvas.height / 2 - 30);

            // Respawn countdown
            const seconds = Math.ceil(player.respawnTimer / 60);
            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 15;
            ctx.fillText('Respawning in ' + seconds + 's', gameCanvas.width / 2, gameCanvas.height / 2 + 20);

            // Check if no living teammates
            const hasLivingTeammate = players.some(t => t !== player && t.team === player.team && t.currentHp > 0);
            if (!hasLivingTeammate) {
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#ff6666';
                ctx.shadowBlur = 10;
                ctx.fillText('No teammates alive â€” cannot respawn!', gameCanvas.width / 2, gameCanvas.height / 2 + 60);
            }

            ctx.restore();
        }

        function drawKillFeed() {
            const now = Date.now();
            killFeed = killFeed.filter(e => now - e.ts < 3500);
            if (killFeed.length === 0) return;
            ctx.save();
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'right';
            const x = gameCanvas.width - 12;
            const recent = killFeed.slice(-6);
            recent.forEach((entry, i) => {
                const age = now - entry.ts;
                const alpha = age > 2500 ? 1 - (age - 2500) / 1000 : 1;
                const y = 60 + i * 22;
                const text = `${entry.killerName}  âš¡  ${entry.victimName}`;
                const w = ctx.measureText(text).width;
                ctx.globalAlpha = alpha * 0.55;
                ctx.fillStyle = '#000';
                ctx.fillRect(x - w - 8, y - 14, w + 16, 20);
                ctx.globalAlpha = alpha;
                // Use custom color for human player kills
                ctx.fillStyle = entry.isHumanKill ? killFeedColor : '#fff';
                ctx.fillText(text, x, y);
            });
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function drawLevelUp() {
            if (!levelUpMessage || levelUpMessage.timer <= 0) return;
            const alpha = Math.min(1, levelUpMessage.timer / 40);
            const y = gameCanvas.height / 2 - 60 - (1 - levelUpMessage.timer / 180) * 40;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 20;
            ctx.fillText(levelUpMessage.text, gameCanvas.width / 2, y);
            ctx.restore();
            levelUpMessage.timer--;
        }

        // Poison gas zone (Showdown)
        function updatePoisonZone() {
            if (currentGameMode !== 'showdown') return;

            poisonZone.timer++;

            // Start shrinking after delay, in phases
            if (poisonZone.timer > POISON_SHRINK_DELAY) {
                const elapsed = poisonZone.timer - POISON_SHRINK_DELAY;
                // Each phase lasts ~7.5s, then pauses ~3s.
                const phaseLength = POISON_PHASE_LENGTH;
                const pauseLength = POISON_PAUSE_LENGTH;
                const cycleLength = phaseLength + pauseLength;
                const currentPhase = Math.floor(elapsed / cycleLength);
                const withinCycle = elapsed % cycleLength;

                if (currentPhase < POISON_PHASES && withinCycle < phaseLength) {
                    // Shrink the zone
                    const speed = POISON_SHRINK_SPEED * (1 + currentPhase * 0.3);
                    poisonZone.x += speed;
                    poisonZone.y += speed;
                    poisonZone.w -= speed * 2;
                    poisonZone.h -= speed * 2;

                    // Minimum zone size
                    if (poisonZone.w < 200) poisonZone.w = 200;
                    if (poisonZone.h < 200) poisonZone.h = 200;
                }
                poisonZone.phase = Math.min(currentPhase + 1, POISON_PHASES);
            }

            // Damage players outside the zone
            if (poisonZone.timer % POISON_TICK_INTERVAL === 0) {
                const toKill = [];
                for (const p of players) {
                    if (p.currentHp <= 0) continue;
                    if (hasDamageShield(p)) continue;
                    if (p.x < poisonZone.x || p.x + p.size > poisonZone.x + poisonZone.w ||
                        p.y < poisonZone.y || p.y + p.size > poisonZone.y + poisonZone.h) {
                        const dmg = POISON_DAMAGE + poisonZone.phase * COMBAT_STAT_SCALE;
                        p.currentHp -= dmg;
                        registerDamageFeedback(p, dmg, '#c26bff');
                        if (p.isHuman) { p.regenCooldown = 180; p.regenTimer = 0; }
                        if (p.currentHp <= 0) {
                            p.currentHp = 0;
                            killFeed.push({ killerName: 'â˜ ï¸ Zone', victimName: p.name, ts: Date.now(), isHumanKill: false });
                            toKill.push(p);
                        }
                    }
                }
                for (const p of toKill) {
                    const isTeamMode = gameModes[currentGameMode] && gameModes[currentGameMode].teams;
                    if (isTeamMode) {
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
                            if (p.isBot) { const bi = bots.findIndex(b => b.id === p.id); if (bi !== -1) bots.splice(bi, 1); }
                            if (p.isHuman) endGame('Game Over! You were defeated by the Zone!', false);
                        }
                    }
                }
            }

            const targetWispCount = 36;
            if (gasWisps.length < targetWispCount && Math.random() < 0.45) {
                const side = Math.floor(Math.random() * 4);
                let x = poisonZone.x;
                let y = poisonZone.y;
                let vx = 0;
                let vy = 0;
                if (side === 0) {
                    x = poisonZone.x + Math.random() * poisonZone.w;
                    y = poisonZone.y - 6;
                    vx = (Math.random() * 2 - 1) * 0.35;
                    vy = -0.35 - Math.random() * 0.5;
                } else if (side === 1) {
                    x = poisonZone.x + poisonZone.w + 6;
                    y = poisonZone.y + Math.random() * poisonZone.h;
                    vx = 0.35 + Math.random() * 0.5;
                    vy = (Math.random() * 2 - 1) * 0.35;
                } else if (side === 2) {
                    x = poisonZone.x + Math.random() * poisonZone.w;
                    y = poisonZone.y + poisonZone.h + 6;
                    vx = (Math.random() * 2 - 1) * 0.35;
                    vy = 0.35 + Math.random() * 0.5;
                } else {
                    x = poisonZone.x - 6;
                    y = poisonZone.y + Math.random() * poisonZone.h;
                    vx = -0.35 - Math.random() * 0.5;
                    vy = (Math.random() * 2 - 1) * 0.35;
                }
                gasWisps.push({
                    x,
                    y,
                    vx,
                    vy,
                    size: 8 + Math.random() * 14,
                    timer: 50 + Math.floor(Math.random() * 45)
                });
            }

            for (let i = gasWisps.length - 1; i >= 0; i--) {
                const w = gasWisps[i];
                w.x += w.vx;
                w.y += w.vy;
                w.timer--;
                if (w.timer <= 0) gasWisps.splice(i, 1);
            }
        }

        function drawPoisonZone() {
            if (currentGameMode !== 'showdown') return;

            ctx.save();
            // Draw poison fog on the edges outside the safe zone
            const zx = poisonZone.x - camera.x;
            const zy = poisonZone.y - camera.y;
            const zw = poisonZone.w;
            const zh = poisonZone.h;
            const pulse = 0.24 + Math.sin(Date.now() / 380) * 0.09;
            const borderPulse = 0.72 + Math.sin(Date.now() / 210) * 0.2;

            ctx.fillStyle = `rgba(120, 0, 180, ${pulse})`;
            // Top strip
            ctx.fillRect(-camera.x, -camera.y, MAP_WIDTH, poisonZone.y);
            // Bottom strip
            ctx.fillRect(-camera.x, zy + zh, MAP_WIDTH, MAP_HEIGHT - poisonZone.y - poisonZone.h);
            // Left strip
            ctx.fillRect(-camera.x, zy, poisonZone.x, zh);
            // Right strip
            ctx.fillRect(zx + zw, zy, MAP_WIDTH - poisonZone.x - poisonZone.w, zh);

            // Safe zone border
            ctx.strokeStyle = `rgba(190, 70, 255, ${borderPulse})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = -poisonZone.timer * 0.8;
            ctx.strokeRect(zx, zy, zw, zh);
            ctx.setLineDash([]);

            // Drifting gas wisps around the safe-zone edge
            for (const w of gasWisps) {
                const alpha = Math.max(0, w.timer / 95);
                const sx = w.x - camera.x;
                const sy = w.y - camera.y;
                ctx.globalAlpha = alpha * 0.7;
                const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, w.size);
                g.addColorStop(0, 'rgba(205,120,255,0.75)');
                g.addColorStop(1, 'rgba(120,0,180,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(sx, sy, w.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.restore();

            // Warn player if outside zone
            if (player && player.currentHp > 0) {
                if (player.x < poisonZone.x || player.x + player.size > poisonZone.x + poisonZone.w ||
                    player.y < poisonZone.y || player.y + player.size > poisonZone.y + poisonZone.h) {
                    ctx.save();
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ff44ff';
                    ctx.shadowColor = '#cc00cc';
                    ctx.shadowBlur = 10;
                    ctx.fillText('â˜ ï¸ OUTSIDE SAFE ZONE!', gameCanvas.width / 2, 40);
                    ctx.restore();
                }
            }
        }

        function drawKingTownBanner() {
            if (currentGameMode !== 'kingTown' || !kingTown.drawBanner) return;
            ctx.save();
            ctx.font = 'bold 54px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 16;
            ctx.fillText('Draw??', gameCanvas.width / 2, 70);
            ctx.restore();
        }

        // Ball-Goal mode
        function initBallGoal() {
            const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
            ball = {
                x: cx - 15, y: cy - 15, size: 30,
                vx: 0, vy: 0, carrier: null, pickupCooldown: 0
            };
            // Use custom goals from map if available, else default positions
            if (currentBattleMapData && currentBattleMapData.customGoals && currentBattleMapData.customGoals.length >= 2) {
                goals = currentBattleMapData.customGoals.map(g => ({ team: g.team, x: g.x, y: g.y, w: g.w, h: g.h }));
            } else {
                goals = [
                    { team: 'red',  x: 10, y: MAP_HEIGHT / 2 - 104, w: 30, h: 208 },
                    { team: 'blue', x: MAP_WIDTH - 40, y: MAP_HEIGHT / 2 - 104, w: 30, h: 208 }
                ];
            }
            teamScores = { red: 0, blue: 0 };
        }

        function initKingTown() {
            const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
            ball = {
                x: cx - 13, y: cy - 13, size: 26,
                vx: 0, vy: 0, carrier: null, pickupCooldown: 0
            };
            if (currentBattleMapData && currentBattleMapData.customGoals && currentBattleMapData.customGoals.length >= 2) {
                goals = currentBattleMapData.customGoals.map(g => ({ team: g.team, x: g.x, y: g.y, w: g.w, h: g.h }));
            } else {
                goals = [
                    { team: 'red',  x: 10, y: MAP_HEIGHT / 2 - KING_TOWN_BASE_HEIGHT / 2, w: KING_TOWN_BASE_WIDTH, h: KING_TOWN_BASE_HEIGHT },
                    { team: 'blue', x: MAP_WIDTH - 10 - KING_TOWN_BASE_WIDTH, y: MAP_HEIGHT / 2 - KING_TOWN_BASE_HEIGHT / 2, w: KING_TOWN_BASE_WIDTH, h: KING_TOWN_BASE_HEIGHT }
                ];
            }
            kingTown = { timerFrames: KING_TOWN_DURATION_FRAMES, overtime: false, drawBanner: false, holdTeam: null, holdFrames: 0 };
        }

        function isInGoalArea(team, x, y, size) {
            const goal = goals.find(g => g.team === team);
            if (!goal) return false;
            return x + size > goal.x && x < goal.x + goal.w && y + size > goal.y && y < goal.y + goal.h;
        }

        function teamLabel(team) {
            return team ? team.charAt(0).toUpperCase() + team.slice(1) : 'Unknown';
        }

        function checkKingTownTouchWin() {
            if (!ball || !kingTown.overtime) return false;
            for (const goal of goals) {
                if (ball.x + ball.size > goal.x && ball.x < goal.x + goal.w &&
                    ball.y + ball.size > goal.y && ball.y < goal.y + goal.h) {
                    endGame(`${teamLabel(goal.team)} Team Wins!`, goal.team === player.team);
                    return true;
                }
            }
            return false;
        }

        function resetBallToCenter() {
            ball.x = MAP_WIDTH / 2 - ball.size / 2;
            ball.y = MAP_HEIGHT / 2 - ball.size / 2;
            ball.vx = 0;
            ball.vy = 0;
            ball.carrier = null;
            ball.pickupCooldown = 30;
            // Reset all players to spawn positions
            players.forEach(p => { p.hasBall = false; });
        }

        function dropBall(carrier) {
            if (!ball || ball.carrier !== carrier) return;
            ball.carrier = null;
            carrier.hasBall = false;
            ball.x = carrier.x + carrier.size / 2 - ball.size / 2;
            ball.y = carrier.y + carrier.size / 2 - ball.size / 2;
            ball.vx = 0;
            ball.vy = 0;
            ball.pickupCooldown = 30; // Brief cooldown before anyone can pick up
        }

        function kickBall(kicker, dirX, dirY) {
            if (!ball || ball.carrier !== kicker) return;
            ball.carrier = null;
            kicker.hasBall = false;
            const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            ball.x = kicker.x + kicker.size / 2 - ball.size / 2 + (dirX / dist) * 30;
            ball.y = kicker.y + kicker.size / 2 - ball.size / 2 + (dirY / dist) * 30;
            ball.vx = (dirX / dist) * 12;
            ball.vy = (dirY / dist) * 12;
            ball.pickupCooldown = 15;
        }

        function updateBall() {
            if (!ball || currentGameMode !== 'ballGoal') return;

            if (ball.pickupCooldown > 0) ball.pickupCooldown--;

            // Ball is being carried
            if (ball.carrier) {
                const c = ball.carrier;
                if (c.currentHp <= 0) {
                    dropBall(c);
                } else {
                    // Ball follows carrier
                    ball.x = c.x + c.size / 2 - ball.size / 2;
                    ball.y = c.y + c.size / 2 - ball.size / 2;
                    ball.vx = 0;
                    ball.vy = 0;
                }
                // Still check goals while carrying
                checkBallGoals();
                return;
            }

            // Ball physics (when free)
            ball.vx *= 0.96;
            ball.vy *= 0.96;
            if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
            if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

            ball.x += ball.vx;
            ball.y += ball.vy;

            // Bounce off map edges
            if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx); }
            if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); }
            if (ball.x + ball.size > MAP_WIDTH) { ball.x = MAP_WIDTH - ball.size; ball.vx = -Math.abs(ball.vx); }
            if (ball.y + ball.size > MAP_HEIGHT) { ball.y = MAP_HEIGHT - ball.size; ball.vy = -Math.abs(ball.vy); }

            // Bounce off obstacles
            for (let obs of obstacles) {
                if (ball.x < obs.x + obs.width && ball.x + ball.size > obs.x &&
                    ball.y < obs.y + obs.height && ball.y + ball.size > obs.y) {
                    const dx = (ball.x + ball.size / 2) - (obs.x + obs.width / 2);
                    const dy = (ball.y + ball.size / 2) - (obs.y + obs.height / 2);
                    if (Math.abs(dx) > Math.abs(dy)) {
                        ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
                        ball.x = dx > 0 ? obs.x + obs.width : obs.x - ball.size;
                    } else {
                        ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
                        ball.y = dy > 0 ? obs.y + obs.height : obs.y - ball.size;
                    }
                }
            }

            // Players pick up the ball by walking over it
            if (ball.pickupCooldown <= 0) {
                for (let p of players) {
                    if (p.currentHp <= 0) continue;
                    if (p.x < ball.x + ball.size && p.x + p.size > ball.x &&
                        p.y < ball.y + ball.size && p.y + p.size > ball.y) {
                        ball.carrier = p;
                        p.hasBall = true;
                        ball.vx = 0;
                        ball.vy = 0;
                        break;
                    }
                }
            }

            checkBallGoals();
        }

        function updateKingTown() {
            if (!ball || currentGameMode !== 'kingTown') return;

            if (!kingTown.overtime) {
                kingTown.timerFrames = Math.max(0, kingTown.timerFrames - 1);
                if (kingTown.timerFrames <= 0) {
                    kingTown.overtime = true;
                    kingTown.drawBanner = true;
                    kingTown.holdTeam = null;
                    kingTown.holdFrames = 0;
                }
            }

            if (ball.pickupCooldown > 0) ball.pickupCooldown--;

            if (ball.carrier) {
                const c = ball.carrier;
                if (c.currentHp <= 0) {
                    dropBall(c);
                } else {
                    ball.x = c.x + c.size / 2 - ball.size / 2;
                    ball.y = c.y + c.size / 2 - ball.size / 2;
                    ball.vx = 0;
                    ball.vy = 0;
                }
            }

            if (!ball.carrier && ball.pickupCooldown <= 0) {
                for (let p of players) {
                    if (p.currentHp <= 0) continue;
                    if (p.x < ball.x + ball.size && p.x + p.size > ball.x &&
                        p.y < ball.y + ball.size && p.y + p.size > ball.y) {
                        ball.carrier = p;
                        p.hasBall = true;
                        ball.vx = 0;
                        ball.vy = 0;
                        break;
                    }
                }
            }

            if (kingTown.overtime && checkKingTownTouchWin()) return;

            if (!ball.carrier) {
                kingTown.holdTeam = null;
                kingTown.holdFrames = 0;
                return;
            }

            const carrierTeam = ball.carrier.team;
            const carrierInsideOwnBase = isInGoalArea(carrierTeam, ball.x, ball.y, ball.size);
            if (!carrierInsideOwnBase) {
                kingTown.holdTeam = null;
                kingTown.holdFrames = 0;
                return;
            }

            if (kingTown.overtime) {
                endGame(`${teamLabel(carrierTeam)} Team Wins!`, carrierTeam === player.team);
                return;
            }

            if (kingTown.holdTeam !== carrierTeam) {
                kingTown.holdTeam = carrierTeam;
                kingTown.holdFrames = 0;
            }
            kingTown.holdFrames++;
            if (kingTown.holdFrames >= KING_TOWN_HOLD_FRAMES) {
                endGame(`${teamLabel(carrierTeam)} Team Wins!`, carrierTeam === player.team);
            }
        }

        function checkBallGoals() {
            for (let goal of goals) {
                if (ball.x + ball.size > goal.x && ball.x < goal.x + goal.w &&
                    ball.y + ball.size > goal.y && ball.y < goal.y + goal.h) {
                    const scoringTeam = goal.team === 'red' ? 'blue' : 'red';
                    teamScores[scoringTeam]++;

                    healMessage = { text: `âš½ ${scoringTeam.charAt(0).toUpperCase() + scoringTeam.slice(1)} Team Scores! (${teamScores[scoringTeam]}/${BALL_GOAL_WIN_SCORE})`, timer: 150 };

                    if (teamScores[scoringTeam] >= BALL_GOAL_WIN_SCORE) {
                        const label = scoringTeam.charAt(0).toUpperCase() + scoringTeam.slice(1);
                        endGame(`${label} Team Wins!`, scoringTeam === player.team);
                        return;
                    }

                    resetBallToCenter();
                    return;
                }
            }
        }

        function drawBall() {
            if (!ball || (currentGameMode !== 'ballGoal' && currentGameMode !== 'kingTown')) return;
            ctx.save();
            const bx = ball.x - camera.x + ball.size / 2;
            const by = ball.y - camera.y + ball.size / 2;
            const r = ball.carrier ? ball.size / 2.5 : ball.size / 2;
            const isFlag = currentGameMode === 'kingTown';

            // Ball glow
            ctx.shadowColor = isFlag ? '#ffcc00' : (ball.carrier ? '#ffcc00' : '#ffffff');
            ctx.shadowBlur = ball.carrier ? 8 : 12;
            ctx.fillStyle = isFlag ? '#ffd54a' : '#ffffff';
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();

            // Inner pattern
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.stroke();

            if (isFlag) {
                // Flag pole + cloth marker
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bx - 2, by + r * 0.9);
                ctx.lineTo(bx - 2, by - r * 0.9);
                ctx.stroke();
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.moveTo(bx - 2, by - r * 0.8);
                ctx.lineTo(bx + r * 0.75, by - r * 0.55);
                ctx.lineTo(bx - 2, by - r * 0.3);
                ctx.closePath();
                ctx.fill();
            } else {
                // Pentagon pattern
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(bx, by, r * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Carrier indicator
            if (ball.carrier) {
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffcc00';
                ctx.fillText(isFlag ? 'ðŸš©' : 'âš½', bx, by - r - 5);
            }

            ctx.restore();
        }

        function drawGoals() {
            if (currentGameMode !== 'ballGoal' && currentGameMode !== 'kingTown') return;
            ctx.save();
            for (let goal of goals) {
                const gx = goal.x - camera.x;
                const gy = goal.y - camera.y;
                const isKingTown = currentGameMode === 'kingTown';
                ctx.fillStyle = goal.team === 'red'
                    ? (isKingTown ? 'rgba(255,68,68,0.28)' : 'rgba(255,68,68,0.4)')
                    : (isKingTown ? 'rgba(68,136,255,0.28)' : 'rgba(68,136,255,0.4)');
                ctx.fillRect(gx, gy, goal.w, goal.h);
                ctx.strokeStyle = goal.team === 'red' ? '#ff4444' : '#4488ff';
                ctx.lineWidth = 3;
                ctx.strokeRect(gx, gy, goal.w, goal.h);

                // Goal net pattern
                ctx.strokeStyle = goal.team === 'red' ? 'rgba(255,100,100,0.5)' : 'rgba(100,150,255,0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < goal.h; i += 15) {
                    ctx.beginPath();
                    ctx.moveTo(gx, gy + i);
                    ctx.lineTo(gx + goal.w, gy + i);
                    ctx.stroke();
                }
                for (let i = 0; i < goal.w; i += 10) {
                    ctx.beginPath();
                    ctx.moveTo(gx + i, gy);
                    ctx.lineTo(gx + i, gy + goal.h);
                    ctx.stroke();
                }

                if (isKingTown) {
                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = goal.team === 'red' ? '#ff9999' : '#99bbff';
                    ctx.textAlign = 'center';
                    ctx.fillText('BASE', gx + goal.w / 2, gy - 8);
                }
            }
            ctx.restore();
        }

        // Respawn system for team modes
