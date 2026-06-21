# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aakers is a single-file HTML5 canvas browser game with no build system, no package manager, and no external dependencies. All game logic, rendering, UI, and styles live in [index.html](index.html) (~2000 lines).

## Running the Game

No build step required. Open `index.html` directly in a browser, or serve it locally:

```bash
python -m http.server 8000
# or
npx http-server
```

VS Code is configured for Chrome debugging (port 9222) via [.vscode/launch.json](.vscode/launch.json).

## Architecture

The entire game is in [index.html](index.html). Key sections:

**Game state globals** — top of `<script>`: `players`, `bots`, `lasers`, `aiLasers`, `obstacles`, `camera`, `gameStarted`, `playerCoins`, `unlockedPlayers`, `selectedPlayerId`

**Data definitions:**
- `playersData` — 10 character definitions (id, name, img, hp, speed, laserDamage, laserRange, size, price)
- `gameModes` — "showdown" (FFA) and "teamBattle" (2v2) configs

**Core game loop** (`gameLoop()`):
1. `updateCamera()` — clamp camera to 2000×2000 map
2. `handleInputFrame()` — apply keyboard/joystick movement to human player
3. `updateAllBots()` — AI targeting, movement, shooting
4. `updateLasers()` — move lasers, check collisions, deal damage
5. `checkGameEnd()` — detect win/lose condition, award coins
6. Drawing phase: background → obstacles → players → lasers → HUD

**Bot AI** (`updateAllBots()`): bots chase the nearest target, strafe randomly, maintain ~60% of laser range distance, seek health packs when HP < 60%, only shoot when cooldown ready + in range + line-of-sight clear + 3% random chance.

**Collision**: AABB rectangle checks. Obstacles block both movement and lasers. Map boundary is 2000×2000.

**Rendering**: All drawing is camera-relative (subtract `camera.x`/`camera.y`). Human player gets a glow effect. HP bars are color-coded green→yellow→red.

## UI Flow

Main menu → select mode (🎮) or character (🔁 Switch Player) → start battle (⚔️) → game ends → return to menu. The Bazaar (🛒) lets players spend coins to unlock characters.

## Mobile Support

Joysticks are shown on touch devices or screens ≤1024px wide. Left joystick = movement, right joystick = aiming/shooting. Visibility is toggled by `initGame()`.

## Assets

- [images/](images/) — character PNGs and `background.png`

Images are preloaded into `imageCache` at startup; failed loads fall back to a magenta placeholder rectangle.

## Progression

Coins are stored in the `playerCoins` JS variable (not persisted to localStorage or a server — resets on page reload). Victory = +100 coins, defeat = +25 coins.
