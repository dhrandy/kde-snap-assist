# KDE Snap Assist

KWin script for KDE Plasma 6 which suggests other window thumbnails on snap.

Fork of [emvaized/kde-snap-assist](https://github.com/emvaized/kde-snap-assist), ported to Plasma 6. Original work by emvaized, licensed GPLv3. Tested on Plasma 6.8.

This script replicates the Windows 10/11 Snap Assist feature.

Assist can be shown by dragging a window to the screen edge, as well as via keyboard shortcuts (<kbd>super</kbd> + arrows). You can select the window with mouse, as well as with arrow keys + <kbd>Enter</kbd>.
To dismiss the assist, hit <kbd>Escape</kbd>, press the close button or click anywhere on the empty area.
Script also supports quarter and triple tiling: you can switch layouts with the <kbd>Tab</kbd> key or using the button in corner.

## Screenshot
![screenshot_snapassist](./assets/screenshot.png)

## Installation (Plasma 6)

Do not use "Get New Scripts" in System Settings for this one: that installs the original Plasma 5 version, which does not work on Plasma 6. Install this fork instead.

**Option 1: install the package file (easiest)**
- Download `kde-snap-assist.kwinscript` from this repo
- Open System Settings > Window Management > KWin Scripts
- Click "Install from File..." and pick the downloaded `.kwinscript`
- Enable "KDE Snap Assist 2" in the list
- Reload KWin so the script loads: run `kwin_wayland --replace` in a terminal, or log out and back in

**Option 2: install from source**
- Clone this repo, then run: `kpackagetool6 --type KWin/Script --install <path-to-the-cloned-folder>`
- Enable "KDE Snap Assist 2" in System Settings > Window Management > KWin Scripts
- Reload KWin (`kwin_wayland --replace`, or log out and back in)

**Upgrading:** install the new version over the old one (same steps as above), then reload KWin. On Wayland, use `kwin_wayland --replace`; do not restart KWin with `systemctl restart plasma-kwin_wayland.service`, it can drop your session to the lock screen.

## Use with KZones (Windows 11 layouts)

For the full Windows 11 experience, use this script together with [KZones](https://github.com/gerritdevriese/kzones). Both need to be enabled in System Settings > Window Management > KWin Scripts. They do different jobs:

- **KZones** is the layout bar: drag a window to the top of the screen, pick a layout and a zone, and it puts the window there. It provides the Windows 11 layouts (halves, thirds, quadrants, wide left/right, and the L-shapes).
- **KDE Snap Assist (this script)** is the picker: after a window snaps in, it shows your other open windows so you can click one to fill the next zone.

If only KZones is on, you can snap windows into zones but there is no picker for the remaining windows, you have to drag each one by hand. If only Snap Assist is on, you get the picker on native edge snaps but no layout bar and no custom layouts.

This fork is layout-aware: when KZones places a window, this script reads the layout and zone KZones used and offers exactly the remaining zones of that layout. That is what makes the L-shape layouts (half on one side, split top/bottom on the other) offer the two stacked quarters instead of the whole other half. It also recognises 2/3-wide zones (Wide Left / Wide Right). If a window was not placed by KZones, it falls back to detecting halves, quarters, and thirds from the window geometry.

## Snap Groups

Since version `1.4`, there are also experimental *snap group* features:
- Minimize/restore snapped windows together ([demo](./assets/demos/snap%20groups/minimize-together.gif))
- Raise snapped windows together ([demo](./assets/demos/snap%20groups/raise-together.gif))
- On close snapped window, try to fill the area ([demo](./assets/demos/snap%20groups/fill-on-close.gif))
- Try to fit snapped window in group behind ([demo](./assets/demos/snap%20groups/fit-in-group-behind.gif))

When you enable any of these options in the script settings, it will start tracking windows snapped via the script. Group of snapped windows is remembered once you fill the layout using the assist. Window is no longer considered snapped once it was closed or moved manually using the mouse (sometimes you need to do it twice to break it from the group). Snap groups are not persistent, and should be recreated after each reboot.

## Compatibility notes

#### Compatibility with [Window Gap](https://github.com/nclarius/tile-gaps)

- Since version 1.2, there's an option "Snap detect tolerance" in the script settings, which basically defines how much window's size and position can differ to still be detected as "snapped" by the script. If you use some external scripts which constantly modify windows size and position, you may want to set it to `15px` or `25px`, so that Snap Assist could detect your snaps.

#### Compatibility with [Exquisite](https://www.pling.com/p/1852610)

- Most of default layouts are supported out the box. You may also like to enable "Hide after tiling a window" in Exquisite's settings for the smoothest workflow. Over time, support for custom layouts will expand, possibly with ability to edit them.

#### Compatibility with [Sticky Window Snapping](https://www.pling.com/p/1112552)

- Fully compatible. Highly recommended to be used in conjunction with Snap Assist!

#### Compatibility with diagonal keyboard shortcuts

- Version 1.4 introduces an option "Delay before showing the assist", which gives some time to execute 'diagonal' shortcuts (<kbd>super</kbd> + <kbd>↑</kbd> + <kbd>→</kbd>) before Assist gets shown. The default value is `100ms`.

## Troubleshooting
- To apply the new settings, you may need to re-enable the script or restart KWin. The same is recommended if you switch from one version of the script to another
- Assist will not show if you have no other windows matching the conditions set in the script settings. For example, by default the script does not show windows from other screens — so, if you have only one window on the current screen, assist will not show
- Script settings button is not visible, or complains that "Plugin doesn't provide configuration file in the expected location" — this is a known KWin's bug, not related to the script. Make sure your system is up-to-date, as it seems to be fixed now. If it doesn't help, you can also try to install the script [manually](#installation-plasma-6)
- KWin crashes after sleep — it was reported [here](https://github.com/emvaized/kde-snap-assist/issues/35) that you may need to install `pygdbmi` library to fix the crash after sleep
