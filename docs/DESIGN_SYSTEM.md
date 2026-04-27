# Hyvemind — Design System

## Core Aesthetic

Dark, high-contrast, neon-accented. Blueprint-on-black with violet/blue glows. The visual language is "intelligent" — precision engineering meets creative depth.

---

## Color Palette

All tokens defined in `src/index.css` as HSL CSS variables:

### Background Scale
| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `222 47% 6%` | Page background (deep navy-black) |
| `--card` | `222 40% 9%` | Card surfaces |
| `--sidebar` | `222 44% 7%` | Sidebar background |
| `--popover` | same as card | Tooltips, menus |

### Foreground Scale
| Token | Usage |
|-------|-------|
| `--foreground` | Primary text |
| `--muted-foreground` | Secondary labels, timestamps |
| `--card-foreground` | Text on cards |

### Brand / Accent
| Token | Usage |
|-------|-------|
| `--primary` | Violet accent — buttons, highlights, active states |
| `--primary-foreground` | Text on primary-colored backgrounds |
| `--ring` | Focus rings (same hue as primary) |

### Semantic
| Token | Hue | Usage |
|-------|-----|-------|
| `--destructive` | Red | Delete actions, errors |
| `--border` | Low-opacity white | Card borders, dividers |
| `--input` | Slightly lighter than card | Form fields |

### Gradient Utilities
```css
.bg-gradient-primary   /* Primary button gradient */
.bg-gradient-neon      /* Progress bar fill */
.text-gradient         /* Hero heading gradient text */
```

### Glow Shadows
```css
.shadow-violet         /* Violet glow — active nav, primary badges */
.neon-border           /* Shared border style */
.neon-violet           /* Violet neon glow variant */
.neon-subtle           /* Subdued glow — transcript, secondary cards */
```

---

## Typography

Font: **Poppins** (loaded via Google Fonts in `index.html`)  
Weights: 400 (body), 500 (labels), 600 (subheadings), 700 (headings), 800 (hero)

### Scale
| Size | Usage |
|------|-------|
| `text-7xl / text-5xl` | Hero heading (`h1`) |
| `text-2xl / text-3xl` | Page section titles |
| `text-xl` | Card titles |
| `text-base / text-lg` | Body copy |
| `text-sm` | Labels, metadata |
| `text-xs` | Timestamps, tags, badges |
| `text-[11px]` | Transcript timestamps (monospace) |

Transcript timestamps use `font-mono tabular-nums` for stable layout.

---

## Spacing & Layout

- **Sidebar width**: `w-64` (256px), fixed left
- **Main content offset**: `ml-64`
- **Top bar height**: `h-16`, fixed, `pt-24` on main content
- **Max content width**: `max-w-[1400px]`
- **Card grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `gap-8`
- **Section spacing**: `space-y-16`

---

## Animation System

### Scroll Reveal
Cards and sections enter on scroll via `IntersectionObserver`:
```css
.reveal { /* section wrapper */ }
.reveal.in-view { /* triggers children animations */ }
.reveal-stack > * { opacity: 0; transform: translateY(16px); }
.reveal.in-view .reveal-stack > * { opacity: 1; transform: translateY(0); }
```
Stagger delay: `nth-child` × 80ms (up to 8 items).

`prefers-reduced-motion`: transitions collapse to instant.

### Card Interactions
```css
.card-lift { transition: transform 200ms, box-shadow 200ms; }
.card-lift:hover { transform: translateY(-4px); }
```

### Blueprint Background
`src/index.css` `.blueprint-bg` — subtle dot grid + a few floating spark elements (`.blueprint-spark`) that pulse on a 3s loop.

---

## Component Patterns

### Neon Border Cards
```tsx
<div className="neon-border neon-violet overflow-hidden">
  {/* content */}
</div>
```

### Section Headers
```tsx
<SectionHeader title="..." subtitle="..." seeAllTo="/path" />
```

### Active State (Nav)
```tsx
// Active nav item — gradient pill
"bg-gradient-primary text-primary-foreground shadow-violet"
// Inactive
"text-sidebar-foreground hover:bg-sidebar-accent"
```

### Transcript Active Segment
```tsx
// Active line
"bg-primary/15 text-foreground"
// Inactive
"text-muted-foreground hover:bg-card/60 hover:text-foreground"
```
The leading edge accent bar: `h-4 w-0.5 bg-primary` (active) / `bg-transparent` (inactive).

### CC Toggle Button
```tsx
// Active (CC on)
"border-primary/70 bg-primary/20 text-primary-foreground shadow-violet"
// Inactive
"border-foreground/20 bg-background/60 text-foreground hover:border-foreground/40"
```

---

## Design Architecture

```
src/
  index.css          ← CSS variables, global utilities, animations
  components/
    ui/              ← shadcn/ui base components (Button, Dialog, Input…)
    dashboard/
      Header.tsx     ← Top bar (Clerk UserButton, search, notifications)
      Sidebar.tsx    ← Main app navigation (fixed left)
      MediaCard.tsx  ← ResourceCard + SectionHeader
    studio/
      StudioHeader   ← Studio-specific top bar
      StudioSidebar  ← Creator navigation (uses Clerk identity)
      StudioShell    ← Layout wrapper for studio pages
    VideoPlayer.tsx  ← Video + CC button + VTT track
    TranscriptPanel  ← Live-synced scrollable transcript
    EmptyLibraryState← Consistent empty state component
```

All base UI components come from **shadcn/ui** — do not re-implement buttons, dialogs, inputs, toasts, etc.
