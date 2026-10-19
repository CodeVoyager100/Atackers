(() => {
    const panel = document.getElementById('lan-panel');
    const status = document.getElementById('lan-status');
    const roomLabel = document.getElementById('lan-room-label');
    const state = {
        role: null, code: '', token: '', guest: null, host: null, controls: {},
        connecting: false, leaving: false, connectionLost: false,
        timer: null, busy: false, lastContact: 0, remote: null,
        inputSequence: 0, remoteSequence: -1, remoteSeen: 0,
        superSequence: 0, gadgetSequence: 0, usedSuper: 0, usedGadget: 0,
        match: 0, guestMatch: 0, ended: '', guestFrame: null,
    };

    function message(text) {
        if (status.textContent !== text) status.textContent = text;
        roomLabel.textContent = state.role === 'host'
            ? 'You are the host | Red Team'
            : state.role === 'guest' ? 'Joined as guest | Red Team' : 'Same-Wi-Fi Co-op';
        document.getElementById('lan-live-room').hidden = !state.role || !gameStarted;
        renderTeam();
    }

    function renderMember(element, member, role, isYou) {
        const key = JSON.stringify([member?.name, member?.characterId, role, isYou]);
        if (element.dataset.member === key) return;
        element.dataset.member = key;
        element.classList.toggle('lan-member-empty', !member);
        element.replaceChildren();
        const avatar = document.createElement('div');
        avatar.className = 'lan-member-avatar';
        avatar.textContent = member ? (member.name || 'Player').slice(0, 2).toUpperCase() : '+';
        const pd = member ? playersData[member.characterId] : null;
        if (pd) {
            const image = document.createElement('img');
            image.src = getPlayerPreferredImageSrc(pd);
            image.alt = pd.name;
            image.addEventListener('error', () => image.remove());
            avatar.appendChild(image);
        }
        const info = document.createElement('div');
        info.className = 'lan-member-info';
        const name = document.createElement('strong');
        name.textContent = member ? `${member.name}${isYou ? ' (You)' : ''}` : role === 'HOST' ? 'No host' : 'Open slot';
        const character = document.createElement('span');
        character.textContent = pd?.name || (member ? 'Connecting...' : 'Waiting for player');
        info.append(name, character);
        const badge = document.createElement('span');
        badge.className = 'lan-member-role';
        badge.textContent = member ? role : 'OPEN';
        element.append(avatar, info, badge);
    }

    function renderTeam() {
        const local = { name: getCurrentProfile()?.username || 'Player', characterId: selectedNexusId };
        const host = state.role === 'host' ? local : state.host;
        const guest = state.role === 'guest' ? local : state.guest;
        renderMember(document.getElementById('lan-slot-host'), state.role ? host : null, 'HOST', state.role === 'host');
        renderMember(document.getElementById('lan-slot-guest'), state.role ? guest : null, 'GUEST', state.role === 'guest');
        const count = state.role ? Number(!!host) + Number(!!guest) : 0;
        document.getElementById('lan-team-count').textContent = `${count}/2 players`;
        document.getElementById('lan-code-display').textContent = state.code || '------';
        document.getElementById('lan-live-code').textContent = state.code;
        document.getElementById('lan-copy-code').disabled = !state.code;
        const connection = document.getElementById('lan-connection');
        connection.textContent = state.connecting ? 'Connecting...' : state.connectionLost ? 'Connection interrupted' : state.role ? gameStarted ? 'In battle' : count === 2 ? 'Team connected' : 'Waiting for teammate' : 'Not connected';
        connection.classList.toggle('connected', !!state.role && !state.connectionLost);
        document.getElementById('lan-create').hidden = !!state.role;
        document.getElementById('lan-join-field').hidden = !!state.role;
        document.getElementById('lan-join').hidden = !!state.role;
        document.getElementById('lan-create').disabled = state.connecting;
        document.getElementById('lan-join').disabled = state.connecting;
        const start = document.getElementById('lan-start');
        start.disabled = state.role !== 'host' || !state.guest || state.leaving || state.connectionLost || gameStarted || battleIntroInProgress;
        start.textContent = gameStarted ? 'Battle in progress' : state.role === 'guest' ? 'Waiting for host' : 'Co-op Battle';
        document.getElementById('lan-leave').disabled = !state.role || state.leaving;
    }

    async function copyCode() {
        if (!state.code) return;
        const feedback = document.getElementById('lan-copy-status');
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(state.code);
            } else {
                const field = document.createElement('textarea');
                field.value = state.code;
                field.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(field);
                let copied;
                try { field.select(); copied = document.execCommand('copy'); }
                finally { field.remove(); }
                if (!copied) throw new Error('Copy unavailable');
            }
            feedback.textContent = 'Code copied';
        } catch {
            feedback.textContent = `Room code: ${state.code}`;
        }
    }

    async function request(action, payload = {}) {
        if (!['http:', 'https:'].includes(location.protocol)) {
            throw new Error('Run python lan-server.py --port 8765, then open http://localhost:8765.');
        }
        const response = await fetch(`/lan/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
            body: JSON.stringify({ code: state.code, ...payload }),
            signal: AbortSignal.timeout(5000),
        });
        const result = await response.json().catch(() => ({ error: 'This address is not running the Atackers LAN server.' }));
        if (!response.ok) throw new Error(result.error || 'Connection failed.');
        return result;
    }

    function plain(entity) {
        return Object.fromEntries(Object.entries(entity).filter(([, value]) =>
            value === null || ['number', 'string', 'boolean'].includes(typeof value)));
    }

    function snapshot() {
        return {
            match: state.match, playing: gameStarted, ended: state.ended,
            host: { name: getCurrentProfile()?.username || 'Host', characterId: gameStarted ? player?.characterId || selectedNexusId : selectedNexusId },
            mode: currentGameMode, width: MAP_WIDTH, height: MAP_HEIGHT,
            remoteId: state.remote?.id,
            players: players.map(plain), obstacles: obstacles.map(plain), bushes: bushes.map(plain),
            healthPacks: healthPacks.map(plain), crates: crateBoxes.map(plain), pickups: pickupItems.map(plain),
            lasers: [...lasers, ...aiLasers].map(plain), effects: superEffects.map(plain),
            difficulty: currentBotDifficultyInfo,
        };
    }

    function input() {
        let dx = Number(!!(keysPressed.d || keysPressed.arrowright)) - Number(!!(keysPressed.a || keysPressed.arrowleft));
        let dy = Number(!!(keysPressed.s || keysPressed.arrowdown)) - Number(!!(keysPressed.w || keysPressed.arrowup));
        if (moveJoystickActive) { dx += moveJoystick.x; dy += moveJoystick.y; }
        let aimX = lastMouseWorldX, aimY = lastMouseWorldY;
        if (shootJoystickActive && player) {
            aimX = player.x + player.size / 2 + shootJoystick.x * 500;
            aimY = player.y + player.size / 2 + shootJoystick.y * 500;
        }
        if (keysPressed.e) { state.superSequence++; keysPressed.e = false; }
        if (keysPressed[' ']) { state.gadgetSequence++; keysPressed[' '] = false; }
        return {
            seq: ++state.inputSequence, dx, dy, aimX, aimY,
            fire: mouseShootAimActive || (shootJoystickActive && shootJoystick.magnitude >= SHOOT_JOYSTICK_FIRE_THRESHOLD),
            super: state.superSequence, gadget: state.gadgetSequence,
        };
    }

    function applySnapshot(data) {
        if (!data || !Number.isInteger(data.match)) return;
        if (!data.playing) {
            if (gameStarted) finish(data.ended || 'Battle ended.');
            return;
        }
        const newMatch = state.guestMatch !== data.match;
        if (!newMatch && !gameStarted) return;
        state.guestMatch = data.match;
        MAP_WIDTH = data.width;
        MAP_HEIGHT = data.height;
        currentGameMode = data.mode;
        players = data.players;
        bots = [];
        player = players.find(entity => entity.id === data.remoteId);
        if (!player) return;
        players.forEach(entity => { entity.isHuman = entity === player; });
        obstacles = data.obstacles;
        bushes = data.bushes;
        healthPacks = data.healthPacks;
        crateBoxes = data.crates;
        pickupItems = data.pickups;
        lasers = data.lasers;
        aiLasers = [];
        superEffects = data.effects;
        currentBotDifficultyInfo = data.difficulty;
        if (newMatch) {
            hideAllUI();
            panel.style.display = 'none';
            document.body.classList.add('game-active');
            gameStarted = true;
            state.guestFrame = requestAnimationFrame(renderGuest);
        }
    }

    function renderGuest() {
        state.guestFrame = null;
        if (state.role !== 'guest' || !gameStarted) return;
        ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        updateCamera();
        drawBackground();
        drawObstacles();
        drawHealthPacks();
        drawPlayers();
        drawBushes();
        drawSuperEffects();
        drawLasers();
        drawShootAimPreview();
        drawHUD();
        state.guestFrame = requestAnimationFrame(renderGuest);
    }

    async function sync() {
        if (!state.role || state.busy) return;
        const role = state.role;
        state.busy = true;
        try {
            const result = await request('sync', state.role === 'host' ? { snapshot: snapshot() } : { input: input() });
            if (state.role !== role) return;
            state.lastContact = performance.now();
            state.connectionLost = false;
            if (state.role === 'host') {
                if (state.guest && !result.guest && gameStarted) finish('Your friend disconnected.');
                state.guest = result.guest;
                state.controls = result.input || {};
                message(gameStarted ? 'Red Team | Battle in progress' : state.guest ? `${state.guest.name} joined. Team ready.` : 'Waiting for a friend to join this room.');
            } else {
                state.host = result.snapshot?.host || state.host;
                applySnapshot(result.snapshot);
                if (!result.snapshot?.ended) message(gameStarted ? 'Red Team | Battle in progress' : 'Connected. Waiting for the host.');
                else renderTeam();
            }
        } catch (error) {
            state.connectionLost = true;
            message(error.message);
            if (performance.now() - state.lastContact > 10000) await leave(false);
        } finally {
            state.busy = false;
        }
    }

    async function connect(role) {
        if (state.role || state.busy || gameStarted || battleIntroInProgress) return;
        state.busy = true;
        state.connecting = true;
        document.getElementById('lan-copy-status').textContent = '';
        message('Connecting...');
        try {
            const payload = role === 'host' ? {} : {
                code: document.getElementById('lan-code').value.trim().toUpperCase(),
                name: getCurrentProfile()?.username || 'Friend', characterId: selectedNexusId,
                gadget: getOwnedGadgetKeysForPlayer(selectedNexusId)[0] || '',
            };
            const result = await request(role === 'host' ? 'create' : 'join', payload);
            state.role = role;
            state.code = result.code;
            state.token = result.token;
            state.host = null;
            state.connectionLost = false;
            state.lastContact = performance.now();
            state.timer = setInterval(sync, 100);
            message(role === 'host' ? 'Room created. Share the code with your friend.' : 'Joined. Waiting for the host.');
        } catch (error) {
            message(error.message);
        } finally {
            state.busy = false;
            state.connecting = false;
            renderTeam();
        }
    }

    function finish(text) {
        gameStarted = false;
        state.ended = text;
        if (battleIntroTimerId !== null) clearTimeout(battleIntroTimerId);
        battleIntroTimerId = null;
        battleIntroInProgress = false;
        if (gameLoopRequestId !== null) cancelAnimationFrame(gameLoopRequestId);
        gameLoopRequestId = null;
        if (state.guestFrame !== null) cancelAnimationFrame(state.guestFrame);
        state.guestFrame = null;
        document.body.classList.remove('game-active');
        Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });
        mouseShootAimActive = false;
        resetMoveJoystick();
        resetShootJoystick();
        showAllUI();
        panel.style.display = 'block';
        message(`${text} LAN practice: no currency or ranked rewards.`);
    }

    async function leave(notify = true) {
        if (!state.role || state.leaving) return;
        state.leaving = true;
        renderTeam();
        if (notify) await request('leave').catch(() => {});
        clearInterval(state.timer);
        finish('Room closed.');
        state.role = null;
        state.code = '';
        state.token = '';
        state.guest = null;
        state.host = null;
        state.remote = null;
        state.controls = {};
        state.guestMatch = 0;
        state.connectionLost = false;
        state.leaving = false;
        document.getElementById('lan-copy-status').textContent = '';
        message('Disconnected. You can play solo or create another room.');
    }

    window.lanGame = {
        get active() { return !!state.role; },
        get guest() { return state.role === 'guest'; },
        canStart() {
            if (state.role === 'guest') { message('Only the host can start the battle.'); return false; }
            if (state.role === 'host' && !state.guest) { message('Wait for your friend to join.'); return false; }
            return true;
        },
        prepare() {
            if (state.role !== 'host') return;
            const ally = bots.find(entity => entity.team === player.team);
            if (!ally) throw new Error('Co-op requires an allied bot slot.');
            const pd = playersData[state.guest.characterId] || playersData.default;
            Object.assign(ally, pd, {
                id: 'lan_guest', characterId: pd.id, name: state.guest.name,
                maxHp: Math.round(pd.hp * COMBAT_STAT_SCALE), currentHp: Math.round(pd.hp * COMBAT_STAT_SCALE),
                laserDamage: Math.round(pd.laserDamage * COMBAT_STAT_SCALE),
                isBot: false, isHuman: false, isRemote: true, shootCooldown: 0,
                regenTimer: 0, regenCooldown: 0, lanGadgetKey: state.guest.gadget,
            });
            bots = bots.filter(entity => entity !== ally);
            state.remote = ally;
            state.match++;
            state.ended = '';
            state.remoteSequence = -1;
            state.usedSuper = 0;
            state.usedGadget = 0;
            panel.style.display = 'none';
        },
        updateRemote() {
            const remote = state.remote;
            if (state.role !== 'host' || !remote || remote.currentHp <= 0) return;
            const controls = state.controls;
            updatePlayerRegen(remote);
            if (remote._stunTimer > 0) return;
            if (controls.seq !== state.remoteSequence) {
                state.remoteSequence = controls.seq;
                state.remoteSeen = performance.now();
            }
            if (performance.now() - state.remoteSeen > 500) return;
            const dx = Math.max(-1, Math.min(1, Number(controls.dx) || 0));
            const dy = Math.max(-1, Math.min(1, Number(controls.dy) || 0));
            const length = Math.max(1, Math.hypot(dx, dy));
            const speed = remote.speed * (remote._slowTimer > 0 ? 0.4 : remote._speedTimer > 0 ? 1.6 : 1);
            if (remote._speedTimer > 0) remote._speedTimer--;
            if (remote._damageTimer > 0) remote._damageTimer--;
            const oldX = remote.x, oldY = remote.y;
            displaceEntitySafely(remote, dx / length * speed, dy / length * speed);
            remote.vx = remote.x - oldX;
            remote.vy = remote.y - oldY;
            checkHealthPackCollision(remote);
            const aimX = Math.max(0, Math.min(MAP_WIDTH, Number(controls.aimX) || remote.x));
            const aimY = Math.max(0, Math.min(MAP_HEIGHT, Number(controls.aimY) || remote.y));
            if (remote.shootCooldown > 0) remote.shootCooldown--;
            if (controls.fire && remote.shootCooldown <= 0) {
                const aimDx = aimX - remote.x - remote.size / 2;
                const aimDy = aimY - remote.y - remote.size / 2;
                const distance = Math.hypot(aimDx, aimDy);
                if (distance > 0) {
                    botFireAttack(remote, aimDx / distance, aimDy / distance, 12);
                    remote.shootCooldown = 20;
                    remote.bushRevealTimer = 90;
                }
            }
            if (controls.super > state.usedSuper) {
                state.usedSuper = controls.super;
                activateSuper(remote, aimX, aimY);
            }
            if (controls.gadget > state.usedGadget) {
                state.usedGadget = controls.gadget;
                if (remote.gadgetCooldown <= 0 && getEquippedGadgetInfo(remote)) activateGadget(remote, aimX, aimY);
            }
        },
        action(kind) {
            if (kind === 'super') state.superSequence++;
            if (kind === 'gadget') state.gadgetSequence++;
        },
        finish,
    };

    document.getElementById('lan-open').addEventListener('click', () => { renderTeam(); panel.style.display = 'block'; });
    document.getElementById('lan-live-room').addEventListener('click', () => { renderTeam(); panel.style.display = 'block'; });
    document.getElementById('lan-copy-code').addEventListener('click', copyCode);
    document.getElementById('lan-create').addEventListener('click', () => connect('host'));
    document.getElementById('lan-join').addEventListener('click', () => connect('guest'));
    document.getElementById('lan-leave').addEventListener('click', () => leave());
    document.getElementById('lan-start').addEventListener('click', () => {
        if (!state.role) { message('Create a room first.'); return; }
        if (!window.lanGame.canStart()) return;
        currentGameMode = '3v3';
        startGame();
    });
    document.getElementById('lan-code').addEventListener('input', event => {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 6);
    });
    document.getElementById('lan-code').addEventListener('keydown', event => {
        if (event.key === 'Enter') document.getElementById('lan-join').click();
    });
    window.addEventListener('blur', () => {
        Object.keys(keysPressed).forEach(key => { keysPressed[key] = false; });
        mouseShootAimActive = false;
        resetMoveJoystick();
        resetShootJoystick();
    });
    message('Create a room or join your friend on the same Wi-Fi.');
})();