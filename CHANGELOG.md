# Changelog

All notable changes to RNK Free MapGen are documented in this file.

## [1.0.9] - 2026-07-18

### Fixed
- GMs (including Assistant GMs) now share Patreon-authenticated access automatically once any GM logs in — access is stored per-world and persists across reloads instead of requiring a fresh per-browser Patreon login every session
- Daily generation limit no longer applies to authenticated Patreon patrons; GM Hub now shows "Unlimited (Patreon access)" instead of the 3/day counter in that case
- Dungeon prop, furniture, and floor textures now load correctly instead of silently 404ing

## [1.0.8] - 2026-07-17

### Fixed
- Version bump to force Foundry to re-download and overwrite locally cached pre-1.0.7 files with the corrected mapgen-api.rnkstudios.uk endpoints

## [1.0.7] - 2026-07-17

### Fixed
- Server API moved to a new host; default Generator API URL and Patreon auth URL now point to mapgen-api.rnkstudios.uk

## [1.0.6] - 2026-05-02

### Fixed
- Normalized Foundry asset paths and regenerated release packaging

## [1.0.3] - 2026-04-18

### Added
- Foundry VTT v14 verified compatibility alongside v13
- Daily generation counter with 24-hour reset timer and clear UI feedback

### Fixed
- Trap placement logic corrected for edge-case room configurations
- Module metadata cleaned and finalized for initial public release

### Changed
- Generation counter UX updated to display time remaining until daily reset

## [1.0.0] - 2026-04-01

### Added
- Dungeon generation with 21 selectable themes: Abandoned Mine, Arcane Laboratory, Celestial, Classic Dungeon, Clockwork, Corrupted Temple, Crypt, Crystal Cavern, Drow Temple, Eldritch, Forest, Frozen, Fungal Underdark, Infernal, Lava, Modern, Natural Cave, Sewer, Sunken Ruins, Underwater, and Volcanic
- Theme-driven floor textures applied automatically to generated scenes
- Map width and height configuration from 20 to 200 tiles
- Grid size, tile size (8, 12, 16px), and grid type (square or hex) controls
- Fixed seed input for repeatable map generation
- Manual or auto scene naming
- GM Hub preview panel with PNG, SVG, and JSON export options
- Free tier: 3 generations per day with 24-hour reset
- Patreon integration to increase daily generation limit
- Deep Foundry VTT scene and canvas integration
