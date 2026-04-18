# Changelog

All notable changes to RNK Free MapGen are documented in this file.

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
