# Valor Lifts Technician App — Next-Generation Screen Dimensions

This is the required layout system for every future technician-app screen. Use these values consistently. The `390 × 844` frame is a **design reference only**; the implemented UI must remain responsive and must never set a full-screen fixed height.

## Supported screen widths

| Device category | Width × height reference |
| --- | --- |
| Minimum supported Android | 360 × 800 px |
| Standard Android / iPhone | 390 × 844 px |
| Large Android | 412 × 915 px |
| iPhone Pro Max | 430 × 932 px |

- Minimum supported viewport width: `360px`
- Design reference width: `390px`
- Large-width breakpoint: `430px+`
- Use the same composition at all widths. Scale fluidly; do not create separate screen designs for each phone.

## Screen structure

| Region | Dimension |
| --- | --- |
| System status-bar design allowance | `44px` |
| App header | `56px` |
| Bottom navigation | `72px–80px` |
| Bottom-nav touch target | at least `44 × 44px` |
| Content width at 390px reference | `358px` |

At the 390 × 844 reference frame, the visual content area is about `664px` after the status bar, header, and 80px navigation. In production, use safe-area insets instead of assuming system-bar pixels:

```css
.screen {
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.screen-content {
  flex: 1;
  overflow-y: auto;
}
```

Do not use `height: 844px` (or any other device-sized fixed height) for screens. Use responsive width, flexible/minimum heights, and vertical scrolling.

## Global spacing and layout

| Token | Value |
| --- | --- |
| Main horizontal screen padding | `16px` |
| Card outer margin | `16px` |
| Card internal padding | `16px` |
| Standard spacing scale | `4, 8, 12, 16, 20, 24, 32px` |
| Standard corner radii | `8, 10, 12, 16, 20px` |
| Card corner radius | `12px–16px` |

Use `width: 100%`, `max-width`, CSS grid/flex, and `min-height` where content can grow. Text must wrap or content must scroll; never clip essential data to preserve a fixed card or screen height.

## Typography

Use Inter consistently.

| Element | Size | Weight |
| --- | --- | --- |
| Main heading | `24px` | `700` |
| Screen title | `22px` | `700` |
| Section heading | `18px` | `700` |
| Card title | `16px` | `600` |
| Body | `14px–16px` | `400` |
| Secondary text | `13px–14px` | `400` |
| Button label | `15px–16px` | `600` |
| Small label | `12px` | `500` |
| Dashboard greeting | `18px` | normal |
| Dashboard technician name | `28px` | bold |

## Controls

| Control | Required dimensions |
| --- | --- |
| Primary / large button | `48px` high, `10px–12px` radius, `16px` horizontal padding |
| Medium button | `44px` high |
| Small button | `40px` high |
| Icon button | `40 × 40px` |
| Input field | `52px` high, `10px` radius, `14px–16px` horizontal padding |
| Input label | `13px` |
| Input text | `15px–16px` |
| Icon sizes | `20, 24, 28, 32px` |

## Screen-specific dimensions

### Dashboard

| Element | Required dimensions / behaviour |
| --- | --- |
| Dashboard header | about `140px–170px` high |
| Statistic card | `110px–125px` wide; `120px–135px` high |
| Statistic-card gap | `10px–12px` |
| Five-statistics row | horizontally scrollable on 390px screens |

Do not force all five statistic cards into a single non-scrollable row.

### Assigned Jobs

| Element | Required dimensions / behaviour |
| --- | --- |
| Top header | `56px` high |
| Filter tabs | `44px–48px` high; horizontally scrollable |
| Search control | `48px–52px` high |
| Job card | `width: calc(100% - 32px)`; auto height; minimum `160px` |

Keep all five filters readable: All, Pending, Accepted, In Progress, Completed. Do not compress their labels to make them all fit.

### Job details

- Header: `56px` high.
- Screen padding: `16px`.
- Content areas: ticket status, customer information, lift information, request, schedule, attachments, and technician actions.
- The content area must scroll vertically.
- Persistent bottom action: `48px` high minimum.
- Do not attempt to fit the entire detail screen inside the 844px design-frame height.

### Service checklist

| Element | Dimension |
| --- | --- |
| Screen padding | `16px` |
| Checklist row | `52px–56px` high |
| Checkbox | `24 × 24px` |
| Row gap | `8px–12px` |

### Photo upload

| Element | Dimension |
| --- | --- |
| Layout | two-column grid |
| 390px side padding | `16px` |
| Column gap | `12px` |
| Photo-card width | about `171px` |
| Photo-card height | `140px–160px` |
| Image aspect ratio | about `4:3` |

### Bottom navigation

| Element | Dimension |
| --- | --- |
| Navigation height | `72px–80px` plus safe-area inset where required |
| Number of items | 5: Home, Jobs, Schedule, Notifications, Profile |
| Navigation icon | `24 × 24px` |
| Navigation label | `11px–12px` |

## Implementation rules

1. Use safe-area handling on every full-screen layout.
2. Use flexible heights (`min-height`, flex) and scrollable content areas.
3. Use horizontal scrolling for oversized rows such as dashboard statistics and filter tabs.
4. Keep the global 16px horizontal padding and spacing token scale.
5. Build cards with auto/minimum heights so translated or long job details remain visible.
6. Treat 390 × 844 as a visual reference, never as a hard-coded application viewport.
