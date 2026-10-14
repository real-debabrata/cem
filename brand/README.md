# Campus Events brand (3.7.0)

## Logo
`logo.svg` is the master (a rounded square with the letter E). `logo-1024.png` is the same logo as a 1024 px image.
Keep clear space around it of at least a quarter of its width. Do not recolour it, stretch it or add effects.

## Colours
| Name | Hex | Use |
| --- | --- | --- |
| Primary (Indigo) | `#5948F5` | Logo, buttons, links |
| Warm Amber | `#FFB547` | Accent: event highlights, unread dots, count badges |
| Midnight Navy | `#10172B` | Dark theme, sign-in and public pages, headings |
| Cloud White | `#F6F7FB` | Light theme background, negative space |
| Fresh Mint | `#35C9A5` | Success: check-ins, completed tasks, progress fills |

Derived colours (kept so text stays readable, WCAG AA 4.5:1):

| Name | Hex | Use |
| --- | --- | --- |
| Primary tint | `#8F84FF` | Links and buttons in the dark theme (Primary is only 3.1:1 on Midnight Navy) |
| Deep Mint | `#087A62` | Success **text** on light backgrounds (Fresh Mint is only 2.1:1 on white) |
| Muted text | `#5B6380` light, `#A5ABC4` dark | Secondary text |
| Dark card | `#1A2240` | Cards in the dark theme |

Rule of thumb: white or Cloud White text on Primary; Midnight Navy text on Amber and on Mint; Amber and Mint are never used as text on white.

## Regenerating the icons
```
pip install cairosvg pillow fonttools brotli
python3 brand/make-icons.py
```
Run it from the repository root. It writes `www/favicon.ico`, `www/icons/*` and `brand/android/res/*`.
