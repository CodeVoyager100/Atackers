const restartCanvas = document.getElementById('restart-canvas');
const restartContext = restartCanvas.getContext('2d');
const restartStage = document.getElementById('restart-stage');
const restartPlayButton = document.getElementById('restart-play-button');
const restartEndButton = document.getElementById('restart-end-button');
const restartPlayersButton = document.getElementById('restart-players-button');
const restartBazaarButton = document.getElementById('restart-bazaar-button');
const restartPlayersPanel = document.getElementById('restart-players-panel');
const restartBazaarPanel = document.getElementById('restart-bazaar-panel');
const restartCloseButtons = document.querySelectorAll('[data-close-panel]');
const restartStatus = document.getElementById('restart-status');
const restartPosition = document.getElementById('restart-position');
const restartSelectScorpios = document.getElementById('restart-select-scorpios');
const restartBazaarItems = document.querySelectorAll('.restart-bazaar-item');

const heroSprite = new Image();
heroSprite.src = 'images/ScorpiosSouvlak.png';

const backgroundImage = new Image();
backgroundImage.src = 'images/background.png';

let animationFrameId = null;
let lastFrameTime = 0;

const world = {
    width: restartCanvas.width,
    height: restartCanvas.height,
    started: false,
    selectedHeroName: 'ScorpiosSouvlak',
    hero: {
        x: 72,
        y: 72,
        width: 54,
        height: 54,
        speed: 180
    },
    keys: new Set(),
    obstacles: [
        { x: 180, y: 80, width: 90, height: 120, type: 'water' },
        { x: 360, y: 110, width: 150, height: 42, type: 'wall' },
        { x: 620, y: 70, width: 86, height: 150, type: 'wall' },
        { x: 120, y: 320, width: 140, height: 54, type: 'wall' },
        { x: 340, y: 260, width: 90, height: 170, type: 'water' },
        { x: 520, y: 280, width: 230, height: 46, type: 'wall' },
        { x: 770, y: 210, width: 92, height: 180, type: 'water' },
        { x: 230, y: 500, width: 170, height: 40, type: 'wall' },
        { x: 520, y: 470, width: 120, height: 72, type: 'water' }
    ]
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function intersects(rectA, rectB) {
    return (
        rectA.x < rectB.x + rectB.width &&
        rectA.x + rectA.width > rectB.x &&
        rectA.y < rectB.y + rectB.height &&
        rectA.y + rectA.height > rectB.y
    );
}

function resetHeroPosition() {
    world.hero.x = 72;
    world.hero.y = 72;
    updatePositionLabel();
}

function updatePositionLabel() {
    restartPosition.textContent = `Position: ${Math.round(world.hero.x)}, ${Math.round(world.hero.y)}`;
}

function tryMoveHero(nextX, nextY) {
    const nextRect = {
        x: clamp(nextX, 0, world.width - world.hero.width),
        y: clamp(nextY, 0, world.height - world.hero.height),
        width: world.hero.width,
        height: world.hero.height
    };

    for (const obstacle of world.obstacles) {
        if (intersects(nextRect, obstacle)) {
            return false;
        }
    }

    world.hero.x = nextRect.x;
    world.hero.y = nextRect.y;
    updatePositionLabel();
    return true;
}

function updateHero(deltaSeconds) {
    if (!world.started) {
        return;
    }

    const distance = world.hero.speed * deltaSeconds;
    let deltaX = 0;
    let deltaY = 0;

    if (world.keys.has('arrowup') || world.keys.has('w')) {
        deltaY -= distance;
    }
    if (world.keys.has('arrowdown') || world.keys.has('s')) {
        deltaY += distance;
    }
    if (world.keys.has('arrowleft') || world.keys.has('a')) {
        deltaX -= distance;
    }
    if (world.keys.has('arrowright') || world.keys.has('d')) {
        deltaX += distance;
    }

    if (deltaX !== 0) {
        tryMoveHero(world.hero.x + deltaX, world.hero.y);
    }
    if (deltaY !== 0) {
        tryMoveHero(world.hero.x, world.hero.y + deltaY);
    }
}

function drawBackground() {
    const skyGradient = restartContext.createLinearGradient(0, 0, 0, world.height);
    skyGradient.addColorStop(0, '#203a52');
    skyGradient.addColorStop(1, '#101820');
    restartContext.fillStyle = skyGradient;
    restartContext.fillRect(0, 0, world.width, world.height);

    if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
        restartContext.save();
        restartContext.globalAlpha = 0.28;
        restartContext.drawImage(backgroundImage, 0, 0, world.width, world.height);
        restartContext.restore();
    }

    restartContext.save();
    restartContext.fillStyle = 'rgba(255, 204, 0, 0.08)';
    for (let i = 0; i < 16; i += 1) {
        const x = (i * 113) % world.width;
        const y = (i * 71) % world.height;
        restartContext.beginPath();
        restartContext.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
        restartContext.fill();
    }
    restartContext.restore();

    restartContext.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    restartContext.lineWidth = 1;
    for (let x = 0; x <= world.width; x += 48) {
        restartContext.beginPath();
        restartContext.moveTo(x, 0);
        restartContext.lineTo(x, world.height);
        restartContext.stroke();
    }
    for (let y = 0; y <= world.height; y += 48) {
        restartContext.beginPath();
        restartContext.moveTo(0, y);
        restartContext.lineTo(world.width, y);
        restartContext.stroke();
    }
}

