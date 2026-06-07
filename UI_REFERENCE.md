---
name: Vibrant Professionalism
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#584237'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8c7164'
  outline-variant: '#e0c0b1'
  surface-tint: '#9d4300'
  primary: '#9d4300'
  on-primary: '#ffffff'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#ffb690'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#505f76'
  on-tertiary: '#ffffff'
  tertiary-container: '#8c9cb4'
  on-tertiary-container: '#243348'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  button-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is built for high-performance SaaS and technology platforms, targeting professionals who value efficiency and clarity. The brand personality is energetic yet disciplined, shifting from its previous calm tones to a high-visibility, action-oriented aesthetic. 

The design style follows **Corporate Modern** with a focus on high-energy accents. It utilizes a clean, systematic foundation—heavy on whitespace and precise alignment—while using a vibrant orange to drive user attention toward primary actions and critical data points. The emotional response should be one of confidence, momentum, and reliability.

## Colors
The color palette is anchored by a vibrant, professional orange (#f97316), which serves as the primary driver for all interactive states and brand expressions. 

- **Primary (#f97316):** Used for primary buttons, active slider tracks, checkboxes, and focused input borders. In dark mode, ensure the orange maintains a contrast ratio of at least 4.5:1 against surface colors.
- **Secondary (#0f172a):** A deep slate used for high-contrast text and dark-mode surfaces.
- **Tertiary (#64748b):** A muted slate for secondary information and icons.
- **Neutral (#f8fafc):** Light gray surfaces to provide a clean backdrop for the vibrant primary accents.

In dark mode, the primary orange remains the singular accent color, applied to "on-primary" elements with white text to ensure maximum legibility.

## Typography
The typography system prioritizes clarity and technical precision. **Hanken Grotesk** is used for headlines to provide a sharp, contemporary feel. **Inter** handles the bulk of the body content for its exceptional readability in dense UI environments. **JetBrains Mono** is utilized for labels, metadata, and status indicators to reinforce the professional, systematic nature of the system. 

Text hierarchy is enforced through weight and color (using the secondary and tertiary palettes) rather than just size. All interactive text links and primary button labels should be treated with high-contrast pairings against the primary orange or neutral backgrounds.

## Layout & Spacing
This design system utilizes a **fluid grid** based on an 8px spacing power-scale. 

- **Desktop:** A 12-column grid with 24px gutters and 32px side margins. 
- **Tablet:** An 8-column grid with 16px gutters and 24px side margins.
- **Mobile:** A 4-column grid with 16px gutters and 16px side margins.

Horizontal spacing is used to define logical groupings, while vertical spacing (rhythm) is strictly enforced to ensure a structured, professional appearance. Consistent padding of `md` (16px) is the standard for container interiors.

## Elevation & Depth
The system uses **Tonal Layers** combined with **Low-Contrast Outlines** to create a sense of depth without overwhelming the user with shadows.

- **Level 0 (Base):** The primary background color.
- **Level 1 (Card/Surface):** A slightly lifted surface using a 1px border (#e2e8f0 in light mode) or a subtle tonal shift.
- **Interaction:** When an element is hovered, it does not gain a shadow; instead, its border color shifts toward the primary orange or its background color darkens slightly.
- **Overlays:** Modals and menus use a soft, ultra-diffused ambient shadow (10% opacity, 20px blur) to separate the element from the base plane.

## Shapes
The shape language is **Soft**, striking a balance between the rigidity of sharp corners and the playfulness of fully rounded circles. 

Standard components (Inputs, Buttons, Cards) utilize a 0.25rem (4px) radius. Larger containers or featured sections may use up to 0.75rem (12px) to provide a gentle visual container. This disciplined approach to roundedness ensures the UI feels modern and approachable while remaining firmly professional.

## Components
- **Buttons:** Primary buttons feature a solid #f97316 background with white text. Secondary buttons use a transparent background with a 1px #f97316 border and orange text. Hover states should darken the orange by 10%.
- **Sliders & Toggles:** The active track and the "on" state of toggles must use the primary orange. The "thumb" should be white with a subtle 1px gray border.
- **Input Fields:** Default state uses a light gray border. On focus, the border transitions to a 2px solid #f97316.
- **Chips:** Used for filtering or status. Active chips use a light tint of orange (10% opacity) with a dark orange label.
- **Lists:** Selection states in lists should be indicated by a 4px vertical orange bar on the left edge of the list item, paired with a very subtle orange background tint.
- **Cards:** Defined by a clean 1px border. No shadows are applied unless the card is being dragged or is a floating popover.