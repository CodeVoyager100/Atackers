// Game initialization
        const gameCanvas = document.getElementById('gameCanvas');
        const ctx = gameCanvas.getContext('2d');

        // Game variables
        let obstacles = [];
        let gameStarted = false;
        let lasers = [];
        let aiLasers = [];
        let healthPacks = [];
        let crateBoxes = [];
        let pickupItems = [];
        let players = [];
        let bots = [];
        let player = null;
        let totalPlayersAtStart = 0;
        let killFeed = [];
        let matchStatsList = [];
        let bushes = [];

        // Camera system
        let camera = { x: 0, y: 0, width: 0, height: 0 };
        let MAP_WIDTH = 2000;
        let MAP_HEIGHT = 2000;
        let damagePopups = [];
        let screenShakeTimer = 3;
        let screenShakeStrength = 10;
        let healPickupEffects = [];
        let gasWisps = [];

        function spawnHealPickupEffect(x, y, burst = 1) {
            for (let i = 0; i < 7 + burst * 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.8 + Math.random() * (1.4 + burst * 0.35);
                healPickupEffects.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.4,
                    size: 4 + Math.random() * 4,
                    timer: 26 + Math.floor(Math.random() * 16)
                });
            }
        }

        const inMemoryStorage = Object.create(null);
        let temporarySessionMode = false;

        function storageGetItem(key) {
            if (temporarySessionMode) {
                return Object.prototype.hasOwnProperty.call(inMemoryStorage, key) ? inMemoryStorage[key] : null;
            }
            try {
                return localStorage.getItem(key);
            } catch (e) {
                return Object.prototype.hasOwnProperty.call(inMemoryStorage, key) ? inMemoryStorage[key] : null;
            }
        }

        function storageSetItem(key, value) {
            const stringValue = String(value);
            if (temporarySessionMode) {
                inMemoryStorage[key] = stringValue;
                return;
            }
            try {
                localStorage.setItem(key, stringValue);
            } catch (e) {
                inMemoryStorage[key] = stringValue;
            }
        }

        function storageRemoveItem(key) {
            if (temporarySessionMode) {
                delete inMemoryStorage[key];
                return;
            }
            try {
                localStorage.removeItem(key);
            } catch (e) {
                delete inMemoryStorage[key];
            }
        }

        // Migrate old playerXP key to playerMedals
        if (storageGetItem('playerXP') !== null && storageGetItem('playerMedals') === null) {
            storageSetItem('playerMedals', storageGetItem('playerXP'));
            storageRemoveItem('playerXP');
        }

        // Migrate legacy player keys to nexus naming
        if (storageGetItem('unlockedNexus') === null && storageGetItem('unlockedPlayers') !== null) {
            storageSetItem('unlockedNexus', storageGetItem('unlockedPlayers'));
        }
        if (storageGetItem('selectedNexusId') === null && storageGetItem('selectedPlayerId') !== null) {
            storageSetItem('selectedNexusId', storageGetItem('selectedPlayerId'));
        }

        function parseStorageJson(raw, fallback) {
            if (typeof raw !== 'string') return fallback;
            try {
                const parsed = JSON.parse(raw);
                return parsed === null ? fallback : parsed;
            } catch (e) {
                return fallback;
            }
        }

        function readStorageJson(key, fallback) {
            return parseStorageJson(storageGetItem(key), fallback);
        }

        function deepCloneConfig(value, fallback) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (e) {
                return fallback;
            }
        }

        const externalGameData = (typeof window !== 'undefined' && window.GAME_DATA) ? window.GAME_DATA : {};
        const defaultBalanceSandboxSettings = {
            botSuperMinMs: 800,
            botSuperMaxMs: 1600,
            botShootChanceMultiplier: 1,
            botCooldownMultiplier: 1,
            ...(externalGameData.balanceSandboxDefaults || {})
        };
        const balanceSandboxSettings = {
            ...defaultBalanceSandboxSettings,
            ...(externalGameData.balanceSandboxDefaults || {})
        };

        // Game state (persisted via localStorage)
        let playerCoins = parseInt(storageGetItem('playerCoins') ?? '0');
        let unlockedNexus = readStorageJson('unlockedNexus', ['default']);
        let selectedNexusId = storageGetItem('selectedNexusId') ?? 'default';
        let playerMedals = parseInt(storageGetItem('playerMedals') ?? '0');
        let playerLevel = Math.floor(playerMedals / 10) + 1;
        let killFeedColor = storageGetItem('killFeedColor') ?? '#ffffff';
        let energySparks = parseInt(storageGetItem('energySparks') ?? '0');
        let playerCredits = parseInt(storageGetItem('playerCredits') ?? '0');
        let creditTierPick = readStorageJson('creditTierPick', {});
        let selectedCreditTargetId = storageGetItem('selectedCreditTargetId') ?? null;
        let playerPowerLevels = readStorageJson('playerPowerLevels', {});
        let unlockedGadgets = readStorageJson('unlockedGadgets', ['default']);
        let playerMedalsByNexus = readStorageJson('playerMedalsByNexus', {});
        let claimedNexusMedalMilestones = readStorageJson('claimedNexusMedalMilestones', {});
        let playerMatchesPlayed = parseInt(storageGetItem('playerMatchesPlayed') ?? '0');
        let rankedPoints = parseInt(storageGetItem('rankedPoints') ?? '1000');
        let rankedSeasonId = storageGetItem('rankedSeasonId') ?? '';
        let clanState = readStorageJson('clanState', { name: '', points: 0, wins: 0 });
        let pompakisBombVariant = storageGetItem('pompakisBombVariant') ?? 'classic';
        let selectedKillEffect = storageGetItem('selectedKillEffect') ?? 'classic';
        const DAILY_WINS_MAX = 8;
        let dailyWinsState = { day: '', wins: 0 };
        let pendingStarDrops = 0;
        let killCamTimer = 0;
        let killCamText = '';
        let killCamSeenTs = 0;
        let activeMapEvent = null;
        let mapEventCooldown = 480;
        let currentBotDifficultyInfo = { skillPct: 0, label: 'starter' };
        let battleIntroInProgress = false;
        let battleIntroTimerId = null;
        let forceEasyIntroBattle = false;

        // â”€â”€â”€ ACCOUNT & PROFILE SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let accountAuthMode = 'login';
        let currentAccount = null;
        let currentAccountKey = '__guest__';
        let guestProfile = null;
        const PROFILE_AVATAR_ICONS = ['ðŸ˜€', 'ðŸ˜Ž', 'ðŸ¤–', 'ðŸ”¥', 'âš¡', 'ðŸ›¡ï¸', 'ðŸ‘‘', 'ðŸ', 'ðŸ¦¾', 'ðŸŽ¯', 'ðŸš€', 'â­','ðŸ–','ðŸ’˜'];
        const TITLE_REWARDS = [
            { key: 'Rookie', unlockMedals: 0 },
            { key: 'Contender', unlockMedals: 60 },
            { key: 'Warlord', unlockMedals: 150 },
            { key: 'Legend', unlockMedals: 320 }
        ];
        const KILL_EFFECTS = {
            classic: { name: 'Classic âš¡', icon: 'âš¡', unlockMedals: 0 },
            fire: { name: 'Fire ðŸ”¥', icon: 'ðŸ”¥', unlockMedals: 90 },
            neon: { name: 'Neon âœ¨', icon: 'âœ¨', unlockMedals: 200 }
        };
        const POMPAKIS_BOMB_VARIANTS = {
            classic: { name: 'Classic Bomb', speed: 6.2, life: 130, damageMult: 1.9, aoeRadius: 70 },
            sticky: { name: 'Sticky Bomb', speed: 4.9, life: 165, damageMult: 2.1, aoeRadius: 80 },
            impact: { name: 'Impact Bomb', speed: 8.1, life: 95, damageMult: 1.6, aoeRadius: 54 }
        };
        const DAILY_WIN_CREDIT_AMOUNTS = [10, 15, 20, 25, 30, 35];

        function hashSeedString(str) {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        }

        function makeSeededRng(seed) {
            let s = seed >>> 0;
            return function() {
                s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
                return s / 4294967296;
            };
        }

        function buildDailyWinRewards(dayKey) {
            const rng = makeSeededRng(hashSeedString(`daily_wins_${dayKey}`));
            const rewards = [];

            for (let i = 0; i < DAILY_WINS_MAX; i++) {
                const roll = rng();
                if (roll < 0.30) {
                    rewards.push({ type: 'chest', icon: 'ðŸ“¦', short: 'Chest', text: 'Chest Drop' });
                } else if (roll < 0.62) {
                    const idx = Math.floor(rng() * DAILY_WIN_CREDIT_AMOUNTS.length);
                    const amount = DAILY_WIN_CREDIT_AMOUNTS[Math.max(0, Math.min(DAILY_WIN_CREDIT_AMOUNTS.length - 1, idx))];
                    rewards.push({ type: 'credits', amount, icon: 'ðŸŽ–ï¸', short: `+${amount}`, text: `+${amount} Hero Marks` });
                } else {
                    const tierBonus = i >= 4 ? 1.2 : 1;
                    const coins = Math.round((70 + Math.floor(rng() * 81)) * tierBonus);
                    const sparks = Math.round((10 + Math.floor(rng() * 19)) * tierBonus);
                    rewards.push({ type: 'resources', coins, sparks, icon: 'ðŸ’°', short: '+Res', text: `+${coins} Coins +${sparks} Sparks` });
                }
            }

            // Guarantee at least 2 chest drops daily.
            const chestCount = rewards.filter(r => r.type === 'chest').length;
            if (chestCount < 2) {
                for (let i = 0; i < 2 - chestCount; i++) {
                    const slot = Math.min(DAILY_WINS_MAX - 1, i * 3 + 1);
                    rewards[slot] = { type: 'chest', icon: 'ðŸ“¦', short: 'Chest', text: 'Chest Drop' };
                }
            }

            return rewards;
        }

        function getDailyWinRewards() {
            return buildDailyWinRewards(getDailyKey());
        }

        function playDailyWinRewardFx(reward) {
            const fx = document.getElementById('daily-wins-fx');
            const tracker = document.getElementById('daily-wins-tracker');
            if (!fx || !reward) return;
            fx.classList.remove('show');
            if (tracker) tracker.classList.remove('claiming');
            fx.textContent = `+ ${reward.text}`;
            // Restart animation reliably
            void fx.offsetWidth;
            fx.classList.add('show');
            if (tracker) {
                void tracker.offsetWidth;
                tracker.classList.add('claiming');
                setTimeout(() => tracker.classList.remove('claiming'), 700);
            }
        }

        function getCurrentSeasonId() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        function ensureRankedSeason() {
            const season = getCurrentSeasonId();
            if (rankedSeasonId === season) return;
            rankedSeasonId = season;
            rankedPoints = 1000;
            storageSetItem('rankedSeasonId', rankedSeasonId);
            storageSetItem('rankedPoints', String(rankedPoints));
        }

        function saveMetaProgress() {
            storageSetItem('rankedPoints', String(rankedPoints));
            storageSetItem('rankedSeasonId', rankedSeasonId);
            storageSetItem('clanState', JSON.stringify(clanState));
            storageSetItem('pompakisBombVariant', pompakisBombVariant);
            storageSetItem('selectedKillEffect', selectedKillEffect);
        }

        function loadDailyWinsState() {
            const today = getDailyKey();
            const saved = readStorageJson('dailyWinsState', null);
            if (saved && saved.day === today) {
                return { day: today, wins: Math.max(0, Math.min(DAILY_WINS_MAX, toSafeInt(saved.wins))) };
            }
            const fresh = { day: today, wins: 0 };
            storageSetItem('dailyWinsState', JSON.stringify(fresh));
            return fresh;
        }

        function saveDailyWinsState() {
            storageSetItem('dailyWinsState', JSON.stringify(dailyWinsState));
        }

        function ensureDailyWinsState() {
            const today = getDailyKey();
            if (!dailyWinsState || dailyWinsState.day !== today) {
                dailyWinsState = { day: today, wins: 0 };
                saveDailyWinsState();
            }
        }

        function renderDailyWinsWidget(claimedIndex = null) {
            ensureDailyWinsState();
            const labelEl = document.getElementById('daily-wins-label');
            const slotsEl = document.getElementById('daily-wins-slots');
            if (!labelEl || !slotsEl) return;
            const rewards = getDailyWinRewards();

            const wins = dailyWinsState.wins;
            const pageStart = wins >= 4 ? 4 : 0;
            const pageDone = Math.max(0, Math.min(4, wins - pageStart));
            labelEl.textContent = `ðŸŽ Daily Wins: ${wins}/${DAILY_WINS_MAX} ${pageStart === 0 ? '(1-4)' : '(5-8)'}`;

            let html = '';
            for (let i = 0; i < 4; i++) {
                const done = i < pageDone;
                const reward = rewards[pageStart + i] || rewards[0];
                const isClaiming = claimedIndex !== null && (pageStart + i) === claimedIndex;
                html += `<div class="daily-win-slot${done ? ' done' : ''}${isClaiming ? ' claiming' : ''}" title="${reward.text}"><span>${reward.icon}</span><small>${reward.short}</small></div>`;
            }
            slotsEl.innerHTML = html;
        }

        function awardDailyWinReward() {
            ensureDailyWinsState();
            if (dailyWinsState.wins >= DAILY_WINS_MAX) return null;
            const rewards = getDailyWinRewards();
            const reward = rewards[dailyWinsState.wins] || rewards[0];
            const claimedIndex = dailyWinsState.wins;
            dailyWinsState.wins++;
            if (reward.type === 'chest') {
                pendingStarDrops++;
            } else if (reward.type === 'credits') {
                playerCredits += Math.max(0, toSafeInt(reward.amount));
            } else if (reward.type === 'resources') {
                playerCoins += Math.max(0, toSafeInt(reward.coins));
                energySparks += Math.max(0, toSafeInt(reward.sparks));
            }
            saveDailyWinsState();
            saveProgress();
            showCoins();
            renderDailyWinsWidget(claimedIndex);
            playDailyWinRewardFx(reward);
            return reward;
        }

        function getEquippedTitle(profile) {
            return profile?.selectedTitle || profile?.title || 'Guest';
        }

        function isTitleUnlocked(titleKey) {
            const info = TITLE_REWARDS.find(t => t.key === titleKey);
            return !!info && playerMedals >= info.unlockMedals;
        }

        function isKillEffectUnlocked(effectKey) {
            const info = KILL_EFFECTS[effectKey];
            return !!info && playerMedals >= info.unlockMedals;
        }

        function normalizeUsername(value) {
            return (value || '').trim().toLowerCase();
        }

        function sanitizeProfileName(value) {
            const cleaned = (value || '').replace(/\s+/g, ' ').trim();
            if (cleaned.length < 3) return { ok: false, message: 'Name must be at least 3 characters.' };
            if (cleaned.length > 20) return { ok: false, message: 'Name must be 20 characters or less.' };
            return { ok: true, value: cleaned };
        }

        function getAccountsStore() {
            return readStorageJson('nexusAccounts', {});
        }

        function saveAccountsStore(store) {
            storageSetItem('nexusAccounts', JSON.stringify(store));
        }

        function getCurrentProfile() {
            return currentAccount?.profile || guestProfile || null;
        }

        let accountChipLevelExpanded = false;

        function toggleAccountChipLevel() {
            accountChipLevelExpanded = !accountChipLevelExpanded;
            updateAccountChip();
        }

        function updateAccountChip() {
            const chipName = document.getElementById('account-chip-name');
            const chipLevel = document.getElementById('account-chip-level');
            const chipStats = document.getElementById('account-chip-stats');
            const profile = getCurrentProfile();
            const avatar = profile?.avatarIcon || 'ðŸ‘¤';
            const title = getEquippedTitle(profile);
            chipName.textContent = profile ? `${avatar} [${title}] ${profile.username}` : 'Guest';
            if (chipLevel) {
                if (profile) {
                    const medalsIntoLevel = ((playerMedals % 10) + 10) % 10;
                    const pct = Math.max(0, Math.min(100, Math.round((medalsIntoLevel / 10) * 100)));
                    chipLevel.style.display = 'block';
                    chipLevel.innerHTML =
                        `<div class="account-chip-level-main">ðŸ… Level ${playerLevel}</div>
                        <div class="account-chip-level-track"><div class="account-chip-level-fill" style="width:${pct}%"></div></div>
                        <div class="account-chip-level-next">${10 - medalsIntoLevel} medals to next level</div>`;
                } else {
                    chipLevel.style.display = 'none';
                    chipLevel.innerHTML = '';
                    accountChipLevelExpanded = false;
                }
            }
            if (chipStats) {
                chipStats.innerHTML = profile
                    ? `<div class="account-chip-stat coins">ðŸ’° Coins<span class="v">${playerCoins}</span></div>
                       <div class="account-chip-stat sparks">âš¡ Sparks<span class="v">${energySparks}</span></div>`
                    : '';
            }
        }

        function saveCurrentAccountProfile() {
            const profile = getCurrentProfile();
            if (!profile) return;
            if (!currentAccount || currentAccountKey === '__guest__') {
                storageSetItem('nexusGuestProfile', JSON.stringify(profile));
                return;
            }
            const store = getAccountsStore();
            if (!store[currentAccountKey]) {
                storageSetItem('nexusGuestProfile', JSON.stringify(profile));
                return;
            }
            store[currentAccountKey].profile = profile;
            saveAccountsStore(store);
        }

        function setCurrentAccount(usernameKey) {
            const store = getAccountsStore();
            const acc = store[usernameKey] || null;
            currentAccount = acc;
            if (acc) {
                currentAccountKey = usernameKey;
                storageSetItem('nexusCurrentAccount', usernameKey);
                acc.profile.lastLoginAt = Date.now();
                store[usernameKey] = acc;
                saveAccountsStore(store);
            } else {
                currentAccountKey = '__guest__';
                storageRemoveItem('nexusCurrentAccount');
            }
            updateAccountChip();
        }

        function setAccountAuthMode(mode) {
            accountAuthMode = mode === 'register' ? 'register' : 'login';
            const loginTab = document.getElementById('account-tab-login');
            const registerTab = document.getElementById('account-tab-register');
            const submitBtn = document.getElementById('account-submit-btn');

            const loginActive = accountAuthMode === 'login';
            loginTab.style.background = loginActive ? '#2b8bb8' : '#203040';
            loginTab.style.color = loginActive ? '#001822' : '#9fe9ff';
            registerTab.style.background = loginActive ? '#203040' : '#2b8bb8';
            registerTab.style.color = loginActive ? '#9fe9ff' : '#001822';
            submitBtn.textContent = loginActive ? 'Login' : 'Create Account';
            document.getElementById('account-auth-msg').textContent = '';
        }

        function setAccountAuthMessage(text, ok = false) {
            const el = document.getElementById('account-auth-msg');
            el.style.color = ok ? '#7df7ab' : '#ff9da0';
            el.textContent = text || '';
        }

        function showAccountOverlay() {
            document.getElementById('account-auth-overlay').style.display = 'flex';
            document.getElementById('account-username').focus();
        }

        function hideAccountOverlay() {
            document.getElementById('account-auth-overlay').style.display = 'none';
        }

        function registerAccount(username, password) {
            const store = getAccountsStore();
            const key = normalizeUsername(username);
            const rawName = (username || '').trim();
            const trimmedPassword = (password || '').trim();
            if (!key || key.length < 3) return { ok: false, message: 'Name must be at least 3 characters.' };
            if (trimmedPassword.length < 4) return { ok: false, message: 'Password must be at least 4 characters.' };
            if (store[key]) return { ok: false, message: 'Name already exists.' };

            store[key] = {
                username: key,
                password: trimmedPassword,
                profile: {
                    username: rawName,
                    bio: '',
                    country: '',
                    favoriteNexus: 'default',
                    avatarIcon: 'ðŸ˜€',
                    avatarColor: '#44ccff',
                    title: 'Rookie',
                    killEffect: 'classic',
                    createdAt: Date.now(),
                    lastLoginAt: Date.now(),
                    profileVersion: 1
                }
            };
            saveAccountsStore(store);
            return { ok: true, key };
        }

        function loginAccount(username, password) {
            const store = getAccountsStore();
            const key = normalizeUsername(username);
            const acc = store[key];
            if (!acc) return { ok: false, message: 'Account not found.' };
            if (acc.password !== password) return { ok: false, message: 'Wrong password.' };
            return { ok: true, key };
        }

        function initAccountSystem() {
            const savedGuest = readStorageJson('nexusGuestProfile', null);
            guestProfile = {
                username: (savedGuest?.username || localStorage.getItem('profileName') || 'Guest').toString().trim() || 'Guest',
                avatarIcon: savedGuest?.avatarIcon || localStorage.getItem('profileAvatar') || 'ðŸ˜€',
                title: savedGuest?.title || 'Rookie',
                selectedTitle: savedGuest?.selectedTitle || null,
                killEffect: savedGuest?.killEffect || localStorage.getItem('selectedKillEffect') || 'classic',
                createdAt: savedGuest?.createdAt || Date.now(),
                lastLoginAt: Date.now(),
                profileVersion: 1
            };

            currentAccount = { profile: guestProfile };
            currentAccountKey = '__guest__';
            storageSetItem('nexusCurrentAccount', '__guest__');
            storageSetItem('nexusGuestProfile', JSON.stringify(guestProfile));

            const authOverlay = document.getElementById('account-auth-overlay');
            if (authOverlay) authOverlay.style.display = 'none';

            const logoutBtn = document.getElementById('account-logout-btn');

            if (logoutBtn) {
                logoutBtn.style.display = 'none';
            }

            updateAccountChip();
        }

        function getMaxWinStreakPlayerFromHistory() {
            const history = loadMatchHistory().slice().reverse();
            const streakByCharacter = {};
            let bestCharacterId = null;
            let bestStreak = 0;

            for (const h of history) {
                const cid = h.characterId || 'default';
                if (h.result === 'win') {
                    streakByCharacter[cid] = (streakByCharacter[cid] || 0) + 1;
                    if (streakByCharacter[cid] > bestStreak) {
                        bestStreak = streakByCharacter[cid];
                        bestCharacterId = cid;
                    }
                } else {
                    streakByCharacter[cid] = 0;
                }
            }

            if (!bestCharacterId) return { name: 'No streak yet', streak: 0 };
            return { name: playersData[bestCharacterId]?.name || bestCharacterId, streak: bestStreak };
        }

        // â”€â”€â”€ PROFILE STATS & ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function getProfilePerformanceStats(accountKey = null) {
            const history = loadMatchHistory(accountKey);
            if (!history || history.length === 0) {
                return {
                    wins: 0, losses: 0, winrate: 0, totalKills: 0,
                    avgSurvival: 0, totalDamage: 0, matchCount: 0
                };
            }

            const wins = history.filter(h => h.result === 'win').length;
            const losses = history.filter(h => h.result === 'loss').length;
            const winrate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;
            const totalKills = history.reduce((sum, h) => sum + (h.kills || 0), 0);
            const totalSurvival = history.reduce((sum, h) => sum + (h.survivedSeconds || 0), 0);
            const avgSurvival = history.length > 0 ? Math.round(totalSurvival / history.length) : 0;
            const totalDamage = history.reduce((sum, h) => sum + (h.damageDealt || 0), 0);

            return {
                wins, losses, winrate, totalKills, avgSurvival, totalDamage, matchCount: history.length
            };
        }

        function getTopCharactersByPerformance(accountKey = null, limit = 3) {
            const history = loadMatchHistory(accountKey);
            if (!history || history.length === 0) return [];

            const charStats = {};
            history.forEach(match => {
                const charId = match.characterId || 'unknown';
                if (!charStats[charId]) {
                    charStats[charId] = { wins: 0, total: 0, kills: 0, damage: 0, name: playersData[charId]?.name || charId };
                }
                charStats[charId].total++;
                if (match.result === 'win') charStats[charId].wins++;
                charStats[charId].kills += match.kills || 0;
                charStats[charId].damage += match.damageDealt || 0;
            });

            return Object.entries(charStats)
                .map(([id, stats]) => ({
                    id,
                    name: stats.name,
                    winrate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
                    wins: stats.wins,
                    total: stats.total,
                    kills: stats.kills,
                    damage: stats.damage
                }))
                .sort((a, b) => b.winrate - a.winrate || b.kills - a.kills)
                .slice(0, limit);
        }

        function renderProfilePanel() {
            const profile = getCurrentProfile();
            if (!profile) return;

            // Display username with avatar
            document.getElementById('profile-username').textContent = `${profile.avatarIcon || 'ðŸ˜€'} ${profile.username}`;
            const nameInput = document.getElementById('profile-name-input');
            if (nameInput) nameInput.value = profile.username || '';

            // Display max win streak
            const maxWs = getMaxWinStreakPlayerFromHistory();
            document.getElementById('profile-max-winstreak').textContent = `${maxWs.name} (${maxWs.streak})`;

            // Update avatar button states
            const avatarWrap = document.getElementById('profile-avatar-options');
            const currentAvatar = profile.avatarIcon || 'ðŸ˜€';
            avatarWrap.querySelectorAll('button').forEach(btn => {
                const isActive = btn.textContent === currentAvatar;
                btn.style.borderColor = isActive ? '#8de3ff' : '#384a60';
                btn.style.background = isActive ? '#24445a' : '#142034';
            });

            // Update favorite player select and image
            const favSelect = document.getElementById('profile-favorite-player');
            favSelect.value = profile.favoriteNexus || (Object.values(playersData).find(pd => unlockedNexus.includes(pd.id))?.id || 'default');
            const imgEl = document.getElementById('profile-fav-player-img');
            if (imgEl) imgEl.src = playersData[favSelect.value]?.img || '';

            // Update kill feed color button states
            const killFeedColors = ['#ffffff', '#ffcc00', '#ff4444', '#44ccff', '#44ff88', '#ff88ff', '#ffaa00'];
            const colorWrap = document.getElementById('profile-killfeed-colors');
            colorWrap.querySelectorAll('button').forEach((btn, idx) => {
                const isActive = killFeedColor === killFeedColors[idx];
                btn.style.borderColor = isActive ? killFeedColors[idx] : '#384a60';
                btn.style.background = isActive ? killFeedColors[idx] + '30' : '#142034';
            });

            // Update ranked info
            const rankedInfo = document.getElementById('profile-ranked-info');
            ensureRankedSeason();
            rankedInfo.textContent = `Season ${rankedSeasonId} â€¢ RP ${rankedPoints}`;

            // Update bomb variant select
            const bombSelect = document.getElementById('profile-bomb-variant');
            bombSelect.value = pompakisBombVariant;

            // Update title select and highlight unlocked
            const titleSelect = document.getElementById('profile-title');
            const equippedTitle = getEquippedTitle(profile);
            titleSelect.value = isTitleUnlocked(equippedTitle) ? equippedTitle : 'Rookie';

            // Update kill effect select and highlight unlocked
            const fxSelect = document.getElementById('profile-kill-effect');
            selectedKillEffect = profile.killEffect && isKillEffectUnlocked(profile.killEffect) ? profile.killEffect : 'classic';
            fxSelect.value = selectedKillEffect;

            // Update clan info display
            const clanInfo = document.getElementById('profile-clan-info');
            clanInfo.innerHTML = clanState.name
                ? `<strong>${clanState.name}</strong> â€¢ ${clanState.points || 0} pts â€¢ ${clanState.wins || 0} wins`
                : 'ðŸ“­ No clan joined - build your team!';

            // Render medal badges
            const medalsEntries = Object.values(playersData)
                .filter(pd => unlockedNexus.includes(pd.id))
                .map(pd => ({ id: pd.id, name: pd.name, medals: getNexusMedals(pd.id) }))
                .sort((a, b) => b.medals - a.medals || a.name.localeCompare(b.name));

            const medalsList = document.getElementById('profile-medals-list');
            if (medalsEntries.length === 0) {
                medalsList.innerHTML = '<div style="color:#7a9ab8; font-size:13px; text-align:center; padding:16px;">ðŸŽ® No medals earned yet. Play some matches!</div>';
            } else {
                medalsList.innerHTML = medalsEntries.map((m, i) => `
                    <button class="medal-btn" data-player-id="${m.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-radius:8px; margin:6px 0; background:${i === 0 ? 'linear-gradient(90deg, rgba(255,204,0,0.2) 0%, rgba(255,204,0,0.08) 100%)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${i === 0 ? '#b8860b' : '#2a4050'}; width:100%; cursor:pointer; transition:all 0.25s; box-shadow:${i === 0 ? '0 2px 8px rgba(255,204,0,0.15)' : 'none'};" onmouseover="this.style.background='${i === 0 ? 'rgba(255,204,0,0.28)' : 'rgba(255,255,255,0.08)'}'; this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(255,255,255,0.1)';" onmouseout="this.style.background='${i === 0 ? 'linear-gradient(90deg, rgba(255,204,0,0.2) 0%, rgba(255,204,0,0.08) 100%)' : 'rgba(255,255,255,0.03)'}'; this.style.transform='translateX(0)'; this.style.boxShadow='${i === 0 ? '0 2px 8px rgba(255,204,0,0.15)' : 'none'}';">
                        <div style="text-align:left; flex:1;">
                            <span style="color:#e6f3ff; font-size:13px; font-weight:600;">${m.name}</span>
                            ${i === 0 ? '<div style="font-size:10px; color:#ffcc00; margin-top:2px;">ðŸ¥‡ Highest Medal Count</div>' : ''}
                        </div>
                        <div style="text-align:right;">
                            <span style="color:#ffcc66; font-weight:bold; font-size:14px;">ðŸ… ${m.medals}</span>
                        </div>
                    </button>
                `).join('');
                document.querySelectorAll('.medal-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const playerId = btn.getAttribute('data-player-id');
                        selectedNexusId = playerId;
                        saveProgress();
                        renderProfilePanel();
                    });
                });
            }

            // â•â•â• QUICK RESOURCES DISPLAY â•â•â•
            document.getElementById('profile-coins-display').textContent = playerCoins || 0;
            document.getElementById('profile-sparks-display').textContent = energySparks || 0;
            document.getElementById('profile-medals-display').textContent = playerMedals || 0;
            document.getElementById('profile-credits-display').textContent = playerCredits || 0;

            // â•â•â• LEVEL PROGRESS BAR â•â•â•
            const medalsIntoLevel = playerMedals % 10;
            const progressPercent = (medalsIntoLevel / 10) * 100;
            const levelEl = document.getElementById('profile-level-display');
            const barEl = document.getElementById('profile-level-bar');
            if (levelEl) levelEl.textContent = `Level ${playerLevel} â€¢ ${medalsIntoLevel}/10`;
            if (barEl) barEl.style.width = `${progressPercent}%`;

            // â•â•â• MEDAL TIMELINE â•â•â•
            const timelineEl = document.getElementById('profile-medal-timeline');
            if (timelineEl) {
                const showUpTo = Math.max(playerMedals + 10, 20);
                const timelineHtml = [];
                for (let i = 0; i <= showUpTo; i++) {
                    const isUnlocked = i <= playerMedals;
                    const isCurrent = i === playerMedals;
                    timelineHtml.push(`
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; min-width:48px; flex-shrink:0;">
                            <div style="
                                width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;
                                background:${isCurrent ? 'linear-gradient(135deg, #4ae8d8, #44ccff)' : isUnlocked ? 'rgba(255,204,0,0.2)' : 'rgba(100,120,140,0.15)'};
                                border:2px solid ${isCurrent ? '#4ae8d8' : isUnlocked ? '#ffcc00' : '#384a5a'};
                                font-weight:bold; font-size:14px; color:${isCurrent ? '#fff' : isUnlocked ? '#ffcc00' : '#6a7a8a'};
                                box-shadow:${isCurrent ? '0 0 12px rgba(74,232,216,0.6)' : 'none'};
                                transition:all 0.2s;
                                cursor:pointer;
                            " title="${isCurrent ? 'Current' : isUnlocked ? 'Unlocked' : 'Locked'} â€¢ Medal ${i}">
                                ${isCurrent ? 'â­' : isUnlocked ? 'âœ“' : 'ðŸ”’'}
                            </div>
                            <div style="font-size:10px; color:${isUnlocked ? '#8de3ff' : '#6a7a8a'}; font-weight:600;">${i}</div>
                        </div>
                    `);
                }
                timelineEl.innerHTML = timelineHtml.join('');
                
                // Auto-scroll to current medal
                setTimeout(() => {
                    const currentBadge = timelineEl.querySelector('[title*="Current"]');
                    if (currentBadge) {
                        const containerWidth = timelineEl.clientWidth;
                        const badgePosition = currentBadge.offsetLeft;
                        timelineEl.scrollLeft = badgePosition - containerWidth / 2 + 24;
                    }
                }, 100);
            }

            // â•â•â• PERFORMANCE STATS â•â•â•
            const perfStats = getProfilePerformanceStats();
            const statsHtml = `
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #4ae8d8;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Wins</div>
                    <div style="font-size:16px; color:#7df7ab; font-weight:bold;">${perfStats.wins}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #ff6666;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Losses</div>
                    <div style="font-size:16px; color:#ff9999; font-weight:bold;">${perfStats.losses}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #ffcc00;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Winrate</div>
                    <div style="font-size:16px; color:#ffcc00; font-weight:bold;">${perfStats.winrate}%</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #ff44ff;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Total Kills</div>
                    <div style="font-size:16px; color:#ff88ff; font-weight:bold;">${perfStats.totalKills}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #44ff88;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Avg Survival</div>
                    <div style="font-size:16px; color:#7df7ab; font-weight:bold;">${perfStats.avgSurvival}s</div>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:6px; border-left:3px solid #ff8844;">
                    <div style="color:#9ab0c9; margin-bottom:2px; font-size:11px;">Total Damage</div>
                    <div style="font-size:16px; color:#ffaa66; font-weight:bold;">${perfStats.totalDamage}</div>
                </div>
            `;
            const statsEl = document.getElementById('profile-performance-stats');
            if (statsEl) statsEl.innerHTML = statsHtml;

            // â•â•â• TOP CHARACTERS â•â•â•
            const topChars = getTopCharactersByPerformance(null, 3);
            const charsEl = document.getElementById('profile-top-chars');
            if (charsEl) {
                if (topChars.length === 0) {
                    charsEl.innerHTML = '<div style="color:#7a9ab8; font-size:12px; text-align:center; padding:12px;">ðŸ“Š No match history yet</div>';
                } else {
                    charsEl.innerHTML = topChars.map((char, idx) => `
                        <div style="background:rgba(255,255,255,0.03); border-left:4px solid ${idx === 0 ? '#ffcc00' : idx === 1 ? '#c0c0c0' : '#cd7f32'}; padding:10px; border-radius:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span style="font-weight:600; color:#e6f3ff; font-size:13px;">${idx === 0 ? 'ðŸ¥‡' : idx === 1 ? 'ðŸ¥ˆ' : 'ðŸ¥‰'} ${char.name}</span>
                                <span style="background:${idx === 0 ? 'rgba(255,204,0,0.25)' : idx === 1 ? 'rgba(192,192,192,0.2)' : 'rgba(205,127,50,0.2)'}; color:${idx === 0 ? '#ffcc00' : idx === 1 ? '#c0c0c0' : '#cd7f32'}; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">${char.winrate}%</span>
                            </div>
                            <div style="display:flex; gap:16px; font-size:11px; color:#aaa;">
                                <span>ðŸŽ¯ ${char.wins}/${char.total} wins</span>
                                <span>âš”ï¸ ${char.kills} kills</span>
                                <span>ðŸ’¥ ${char.damage} dmg</span>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        function initProfilePanel() {
            const panel = document.getElementById('profile-panel');
            if (!panel || panel.dataset.profileBound === '1') return;

            // Panel open/close
            document.getElementById('account-chip-name').addEventListener('click', () => {
                renderProfilePanel();
                panel.style.display = 'block';
            });
            document.getElementById('close-profile-panel').addEventListener('click', () => {
                panel.style.display = 'none';
            });
            document.getElementById('profile-logout-btn').addEventListener('click', () => {
                panel.style.display = 'none';
            });
            document.getElementById('profile-logout-btn').style.display = 'none';

            // Profile name editing
            const profileNameInput = document.getElementById('profile-name-input');
            const profileNameSave = document.getElementById('profile-name-save');
            const profileNameMsg = document.getElementById('profile-name-msg');
            const applyProfileName = () => {
                const profile = getCurrentProfile();
                if (!profile || !profileNameInput || !profileNameMsg) return;
                const sanitized = sanitizeProfileName(profileNameInput.value);
                if (!sanitized.ok) {
                    profileNameMsg.style.color = '#ff9da0';
                    profileNameMsg.textContent = sanitized.message;
                    return;
                }

                profile.username = sanitized.value;
                saveCurrentAccountProfile();
                updateAccountChip();
                profileNameMsg.style.color = '#7df7ab';
                profileNameMsg.textContent = 'Name updated.';
                renderProfilePanel();
            };
            if (profileNameSave) profileNameSave.onclick = applyProfileName;
            if (profileNameInput) {
                profileNameInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        applyProfileName();
                    }
                };
            }

            // Avatar selection
            const avatarWrap = document.getElementById('profile-avatar-options');
            avatarWrap.innerHTML = '';
            const currentAvatar = (getCurrentProfile()?.avatarIcon) || 'ðŸ˜€';
            PROFILE_AVATAR_ICONS.forEach(icon => {
                const b = document.createElement('button');
                b.textContent = icon;
                const isActive = icon === currentAvatar;
                b.style.cssText = `width:38px; height:38px; border-radius:6px; border:2px solid ${isActive ? '#4ae8d8' : '#2a3a4a'}; background:${isActive ? 'rgba(74,232,216,0.15)' : '#0a1828'}; color:#fff; cursor:pointer; font-size:18px; transition:all 0.2s; font-weight:600;`;
                b.onmouseover = () => { if (!isActive) b.style.borderColor = '#36a8cc'; };
                b.onmouseout = () => { if (!isActive) b.style.borderColor = '#2a3a4a'; };
                b.onclick = () => {
                    const profile = getCurrentProfile();
                    if (!profile) return;
                    profile.avatarIcon = icon;
                    saveCurrentAccountProfile();
                    updateAccountChip();
                    renderProfilePanel();
                };
                avatarWrap.appendChild(b);
            });

            // Favorite player selection
            const favSelect = document.getElementById('profile-favorite-player');
            favSelect.innerHTML = '';
            Object.values(playersData)
                .filter(pd => unlockedNexus.includes(pd.id))
                .forEach(pd => {
                    const opt = document.createElement('option');
                    opt.value = pd.id;
                    opt.textContent = pd.name;
                    favSelect.appendChild(opt);
                });
            favSelect.onchange = () => {
                const profile = getCurrentProfile();
                if (!profile) return;
                profile.favoriteNexus = favSelect.value;
                saveCurrentAccountProfile();
                renderProfilePanel();
            };

            // Kill feed color selection
            const killFeedColors = ['#ffffff', '#ffcc00', '#ff4444', '#44ccff', '#44ff88', '#ff88ff', '#ffaa00'];
            const colorNames = ['White', 'Gold', 'Red', 'Cyan', 'Green', 'Magenta', 'Orange'];
            const colorWrap = document.getElementById('profile-killfeed-colors');
            colorWrap.innerHTML = '';
            killFeedColors.forEach((col, idx) => {
                const b = document.createElement('button');
                b.textContent = colorNames[idx];
                const isActive = killFeedColor === col;
                b.style.cssText = `padding:7px 10px; border-radius:6px; border:2px solid ${isActive ? col : '#2a3a4a'}; background:${isActive ? col + '20' : '#0a1828'}; color:${col}; cursor:pointer; font-size:11px; font-weight:bold; transition:all 0.2s;`;
                b.onmouseover = () => { if (!isActive) b.style.borderColor = col + '60'; };
                b.onmouseout = () => { if (!isActive) b.style.borderColor = '#2a3a4a'; };
                b.onclick = () => {
                    killFeedColor = col;
                    localStorage.setItem('killFeedColor', killFeedColor);
                    renderProfilePanel();
                };
                colorWrap.appendChild(b);
            });

            // Bomb variant selection
            const bombSelect = document.getElementById('profile-bomb-variant');
            bombSelect.onchange = () => {
                pompakisBombVariant = bombSelect.value;
                saveMetaProgress();
                showLootboxPopup(`Pompakis equipped: ${POMPAKIS_BOMB_VARIANTS[pompakisBombVariant]?.name || 'Classic Bomb'}`);
            };

            // Title selection
            const titleSelect = document.getElementById('profile-title');
            titleSelect.innerHTML = '';
            TITLE_REWARDS.forEach(t => {
                const opt = document.createElement('option');
                const unlocked = isTitleUnlocked(t.key);
                opt.value = t.key;
                opt.textContent = unlocked ? `${t.key}` : `${t.key} (unlock at ${t.unlockMedals} medals)`;
                opt.disabled = !unlocked;
                titleSelect.appendChild(opt);
            });
            titleSelect.onchange = () => {
                const profile = getCurrentProfile();
                if (!profile) return;
                profile.title = titleSelect.value;
                profile.selectedTitle = titleSelect.value;
                saveCurrentAccountProfile();
                updateAccountChip();
            };

            // Kill effect selection
            const fxSelect = document.getElementById('profile-kill-effect');
            fxSelect.innerHTML = '';
            Object.entries(KILL_EFFECTS).forEach(([key, cfg]) => {
                const opt = document.createElement('option');
                const unlocked = isKillEffectUnlocked(key);
                opt.value = key;
                opt.textContent = unlocked ? cfg.name : `${cfg.name} (unlock at ${cfg.unlockMedals} medals)`;
                opt.disabled = !unlocked;
                fxSelect.appendChild(opt);
            });
            fxSelect.onchange = () => {
                const profile = getCurrentProfile();
                if (!profile) return;
                selectedKillEffect = fxSelect.value;
                profile.killEffect = selectedKillEffect;
                saveCurrentAccountProfile();
                saveMetaProgress();
            };

            // Clan management
            document.getElementById('profile-clan-create').onclick = () => {
                const name = (window.prompt('Enter clan name (3-18 chars):', clanState.name || '') || '').trim();
                if (!name) return;
                if (name.length < 3 || name.length > 18) {
                    showLootboxPopup('Clan name must be 3-18 characters.');
                    return;
                }
                clanState.name = name;
                clanState.points = clanState.points || 0;
                clanState.wins = clanState.wins || 0;
                saveMetaProgress();
                renderProfilePanel();
            };
            document.getElementById('profile-clan-leave').onclick = () => {
                clanState = { name: '', points: 0, wins: 0 };
                saveMetaProgress();
                renderProfilePanel();
            };

            panel.dataset.profileBound = '1';
            renderProfilePanel();
        }

        // â”€â”€â”€ NEXUS MEDAL SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const NEXUS_MEDAL_MILESTONES = [25, 50, 100];

        function getNexusMedals(playerId) {
            return Math.max(0, playerMedalsByNexus[playerId] || 0);
        }

        function getNextNexusMedalMilestone(playerId) {
            const medals = getNexusMedals(playerId);
            for (const m of NEXUS_MEDAL_MILESTONES) {
                if (medals < m) return m;
            }
            return null;
        }

        function isNexusMedalMilestoneClaimed(playerId, milestone) {
            const claimed = claimedNexusMedalMilestones[playerId] || [];
            return claimed.includes(milestone);
        }

        function markNexusMedalMilestoneClaimed(playerId, milestone) {
            if (!claimedNexusMedalMilestones[playerId]) claimedNexusMedalMilestones[playerId] = [];
            if (!claimedNexusMedalMilestones[playerId].includes(milestone)) {
                claimedNexusMedalMilestones[playerId].push(milestone);
            }
        }

        function claimNexusMedalMilestones(playerId) {
            const medals = getNexusMedals(playerId);
            const messages = [];
            const playerName = playersData[playerId]?.name || playerId;

            for (const milestone of NEXUS_MEDAL_MILESTONES) {
                if (medals < milestone) continue;
                if (isNexusMedalMilestoneClaimed(playerId, milestone)) continue;

                if (milestone === 25) {
                    const candidateGadgets = getCharacterGadgetKeys(playerId)
                        .filter(k => gadgetData[k] && !unlockedGadgets.includes(k));
                    if (candidateGadgets.length > 0) {
                        unlockedGadgets.push(candidateGadgets[0]);
                        messages.push(`ðŸ… ${playerName} Medal ${milestone}: unlocked gadget ${gadgetData[candidateGadgets[0]].name}!`);
                    } else {
                        playerCoins += 300;
                        messages.push(`ðŸ… ${playerName} Medal ${milestone}: +300 coins!`);
                    }
                } else if (milestone === 50) {
                    playerCoins += 700;
                    energySparks += 150;
                    messages.push(`ðŸ… ${playerName} Medal ${milestone}: +700 coins and +150 sparks!`);
                } else if (milestone === 100) {
                    playerCredits += 10;
                    energySparks += 500;
                    messages.push(`ðŸ… ${playerName} Medal ${milestone}: +10 Hero Marks and +500 sparks!`);
                }

                markNexusMedalMilestoneClaimed(playerId, milestone);
            }

            return messages;
        }

        // Upgrade cost table: [sparks, coins] per level, indexed by rarity
        const upgradeCosts = {
            common:    [[10,50],[15,80],[25,120],[35,180],[50,250],[70,350],[100,500],[140,700],[190,1000],[250,1400],[320,1800],[400,2200],[500,2800]],
            rare:      [[15,80],[25,120],[35,180],[50,260],[75,380],[100,500],[140,700],[190,1000],[250,1400],[320,1800],[400,2200],[500,2800],[620,3500]],
            epic:      [[20,120],[35,180],[50,260],[75,380],[100,500],[140,700],[200,1000],[270,1400],[350,1800],[440,2300],[550,2800],[680,3500],[850,4200]],
            mythic:    [[30,180],[45,260],[70,380],[100,520],[140,700],[200,1000],[280,1400],[380,1800],[500,2400],[640,3000],[800,3800],[1000,4800],[1250,6000]],
            legendary: [[40,250],[60,380],[90,520],[130,720],[180,1000],[260,1400],[360,2000],[500,2800],[680,3600],[900,4600],[1150,5800],[1450,7200],[1800,9000]]
        };

        function getPlayerPowerLevel(playerId) {
            if (!playerPowerLevels || typeof playerPowerLevels !== 'object' || Array.isArray(playerPowerLevels)) {
                playerPowerLevels = {};
            }
            return Math.max(1, toSafeInt(playerPowerLevels[playerId] || 1));
        }

        function getUpgradeCost(playerId) {
            const pData = playersData[playerId];
            const level = getPlayerPowerLevel(playerId);
            if (level >= 14) return null; // Max level
            const costs = upgradeCosts[pData.rarity] || upgradeCosts.common;
            return { sparks: costs[level - 1][0], coins: costs[level - 1][1] };
        }

        function toSafeInt(value) {
            const n = Number(value);
            return Number.isFinite(n) ? Math.floor(n) : 0;
        }

        function upgradePlayer(playerId) {
            const cost = getUpgradeCost(playerId);
            if (!cost) return false;
            const currentSparks = toSafeInt(energySparks);
            const currentCoins = toSafeInt(playerCoins);
            if (currentSparks < cost.sparks || currentCoins < cost.coins) return false;
            energySparks = currentSparks - cost.sparks;
            playerCoins = currentCoins - cost.coins;
            const currLevel = Math.max(1, toSafeInt(playerPowerLevels[playerId] || 1));
            playerPowerLevels[playerId] = currLevel + 1;
            saveProgress();
            showCoins();
            return true;
        }

        function getStatBonus(playerId) {
            const level = getPlayerPowerLevel(playerId);
            // Each level gives +4% HP, +4% damage
            const mult = 1 + (level - 1) * 0.04;
            return mult;
        }

        function saveProgress() {
            storageSetItem('playerCoins', playerCoins);
            storageSetItem('unlockedNexus', JSON.stringify(unlockedNexus));
            storageSetItem('selectedNexusId', selectedNexusId);
            storageSetItem('playerMedals', playerMedals);
            storageSetItem('killFeedColor', killFeedColor);
            storageSetItem('energySparks', energySparks);
            storageSetItem('playerCredits', playerCredits);
            storageSetItem('creditTierPick', JSON.stringify(creditTierPick));
            if (selectedCreditTargetId) storageSetItem('selectedCreditTargetId', selectedCreditTargetId);
            else storageRemoveItem('selectedCreditTargetId');
            storageSetItem('playerPowerLevels', JSON.stringify(playerPowerLevels));
            storageSetItem('unlockedGadgets', JSON.stringify(unlockedGadgets));
            storageSetItem('playerMedalsByNexus', JSON.stringify(playerMedalsByNexus));
            storageSetItem('claimedNexusMedalMilestones', JSON.stringify(claimedNexusMedalMilestones));
            storageSetItem('claimedLevelRewards', JSON.stringify(levelRewards.filter(r => r.claimed).map(r => r.level)));
        }

        function startTemporaryNewAccountSession() {
            temporarySessionMode = true;
            Object.keys(inMemoryStorage).forEach((k) => delete inMemoryStorage[k]);

            playerCoins = 0;
            unlockedNexus = ['default'];
            selectedNexusId = 'default';
            playerMedals = 0;
            playerLevel = 1;
            killFeedColor = '#ffffff';
            energySparks = 0;
            playerCredits = 0;
            creditTierPick = {};
            selectedCreditTargetId = null;
            playerPowerLevels = {};
            unlockedGadgets = ['default'];
            playerMedalsByNexus = {};
            claimedNexusMedalMilestones = {};
            playerMatchesPlayed = 0;
            rankedPoints = 1000;
            rankedSeasonId = '';
            clanState = { name: '', points: 0, wins: 0 };
            pompakisBombVariant = 'classic';
            selectedKillEffect = 'classic';
            currentWinStreak = 0;

            const tag = Math.floor(Math.random() * 9000) + 1000;
            guestProfile = {
                username: `NewGuest${tag}`,
                avatarIcon: 'ðŸ˜€',
                title: 'Rookie',
                selectedTitle: null,
                killEffect: 'classic',
                createdAt: Date.now(),
                lastLoginAt: Date.now(),
                profileVersion: 1
            };
            currentAccount = { profile: guestProfile };
            currentAccountKey = '__guest__';

            activeDailyKey = getDailyKey();
            dailyState = loadDailyChallenges(activeDailyKey);

            saveCurrentAccountProfile();
            saveProgress();
            showCoins();
            updateAccountChip();
            updatePlayerMenu();
            updateCharShowcase();
            renderCreditsPanel();
            updateDailyBadge();
            renderDailyWinsWidget();
        }

        let levelUpMessage = null; // { text, timer }
        let healMessage = null;    // { text, timer }

        function awardMedals(amount, characterId = null) {
            const oldLevel = Math.floor(playerMedals / 10) + 1;
            playerMedals = Math.max(0, playerMedals + amount);
            playerLevel = Math.floor(playerMedals / 10) + 1;
            const medalCharacterId = characterId || player?.characterId || selectedNexusId || 'default';
            playerMedalsByNexus[medalCharacterId] = Math.max(0, getNexusMedals(medalCharacterId) + amount);
            const milestoneMessages = claimNexusMedalMilestones(medalCharacterId);
            if (playerLevel > oldLevel) {
                levelUpMessage = { text: `Level Up! Level ${playerLevel}`, timer: 180 };
            }
            saveProgress();
            showCoins();
        }
        let currentGameMode = 'showdown';

        // Global combat scaling so HP numbers are in the thousands while pacing stays similar.
        const COMBAT_STAT_SCALE = 100;
        const ITEM_HEAL_AMOUNT = 30 * COMBAT_STAT_SCALE;
        const ITEM_SHIELD_AMOUNT = 30 * COMBAT_STAT_SCALE;
        const PASSIVE_REGEN_AMOUNT = 1 * COMBAT_STAT_SCALE;
        const POISON_TICK_DAMAGE = 1 * COMBAT_STAT_SCALE;

        // Poison gas zone (Showdown only)
        let poisonZone = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT, shrinking: false, timer: 0, phase: 0 };
        const POISON_DAMAGE = 2 * COMBAT_STAT_SCALE;
        const POISON_TICK_INTERVAL = 30; // frames between damage ticks
        const POISON_SHRINK_DELAY = 180; // ~3 seconds before first shrink
        const POISON_SHRINK_SPEED = 0.22; // pixels per frame per side
        const POISON_PHASE_LENGTH = 450;
        const POISON_PAUSE_LENGTH = 180;
        const POISON_PHASES = 5; // number of shrink phases

        // Ball-Goal mode state
        let ball = null;
        let goals = [];
        let teamScores = {};
        const BALL_GOAL_WIN_SCORE = 2;

        // Bounty mode state
        let bountyTimerFrames = 0;
        const BOUNTY_DURATION_FRAMES = 7200; // 2 minutes at 60fps

        // King of the Town mode state
        let kingTown = { timerFrames: 0, overtime: false, drawBanner: false, holdTeam: null, holdFrames: 0 };
        const KING_TOWN_DURATION_FRAMES = 10800; // 3 minutes at 60fps
        const KING_TOWN_HOLD_FRAMES = 600; // 10 seconds at 60fps
        const KING_TOWN_BASE_WIDTH = 56;
        const KING_TOWN_BASE_HEIGHT = 260;

        // Zone Capture mode state
        let captureZones = [];
        const ZONE_CAPTURE_MAX = 100;

        // Super ability effects (AoE zones, etc.)
        let superEffects = [];
        let snakeMinions = [];
        let huntearTraps = []; // { x, y, owner, life, triggered }

        // â”€â”€ Gadget system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let gadgetEffects = [];   // extra visual effects from gadgets

        const gadgetData = {
            default:          { name: 'âš¡ Sting Sprint',  icon: 'âš¡', cooldown: 480 },
            lazerman:         { name: 'âš¡ Laser Dash',    icon: 'âš¡', cooldown: 480 },
            fournakis:        { name: 'ðŸ”¥ Heat Burst',    icon: 'ðŸ”¥', cooldown: 480 },
            baklavasbazookos: { name: 'ðŸ’¥ Power Shot',    icon: 'ðŸ’¥', cooldown: 600 },
            firekoupepy:      { name: 'ðŸ”¥ Fire Trail',    icon: 'ðŸ”¥', cooldown: 480 },
            tornader:         { name: 'ðŸŒªï¸ Wind Gust',     icon: 'ðŸŒª', cooldown: 600 },
            boboshiros:       { name: 'ðŸ›¡ï¸ Rage Shield',   icon: 'ðŸ›¡', cooldown: 720 },
            kafekauboy:       { name: 'â˜• Coffee Boost',  icon: 'â˜•', cooldown: 600 },
            megagrinos:       { name: 'ðŸ˜± Micro Scream',  icon: 'ðŸ˜±', cooldown: 600 },
            kleftikomegazord: { name: 'ðŸ¤– Cloak',         icon: 'ðŸ¤–', cooldown: 720 },
            petras:           { name: 'ðŸª¨ Rock Toss',     icon: 'ðŸª¨', cooldown: 600 },
            rocky:            { name: 'ðŸ¥Š Charge Punch',  icon: 'ðŸ¥Š', cooldown: 480 },
            timor:            { name: 'ðŸ’£ Shrapnel Bomb', icon: 'ðŸ’£', cooldown: 600 },
            timor_mine:       { name: 'ðŸ§¨ Proximity Mine', icon: 'ðŸ§¨', cooldown: 540 },
            timor_rocket:     { name: 'ðŸš€ Rocket Dash',   icon: 'ðŸš€', cooldown: 480 },
            kleftros:         { name: 'ðŸƒ Shadow Step',   icon: 'ðŸƒ', cooldown: 600 },
            kapnas:           { name: 'ðŸ’¨ Smoke Puff',    icon: 'ðŸ’¨', cooldown: 480 },
            fidas:            { name: 'ðŸ Venom Nest',    icon: 'ðŸ', cooldown: 600 },
            pompakis:         { name: 'ðŸ«§ Bubble Guard',  icon: 'ðŸ«§', cooldown: 540 },
            shaado:           { name: 'ðŸŒ‘ Shade Blink',   icon: 'ðŸŒ‘', cooldown: 560 },
            thifer:           { name: 'ðŸ‘œ Swipe Dash',    icon: 'ðŸ‘œ', cooldown: 560 },
            gobanana:         { name: 'ðŸŒ Banana Ring',   icon: 'ðŸŒ', cooldown: 520 },
            freze:            { name: 'â„ï¸ Ice Dash',       icon: 'â„ï¸', cooldown: 540 },
            kara:             { name: 'ðŸŒ‘ Dark Barrier',   icon: 'ðŸŒ‘', cooldown: 600 },
            punchpunch:       { name: 'ðŸ¥Š Guard Step',    icon: 'ðŸ¥Š', cooldown: 500 },
            cardon:           { name: 'ðŸƒ Razor Guard',   icon: 'ðŸƒ', cooldown: 520 },
            slamforge:        { name: 'âš¡ Slam Guard',    icon: 'âš¡', cooldown: 560 },
            huntear:          { name: 'ðŸª¤ Bear Trap',      icon: 'ðŸª¤', cooldown: 540 },
            magnets:          { name: 'ðŸ§² Magnetic Pull',  icon: 'ðŸ§²', cooldown: 500 },
            bubl:             { name: 'ðŸ«§ Bubble Shield',  icon: 'ðŸ«§', cooldown: 560 },
        };

        const TIMOR_GADGET_KEYS = ['timor', 'timor_mine', 'timor_rocket'];
        const GADGET_PRICE_BY_RARITY = { common: 120, rare: 260, epic: 420, mythic: 620, legendary: 900 };

        function getCharacterGadgetKeys(playerId) {
            return playerId === 'timor' ? TIMOR_GADGET_KEYS.slice() : [playerId];
        }

        function getGadgetOwnerPlayerId(gadgetKey) {
            if (gadgetKey === 'timor_mine' || gadgetKey === 'timor_rocket') return 'timor';
            return gadgetKey;
        }

        function getGadgetPrice(gadgetKey) {
            const ownerId = getGadgetOwnerPlayerId(gadgetKey);
            const owner = playersData[ownerId];
            return GADGET_PRICE_BY_RARITY[owner?.rarity || 'rare'] || 260;
        }

        function getOwnedGadgetKeysForPlayer(playerId) {
            return getCharacterGadgetKeys(playerId).filter(k => unlockedGadgets.includes(k));
        }

        function getEquippedGadgetKey(entity) {
            const playerId = entity?.characterId || entity?.id;
            const owned = getOwnedGadgetKeysForPlayer(playerId);
            if (owned.length === 0) return null;
            if (playerId === 'timor') {
                const idx = entity._timorGadgetCycle || 0;
                return owned[idx % owned.length];
            }
            return owned[0];
        }

        function getEquippedGadgetInfo(entity) {
            const key = getEquippedGadgetKey(entity);
            return key ? gadgetData[key] : null;
        }

        function unlockGadget(gadgetKey) {
            if (!gadgetKey || !gadgetData[gadgetKey]) return false;
            if (unlockedGadgets.includes(gadgetKey)) return false;
            unlockedGadgets.push(gadgetKey);
            saveProgress();
            return true;
        }

        function buyGadget(gadgetKey) {
            if (!gadgetData[gadgetKey]) return false;
            if (unlockedGadgets.includes(gadgetKey)) return false;
            const price = getGadgetPrice(gadgetKey);
            if (playerCoins < price) return false;
            playerCoins -= price;
            if (!unlockGadget(gadgetKey)) return false;
            showCoins();
            return true;
        }

        function getRandomLockedGadgetKey() {
            const locked = Object.keys(gadgetData).filter(k => k !== 'default' && !unlockedGadgets.includes(k));
            if (locked.length === 0) return null;
            return locked[Math.floor(Math.random() * locked.length)];
        }

        // Image cache for all game images
        const imageCache = {};

        function loadImage(src) {
            if (!imageCache[src]) {
                imageCache[src] = new Image();
                imageCache[src].src = src;
                imageCache[src].onerror = function () {
                    console.warn('Failed to load image:', src);
                    imageCache[src]._failed = true;
                };
            }
            return imageCache[src];
        }

        function getPlayerAssetFolder(playerId) {
            return `images/players/${playerId}`;
        }

        function getPlayerPreferredImageSrc(playerLike) {
            if (!playerLike) return '';
            // Magnets in live matches: use minus/plus icon sprites.
            const charId = playerLike.characterId || playerLike.id;
            if (charId === 'magnets' && playerLike.currentHp !== undefined) {
                return playerLike._magnetsMinus === true ? 'images/minus.png' : 'images/plus.png';
            }
            const primary = playerLike.img || '';
            const fallback = playerLike.legacyImg || '';

            if (primary) {
                const entry = imageCache[primary];
                if (entry && entry.complete && !entry._failed && entry.naturalWidth > 0) {
                    return primary;
                }
            }

            return fallback || primary;
        }

        // Preload all images when game starts
        function preloadImages() {

            // Preload background
            loadImage('images/background.png');
            loadImage('images/teammap.png');

            // Preload chest images for star drops
            loadImage('images/chestclose.png');
            loadImage('images/chestopen.png');
            loadImage('images/freze.png');
            loadImage('images/kara.png');
            loadImage('images/brick new.png');
            loadImage('images/water new.png');

            // Preload player images
            Object.values(playersData).forEach(player => {
                if (player.img) {
                    loadImage(player.img);
                }
                if (player.legacyImg && player.legacyImg !== player.img) {
                    loadImage(player.legacyImg);
                }
            });

            // Preload Magnets live-form sprites
            loadImage('images/plus.png');
            loadImage('images/minus.png');
        }

        const playersData = {
            default: {
                id: 'default',
                name: 'soublakiscorpio',
                img: 'images/ScorpiosSouvlak.png',
                color: '#4a86e8',
                hp: 33,
                speed: 5.4,
                laserDamage: 3,
                size: 55,
                laserRange: 340,
                price: 0,
                rarity: 'common',
                attackType: 'standard',
                superType: 'burst',          // 8-laser starburst in all directions
                superName: 'ðŸ¦‚ Sting Burst'
            },
            lazerman: {
                id: 'lazerman',
                name: 'Lazerman',
                img: 'images/rot1.png',
                color: '#4ae84a',
                hp: 37,
                speed: 4,
                laserDamage: 2,
                size: 55,
                laserRange: 800,
                price: 0,
                rarity: 'rare',
                attackType: 'double',        // fires 2 parallel beams
                superType: 'piercebeam',     // one massive beam crossing the whole map
                superName: 'âš¡ Mega Beam'
            },
            fournakis: {
                id: 'fournakis',
                name: 'Fournakis',
                img: 'images/pkiotisfournos.png',
                color: '#e8e84a',
                hp: 32,
                speed: 5,
                laserDamage: 2,
                size: 55,
                laserRange: 400,
                price: 0,
                rarity: 'rare',
                attackType: 'spread',        // 3-shot spread
                superType: 'firezone',       // burning AoE zone for 3 s
                superName: 'ðŸ”¥ Fire Zone'
            },
            baklavasbazookos: {
                id: 'baklavasbazookos',
                name: 'Baklavasbazookos',
                img: 'images/baklavasbazooka.png',
                color: '#e8e84a',
                hp: 40,
                speed: 5,
                laserDamage: 3,
                size: 55,
                laserRange: 500,
                price: 0,
                rarity: 'rare',
                attackType: 'heavy',         // slow heavy ball that explodes on hit
                superType: 'bigshot',        // slow big projectile â†’ explodes on hit
                superName: 'ðŸ’¥ Bazooka Blast'
            },
            firekoupepy: {
                id: 'firekoupepy',
                name: 'Firekoupepy',
                img: 'images/firekoupepiy.png',
                color: '#e8e84a',
                hp: 40,
                speed: 5,
                laserDamage: 3,
                size: 55,
                laserRange: 450,
                price: 0,
                rarity: 'rare',
                attackType: 'rapid',         // fires 2 quick shots in succession
                superType: 'firedash',       // dash + damage trail
                superName: 'ðŸ”¥ Fire Dash'
            },
            // Epic â€” player picks ONE
            tornader: {
                id: 'tornader',
                name: 'Tornader',
                img: 'images/rot2.png',
                color: '#e84a4a',
                hp: 32,
                speed: 5,
                laserDamage: 3,
                size: 55,
                laserRange: 300,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'boomerang',     // curved projectile that returns
                superType: 'tornado',        // AoE tornado that pulls and damages
                superName: 'ðŸŒªï¸ Tornado'
            },
            boboshiros: {
                id: 'boboshiros',
                name: 'Boboshiros',
                img: 'images/boboshiros.png',
                color: '#e8e84a',
                hp: 45,
                speed: 5,
                laserDamage: 4,
                size: 55,
                laserRange: 550,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'triple',        // wide 3-shot fan
                superType: 'selfexplode',    // explosion around self
                superName: 'ðŸ’£ Bobom Blast'
            },
            kafekauboy: {
                id: 'kafekauboy',
                name: 'Kafekauboy',
                img: 'images/kafechinocauboyno.png',
                color: '#e8e84a',
                hp: 45,
                speed: 5,
                laserDamage: 3,
                size: 55,
                laserRange: 550,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'homing',        // projectile homes toward nearest enemy
                superType: 'coffeerush',     // 3Ã— speed + rapid fire for 4 s
                superName: 'â˜• Coffee Rush'
            },
            // Mythic â€” player picks ONE
            megagrinos: {
                id: 'megagrinos',
                name: 'Megagrinos',
                img: 'images/megagrinos.png',
                color: '#e8e84a',
                hp: 50,
                speed: 4,
                laserDamage: 4,
                size: 60,
                laserRange: 550,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'aoehit',        // laser that deals area damage on impact
                superType: 'scream',         // Mega scream AoE deals damage + slows all nearby enemies
                superName: 'ðŸ˜± Mega Scream'
            },
            // Legendary â€” player picks ONE
            kleftikomegazord: {
                id: 'kleftikomegazord',
                name: 'Kleftikomegazord',
                img: 'images/rot3.png',
                color: '#e8e84a',
                hp: 70,
                speed: 3,
                laserDamage: 6,
                size: 65,
                laserRange: 600,
                creditCost: 1000,
                rarity: 'legendary',
                attackType: 'double',        // fires powerful double beam
                superType: 'megazord',       // energy bar system: 2 charges, super costs 1 charge + invincibility + burst
                superName: 'ðŸ¤– Megazord Blast',
                hasEnergyBar: true,          // NEW: uses charge bar instead of free super
                energyCharges: 2,            // max 2 charges
                energyRegenFrames: 900       // 15 seconds per charge at 60fps
            },
            petras: {
                id: 'petras',
                name: 'Petras',
                img: 'images/Petras.png',
                color: '#e8e84a',
                hp: 50,
                speed: 2.5,
                laserDamage: 4,
                size: 60,
                laserRange: 550,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'heavy',         // slow heavy boulder shot
                superType: 'rockshield',     // damage immunity for 3 s
                superName: 'ðŸª¨ Rock Shield'
            },
            rocky: {
                id: 'rocky',
                name: 'Rocky',
                img: 'images/Rocky.png',
                color: '#e8e84a',
                hp: 50,
                speed: 2.5,
                laserDamage: 4,
                size: 60,
                laserRange: 550,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'spread',        // 3-shot spread punch
                superType: 'rockrush',       // charge forward, massive damage to everything in path
                superName: 'ðŸ¥Š Rock Rush'
            },
            timor: {
                id: 'timor',
                name: 'Timor',
                img: 'images/timor.png',
                color: '#7c3aed',
                hp: 50,
                speed: 3,
                laserDamage: 3,
                size: 58,
                laserRange: 420,
                price: 0,
                rarity: 'rare',
                attackType: 'clustercannon', // medium shells in a short spread
                superType: 'meteorstorm',    // multi-shell strike toward aimed location
                superName: 'â˜„ï¸ Meteor Storm',
                superNeedsAim: true
            },
            kleftros: {
                id: 'kleftros',
                name: 'Kleftros',
                img: 'images/Kleftros.png',
                color: '#f59e0b',
                hp: 28,
                speed: 6,
                laserDamage: 2,
                size: 50,
                laserRange: 350,
                price: 0,
                rarity: 'rare',
                attackType: 'boomerang',     // curved projectile that returns
                superType: 'firedash',       // fast dash + fire trail
                superName: 'ðŸƒ Dash & Burn',
                superNeedsAim: true
            },
            fidas: {
                id: 'fidas',
                name: 'Fidas',
                img: 'images/fidas.png',
                color: '#16a34a',
                hp: 30,
                speed: 5.5,
                laserDamage: 2,
                size: 50,
                laserRange: 340,
                price: 0,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'venomshot',     // venom projectiles that apply poison ticks
                superType: 'snakeswarm',     // summon 3 snake minions
                superName: 'ðŸ Snake Swarm',
                superNeedsAim: false
            },
            pompakis: {
                id: 'pompakis',
                name: 'Pompakis',
                img: 'images/pompakis.png',
                color: '#0ea5e9',
                hp: 34,
                speed: 4.5,
                laserDamage: 3,
                size: 54,
                laserRange: 380,
                price: 0,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'bombshot',      // throws explosive bombs
                superType: 'pompquake',      // knockback shockwave around target point
                superName: 'ðŸ«§ Pomp Quake',
                superNeedsAim: true
            },
            shaado: {
                id: 'shaado',
                name: 'Shaado',
                img: 'images/shado.png',
                color: '#6d28d9',
                hp: 32,
                speed: 5.8,
                laserDamage: 2,
                size: 50,
                laserRange: 360,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'shadowshot',
                superType: 'shadowburst',
                superName: 'ðŸŒ‘ Shadow Burst',
                superNeedsAim: true
            },
            thifer: {
                id: 'thifer',
                name: 'Thifer',
                img: 'images/thiefer.png',
                color: '#eab308',
                hp: 36,
                speed: 5.1,
                laserDamage: 2,
                size: 52,
                laserRange: 355,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'thiefshot',
                superType: 'pickpocket',
                superName: 'ðŸ‘œ Pickpocket Rush',
                superNeedsAim: false
            },
            gobanana: {
                id: 'gobanana',
                name: 'Gobanana',
                img: 'images/gobanan.png',
                color: '#f59e0b',
                hp: 40,
                speed: 4.9,
                laserDamage: 3,
                size: 54,
                laserRange: 370,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'bananaburst',
                superType: 'bananastorm',
                superName: 'ðŸŒ Banana Storm',
                superNeedsAim: false
            },
            kapnas: {
                id: 'kapnas',
                name: 'Kapnas',
                img: 'images/Kapnas.png',
                color: '#6b7280',
                hp: 55,
                speed: 3,
                laserDamage: 4,
                size: 60,
                laserRange: 480,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'spread',        // 3-shot smoke spread
                superType: 'smokezone',      // large slow+poison zone placed at aim target
                superName: 'ðŸ’¨ Smoke Zone',
                superNeedsAim: true
            },
            freze: {
                id: 'freze',
                name: 'Freze',
                img: 'images/freze.png',
                color: '#7dd3fc',
                hp: 38,
                speed: 4.5,
                laserDamage: 3,
                size: 54,
                laserRange: 420,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'iceshot',        // fast ice shard that slows on hit
                superType: 'icestorm',        // ice zone at target: slows + damages
                superName: 'â„ï¸ Ice Storm',
                superNeedsAim: true
            },
            kara: {
                id: 'kara',
                name: 'Kara',
                img: 'images/kara.png',
                color: '#c084fc',
                hp: 45,
                speed: 4,
                laserDamage: 4,
                size: 58,
                laserRange: 460,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'darkpulse',      // dark bolt; +60% dmg vs targets below 50% HP
                superType: 'darkrift',        // dark rift at target: pulls enemies + heavy damage
                superName: 'ðŸŒ‘ Dark Rift',
                superNeedsAim: true
            },
            punchpunch: {
                id: 'punchpunch',
                name: 'Punch-Punch',
                img: 'images/punch-punch.png',
                color: '#f97316',
                hp: 50,
                speed: 5.5,
                laserDamage: 4,
                size: 56,
                laserRange: 210,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'combojab',       // short-range multi-jab burst
                superType: 'punchflurry',     // chain AoE punches while moving
                superName: 'ðŸ‘Š Punch Flurry',
                superNeedsAim: false
            },
            cardon: {
                id: 'cardon',
                name: 'Cardon',
                img: 'images/cardon.png',
                color: '#e11d48',
                hp: 40,
                speed: 5.3,
                laserDamage: 3,
                size: 52,
                laserRange: 250,
                creditCost: 200,
                rarity: 'epic',
                attackType: 'cardslash',      // close fan of returning cards
                superType: 'cardcage',        // trap zone + radial card burst
                superName: 'ðŸƒ Card Cage',
                superNeedsAim: true
            },
            /* 
            //slamforge: {
            //    id: 'slamforge',
              //  name: 'Slamforge',
            //img: 'images/ScorpiosSouvlak3.png',
            //    color: '#ef4444',
              //  hp: 58,
                //speed: 4.3,
               // laserDamage: 4,
              //  size: 58,
              //  laserRange: 205,
             //   creditCost: 200,
             //   rarity: 'epic',
             //   attackType: 'shockknuckle',   // very short heavy strike shot
             //   superType: 'groundslam',      // stun + knockback around self
             //   superName: 'ðŸ’¥ Ground Slam',
             //   superNeedsAim: false
            //},
            */
            huntear: {
                id: 'huntear',
                name: 'Huntear',
                img: 'images/huntear.png',
                color: '#a16207',
                hp: 44,
                speed: 5,
                laserDamage: 4,
                size: 54,
                laserRange: 500,
                creditCost: 1000,
                rarity: 'legendary',
                attackType: 'arrowshot',      // arrow + delayed second arrow
                superType: 'traplayer',       // lay traps while moving for 5 s
                superName: 'ðŸª¤ Trap Field',
                superNeedsAim: false
            },
            magnets: {
                id: 'magnets',
                name: 'Magnets',
                img: 'images/magnets.png',
                color: '#ef4444',
                hp: 48,
                speed: 5,
                laserDamage: 3,
                size: 56,
                laserRange: 480,
                creditCost: 1000,
                rarity: 'legendary',
                attackType: 'magnetshot',
                superType: 'magnetswap',      // transform: spawn + companion, become - form
                superName: 'ðŸ§² Polarity Swap',
                superNeedsAim: false
            },
            bubl: {
                id: 'bubl',
                name: 'Bubl',
                img: 'images/bubl.png',
                color: '#0ea5e9',
                hp: 36,
                speed: 5.2,
                laserDamage: 2,
                size: 52,
                laserRange: 420,
                creditCost: 500,
                rarity: 'mythic',
                attackType: 'bubbleshot',      // fires expanding bubble projectiles
                superType: 'bubbleburst',       // creates floating bubble zones
                superName: 'ðŸ«§ Bubble Burst',
                superNeedsAim: false
            }
          
        };

        // Rarity colors and labels
        const rarityColors = {
            common:    '#b0b0b0',
            rare:      '#4a8af5',
            epic:      '#b44aff',
            mythic:    '#ff4a6a',
            legendary: '#ffaa00'
        };
        const rarityLabels = {
            common: 'Common', rare: 'Rare', epic: 'Epic', mythic: 'Mythic', legendary: 'Legendary'
        };
        // Rarities above rare are unlocked with credits (pick ONE per tier)
        const creditRarities = ['epic', 'mythic', 'legendary'];
        const creditRarityThresholds = { epic: 170, mythic: 420, legendary: 850 };
        const HERO_MARKS_MATCH_REWARDS = {
            win: { standard: 11, team: 16 },
            lose: { standard: 5, team: 7 }
        };

        // Keep Hero Marks pricing consistent for every player in the same rarity.
        Object.values(playersData).forEach(p => {
            if (!p.creditCost) return;
            const normalized = creditRarityThresholds[p.rarity];
            if (normalized) p.creditCost = normalized;
        });

        // Player assets are organized under images/players/<playerId>/
        // while keeping old image paths as fallback so existing files still render.
        Object.values(playersData).forEach(p => {
            const legacyImg = p.img || '';
            const folder = getPlayerAssetFolder(p.id);
            p.legacyImg = legacyImg;
            p.assetFolder = folder;
            p.skinsFolder = `${folder}/skins`;
            p.iconsFolder = `${folder}/icons`;
            p.otherFolder = `${folder}/other`;
            p.img = `${p.skinsFolder}/default.png`;
            p.icon = `${p.iconsFolder}/icon.png`;
        });