function drawObstacles() {
    for (const obstacle of world.obstacles) {
        if (obstacle.type === 'water') {
            restartContext.fillStyle = '#2d78a6';
            restartContext.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            restartContext.strokeStyle = 'rgba(173, 226, 255, 0.7)';
        } else {
            restartContext.fillStyle = '#6d4b34';
            restartContext.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            restartContext.strokeStyle = 'rgba(255, 214, 179, 0.55)';
        }

        restartContext.lineWidth = 2;
        restartContext.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
}

function drawHero() {
    const { x, y, width, height } = world.hero;

    restartContext.save();
    restartContext.shadowColor = 'rgba(255, 220, 120, 0.95)';
    restartContext.shadowBlur = 34;

    restartContext.beginPath();
    restartContext.fillStyle = 'rgba(255, 204, 0, 0.28)';
    restartContext.arc(x + width / 2, y + height / 2, width * 0.72, 0, Math.PI * 2);
    restartContext.fill();

    if (heroSprite.complete && heroSprite.naturalWidth > 0) {
        restartContext.drawImage(heroSprite, x, y, width, height);
    } else {
        restartContext.fillStyle = '#ffcc00';
        restartContext.fillRect(x, y, width, height);
    }

    restartContext.lineWidth = 3;
    restartContext.strokeStyle = '#ffe08a';
    restartContext.strokeRect(x - 2, y - 2, width + 4, height + 4);

    restartContext.restore();
}

function drawLabel() {
    restartContext.fillStyle = '#f8ead0';
    restartContext.font = 'bold 20px Georgia';
    restartContext.fillText(world.selectedHeroName, 24, 34);
    restartContext.font = '16px Georgia';
    restartContext.fillStyle = '#d7c7ab';
    restartContext.fillText(world.started ? 'Map is live' : 'Lobby ready', 24, 58);
}

function startSandbox() {
    if (world.started) {
        setStatus(`Now playing as ${world.selectedHeroName}`);
        restartCanvas.focus();
        return;
    }

    world.started = true;
    resetHeroPosition();
    document.body.classList.add('game-started');
    restartStage.hidden = false;
    closePanel(restartPlayersPanel);
    closePanel(restartBazaarPanel);
    setStatus(`Now playing as ${world.selectedHeroName}`);
    restartCanvas.focus();

    if (animationFrameId === null) {
        lastFrameTime = performance.now();
        animationFrameId = window.setInterval(() => gameLoop(performance.now()), 16);
    }
}

function endSandbox() {
    if (!world.started) {
        return;
    }

    world.started = false;
    document.body.classList.remove('game-started');
    restartStage.hidden = true;
    closePanel(restartPlayersPanel);
    closePanel(restartBazaarPanel);
    world.keys.clear();
    setStatus(`Selected hero: ${world.selectedHeroName}`);
    restartPlayButton.focus();
    render();
}

function openPanel(panel) {
    if (!panel) {
        return;
    }

    closePanel(restartPlayersPanel);
    closePanel(restartBazaarPanel);
    panel.hidden = false;
}

function closePanel(panel) {
    if (!panel) {
        return;
    }
    panel.hidden = true;
}

function setStatus(message) {
    restartStatus.textContent = message;
}

function render() {
    drawBackground();
    drawObstacles();
    drawHero();
    drawLabel();
}

function gameLoop(timestamp) {
    const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.033);
    lastFrameTime = timestamp;
    updateHero(deltaSeconds);
    render();
}

