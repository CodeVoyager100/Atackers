# Game Runtime Split

This folder contains the runtime split of `game.js` for easier maintenance.

## Load order

The files are order-dependent and must be loaded in this exact sequence after `game-data.js`:

1. `01-state-storage-profile.js`
2. `02-core-world-bots.js`
3. `03-rendering-and-objectives.js`
4. `04-combat-loop-and-supers.js`
5. `05-gadgets-companions.js`
6. `06-ui-init-and-modes.js`

`index.html` already uses this order.

## Source of truth

- `game.js` is still kept as the canonical monolithic source.
- The split files are generated from it by line ranges to preserve behavior.

## Safety check

Run this script to verify split files still match the monolith exactly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/game/validate-split.ps1
```

It returns a non-zero exit code if a mismatch is found.
