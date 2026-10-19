# Atackers Restart TODO

Last reviewed: 2026-10-18

## Direction

- [x] Freeze the legacy game in the current repo as reference material only
- [x] Replace the active entry point with a minimal restart prototype
- [ ] Rebuild the game in small vertical slices instead of reviving the monolith

## Ranked Backlog: easiest to hardest to rebuild

### Easy

- [x] Single hero moving on one canvas
- [x] Static obstacle layout with collision
- [x] One small start screen with plain controls text
- [x] One map background image or simple painted floor
- [ ] Reset button and pause state
- [ ] Basic sprite fallback when an image fails to load
- [ ] Tight movement polish: slide cleanly along obstacle edges
- [ ] One simple ambient music track with mute toggle
- [ ] Basic settings: sound on or off, movement speed for testing

### Medium

- [ ] Shooting with one projectile type
- [ ] Destructible or blocking obstacles for projectiles
- [ ] Player HP, death, and restart loop
- [ ] One enemy bot with basic chase and shoot behavior
- [ ] One collectible or heal pickup
- [ ] Local save for a few values only: selected hero, coins, settings
- [ ] Very small character select with 3 heroes maximum
- [ ] One clean HUD for HP and one resource only
- [ ] Mobile movement joystick
- [ ] One real game mode only: showdown or 1v1 sandbox
- [ ] One simple reward loop after a match

### Hard

- [ ] Advanced bot AI: strafe, dodge, line-of-sight, retreat logic
- [ ] Multiple heroes with distinct base stats
- [ ] Unique attacks per hero
- [ ] Super ability system
- [ ] Gadget system
- [ ] More than one balanced map
- [ ] Team modes with team-safe spawning and no friendly fire
- [ ] Respawn rules for team matches
- [ ] Shrinking zone or other dynamic match objective
- [ ] Bounty, ball-goal, capture, or any extra mode beyond the core one
- [ ] Progression currencies such as coins, medals, sparks, or hero marks
- [ ] Unlock economy and rarity-based pricing
- [ ] Drop systems such as crates, star drops, or weighted rewards
- [ ] Match history, highlights, and post-game stat summaries
- [ ] Full mobile combat controls: aim, super, gadget, item buttons

### Hardest

- [ ] Account system with login, profile switching, and save migration
- [ ] Profile panel with stats, titles, avatars, favorites, and medals per hero
- [ ] Medal Road or any long-form progression track
- [ ] Daily quests, daily wins, seasonal rewards, and rotating mutators
- [ ] Ranked ladder with resets and reward tracks
- [ ] Bazaar or large shop with filters, search, and ownership states
- [ ] Tutorial onboarding flow with multiple scripted steps and rewards
- [ ] Analytics, telemetry, and retention funnels
- [ ] Replay system or deterministic event log
- [ ] Social systems: friends, clans, chat, private lobbies
- [ ] Shareable challenge cards or importable challenge codes

## Recommended rebuild order

- [ ] Finish the movement sandbox until it feels good on keyboard first
- [ ] Add one combat loop only: shoot, hit, lose, restart
- [ ] Add one enemy bot only after the player loop is stable
- [ ] Add one progression layer only after one mode is fun without it
- [ ] Do not rebuild profile, medals, bazaar, or account systems before the core loop is proven