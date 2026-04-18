# Props Asset Directory

Each subfolder corresponds to a dungeon theme and maps directly to a floor texture in `assets/textures/floors/`.

## Theme → Folder Map

| Floor Texture | Props Folder |
|---|---|
| `Abandoned Mine.jpg` | `abandoned_mine/` |
| `Arcane Laboratory.jpg` | `arcane_laboratory/` |
| `Celestial.jpg` | `celestial/` |
| `Classic Dungeon.jpg` | `classic_dungeon/` |
| `Clockwork.jpg` | `clockwork/` |
| `Corrupted Temple.jpg` | `corrupted_temple/` |
| `Crypt.jpg` | `crypt/` |
| `Crystal Cavern.jpg` | `crystal_cavern/` |
| `Drow Temple.jpg` | `drow_temple/` |
| `Eldritch.jpg` | `eldritch/` |
| `Forest.jpg` | `forest/` |
| `Frozen.jpg` | `frozen/` |
| `Fungal Underdark.jpg` | `fungal_underdark/` |
| `Infernal.jpg` | `infernal/` |
| `Lava.jpg` | `lava/` |
| `Modern.jpg` | `modern/` |
| `Natural Cave.jpg` | `natural_cave/` |
| `Sewer.jpg` | `sewer/` |
| `Sunken Ruins.jpg` | `sunken_ruins/` |
| `Underwater.jpg` | `underwater/` |
| `Volcanic.jpg` | `volcanic/` |

## Conventions

- All props must be **PNG with transparency**
- Recommended size: **64×64px** or **128×128px** at standard resolution
- Filename is the prop key referenced by `THEME_PRESETS` in `server.py`
- Each folder has a `README.md` listing the intended props for that theme
- Props can be shared across themes — just place the same file in multiple folders
  or symlink it (Windows: copy to keep things simple)

## Generic Props (shared)

The root-level `props/` files (`bones.png`, `skull.png`, etc.) are theme-agnostic fallbacks used
when a themed subfolder has no matching prop for a given slot.