function moveHeroByKey(key) {
    const step = 12;

    if (key === 'arrowup' || key === 'w') {
        tryMoveHero(world.hero.x, world.hero.y - step);
        return;
    }

    if (key === 'arrowdown' || key === 's') {
        tryMoveHero(world.hero.x, world.hero.y + step);
        return;
    }

    if (key === 'arrowleft' || key === 'a') {
        tryMoveHero(world.hero.x - step, world.hero.y);
        return;
    }

    if (key === 'arrowright' || key === 'd') {
        tryMoveHero(world.hero.x + step, world.hero.y);
    }
}

function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === 'escape') {
        if (world.started) {
            endSandbox();
            return;
        }

        closePanel(restartPlayersPanel);
        closePanel(restartBazaarPanel);
        return;
    }

    if (!world.started && (key === 'enter' || key === ' ')) {
        event.preventDefault();
        startSandbox();
        return;
    }

    if (key === 'r') {
        resetHeroPosition();
        render();
        return;
    }

    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        world.keys.add(key);
        moveHeroByKey(key);
        render();
    }
}

window.addEventListener('keydown', handleKeyDown, true);
window.addEventListener('keyup', (event) => {
    world.keys.delete(event.key.toLowerCase());
}, true);
document.addEventListener('keydown', handleKeyDown, true);
document.addEventListener('keyup', (event) => {
    world.keys.delete(event.key.toLowerCase());
}, true);
restartCanvas.addEventListener('keydown', handleKeyDown, true);
restartCanvas.addEventListener('keyup', (event) => {
    world.keys.delete(event.key.toLowerCase());
}, true);

heroSprite.addEventListener('error', () => {
    heroSprite.src = '';
});

restartPlayButton.addEventListener('click', startSandbox);
restartEndButton.addEventListener('click', endSandbox);
restartCanvas.addEventListener('click', () => {
    restartCanvas.focus();
});
restartPlayersButton.addEventListener('click', () => openPanel(restartPlayersPanel));
restartBazaarButton.addEventListener('click', () => openPanel(restartBazaarPanel));
restartSelectScorpios.addEventListener('click', () => {
    world.selectedHeroName = 'ScorpiosSouvlak';
    setStatus('Selected hero: ScorpiosSouvlak');
    closePanel(restartPlayersPanel);
});
restartBazaarItems.forEach((button) => {
    button.addEventListener('click', () => {
        setStatus(`Bazaar item viewed: ${button.dataset.itemName}`);
        closePanel(restartBazaarPanel);
    });
});
restartCloseButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const panel = document.getElementById(button.dataset.closePanel);
        if (panel) {
            closePanel(panel);
        }
    });
});
restartPlayersPanel.addEventListener('click', (event) => {
    if (event.target === restartPlayersPanel) {
        closePanel(restartPlayersPanel);
    }
});
restartBazaarPanel.addEventListener('click', (event) => {
    if (event.target === restartBazaarPanel) {
        closePanel(restartBazaarPanel);
    }
});

resetHeroPosition();
updatePositionLabel();
render();