.import org.kde.kwin as KWinComponents
/// snapassist: merged assist.js + windows.js (single module; QML forbids
/// circular .js imports, so the two files cannot import each other).
/// assist
function delayedShowAssist(dx, dy, height, width, window){
    // NOTE (Plasma 6): KWinComponents.Workspace.clientList() is gone; KWinComponents.Workspace.windows
    // is the declarative list property (exposed as a JS array).
    const allClients = Object.values(KWinComponents.Workspace.windows);
    clients = allClients.filter(c => shouldShowWindow(c));
    if (clients.length == 0) return;

    cardWidth = currentScreenWidth / 5;
    cardHeight = cardWidth / 1.68;
    lastActiveClient = KWinComponents.Workspace.activeWindow;

    timer.setTimeout(function(){
        const w = window ?? KWinComponents.Workspace.activeWindow;
        if (w && w.internalId) snappedWindows.push(w.internalId);
        mainWindow.requestActivate();
        keyboardHandler.forceActiveFocus();
        showAssist(dx, dy, height ?? currentScreenHeight, width ?? currentScreenWidth - window.width);
    }, 3);

    if (sortByLastActive) sortClientsByLastActive();
    if (descendingOrder) clients = clients.reverse();

    /// find current desktop background
    if (showDesktopBackground) {
        // NOTE (Plasma 6): Window.screen (int) is gone; output is the
        // LogicalOutput*, same type as KWinComponents.Workspace.activeScreen.
        const indexOfDesktopWindow = allClients.findIndex((c) => c.desktopWindow && c.output === KWinComponents.Workspace.activeScreen);
        if (indexOfDesktopWindow < 0) return;
        desktopWindowId = allClients[indexOfDesktopWindow].internalId;
    }
}

function showAssist(dx, dy, height, width) {
    activated = true;
    focusedIndex = 0;
    mainWindow.showNormal();
    mainWindow.width = width;
    mainWindow.height = height;
    mainWindow.x = dx;
    mainWindow.y = dy;
    fadeInAnimation.restart();
    // NOTE (Plasma 6): ScrollBar.vertical only exists once Qt has created a
    // vertical scrollbar for this ScrollView; without one the attached
    // property is undefined and this threw on every snap. Guard it.
    if (scrollView.ScrollBar && scrollView.ScrollBar.vertical)
        scrollView.ScrollBar.vertical.position = 0;
}

function preventAssistFromShowing(delay, callback){
    preventFromShowing = true;
    timer.setTimeout(function(){
        preventFromShowing = false;
        if (callback) callback();
    }, delay ?? 300);
}

function hideAssist(shouldFocusLastClient) {
    activated = false;
    mainWindow.x = mainWindow.width * 2;
    mainWindow.y = mainWindow.height * 2;
    mainWindow.width = 0;
    mainWindow.height = 0;

    /// gets called when assist closed without selecting item
    if (shouldFocusLastClient == true) {
        if(lastActiveClient) KWinComponents.Workspace.activeWindow = lastActiveClient;
        finishSnap(true);
    }
}

function finishSnap(success){
    /// gets called when close assist, and no other assists awaiting to show
    if (success == true && trackSnappedWindows && snappedWindows.length > 1) {
        /// store snapped windows
        const d = new Date();
        snappedWindowGroups.push({
            timestamp: d.getTime(),
            windows: snappedWindows
        });
    }

    filteredClients = [];
    filteredQuaters = [];
    snappedWindows = [];
    quatersToShowNext = {};
    lastActiveClient = null;
}


/// for quater tiling
function checkToShowNextQuaterAssist(lastSelectedClient){
    const keys = Object.keys(quatersToShowNext).filter(quaterIndex => !filteredQuaters.includes(parseInt(quaterIndex)));
    const l = keys.length;

    if (l > 0) {
        /// need to show assist in other quaters
        if (lastSelectedClient) filteredClients.push(lastSelectedClient);
        const nextQuater = quatersToShowNext[keys[0]];
        delete quatersToShowNext[keys[0]];
        if (layoutMode !== 3) columnsCount = 2;
        delayedShowAssist(nextQuater.dx + (assistPadding / 2), nextQuater.dy + (assistPadding / 2), nextQuater.height - assistPadding, nextQuater.width - assistPadding);
        if (lastSelectedClient) lastActiveClient = lastSelectedClient;
        return true;
    } else {
        /// no other quaters to show assist — we can reset the variables
        preventAssistFromShowing();
        hideAssist(false);
        finishSnap(true);
        return false;
    }
}

function switchAssistLayout() {
    if (!activated) return;
    const halfScreenWidth = currentScreenWidth / 2, halfScreenHeight = currentScreenHeight / 2;

    if (layoutMode == 0) {
        /// horizontal halve
        if (isEqual(mainWindow.height, currentScreenHeight)) {
            /// reduce to quater
            mainWindow.height /= 2;
            if (mainWindow.y !== minDy) mainWindow.y = minDy;
            quatersToShowNext[0] = {dx: mainWindow.x, dy: minDy + halfScreenHeight, height: mainWindow.height, width: mainWindow.width};
        } else if (isEqual(mainWindow.height, halfScreenHeight)) {
            if (isEqual(mainWindow.y, minDy)) {
                /// already shown in top quater, move to the bottom quater
                mainWindow.y = minDy + halfScreenHeight;
                quatersToShowNext[0] = {dx: mainWindow.x, dy: minDy, height: mainWindow.height, width: mainWindow.width};
            } else {
                /// return to initial position
                mainWindow.height *= 2;
                if (mainWindow.y !== minDy) mainWindow.y = minDy;
                delete quatersToShowNext[0];
            }
        }
    } else if (layoutMode == 2) {
        /// vertical halve
        if (isEqual(mainWindow.width, currentScreenWidth)) {
            /// reduce to quater
            mainWindow.width /= 2;
            columnsCount = 2;
            if (mainWindow.x !== minDx) mainWindow.x = minDx;
            quatersToShowNext[0] = {dx: minDy + halfScreenWidth, dy: mainWindow.y, height: mainWindow.height, width: mainWindow.width};
        } else if (isEqual(mainWindow.width, halfScreenWidth)) {
            if (isEqual(mainWindow.x, minDx)) {
                /// already shown in left quater, move to the right quater
                mainWindow.x = minDx + halfScreenWidth;
                quatersToShowNext[0] = {dx: minDy, dy: mainWindow.y, height: mainWindow.height, width: mainWindow.width};
            } else {
                /// return to initial position
                mainWindow.width *= 2;
                columnsCount = 3;
                if (mainWindow.x !== minDx) mainWindow.x = minDx;
                delete quatersToShowNext[0];
            }
        }
    } else if (layoutMode == 1) {
        /// quater
        if (isEqual(mainWindow.height, halfScreenHeight) && isEqual(mainWindow.width, halfScreenWidth)) {
            /// store quater's position - to return to in the end of cycle
            storedQuaterPosition.dx = mainWindow.x; storedQuaterPosition.dy = mainWindow.y;
            storedFirstQuaterToShow = quatersToShowNext[0];

            /// make horizontal halve
            mainWindow.height  = currentScreenHeight;
            if (mainWindow.y !== minDy) mainWindow.y = minDy;
            columnsCount = 2;
            if (isEqual(lastActiveClient.x, minDx)) {
                /// show on the right
                mainWindow.x =  minDx + halfScreenWidth;
                filteredQuaters = [1, 3];

                /// special handling to show assist again for newly appeared free quater
                if (isEqual(lastActiveClient.y, minDy + halfScreenHeight))
                    quatersToShowNext[0] = {dx: minDx, dy: minDy, height: halfScreenHeight, width: halfScreenWidth};
            } else {
                /// show on the left
                mainWindow.x =  minDx;
                filteredQuaters = [0, 2];
            }
        } else if (isEqual(mainWindow.height, currentScreenHeight)) {
            /// make vertical halve
            mainWindow.height  = halfScreenHeight;
            mainWindow.width = currentScreenWidth;
            if (mainWindow.x !== minDx) mainWindow.x = minDx;
            columnsCount = 3;
            if (isEqual(lastActiveClient.y, minDy)) {
                /// show in bottom
                mainWindow.y = minDy + halfScreenHeight;
                filteredQuaters = [2, 3];

                /// special handling to show assist again for newly appeared free quater
                if (isEqual(lastActiveClient.x, minDx + halfScreenWidth))
                    quatersToShowNext[0] = {dx: minDx, dy: minDy, height: halfScreenHeight, width: halfScreenWidth};
                else if (isEqual(lastActiveClient.x, minDx))
                    quatersToShowNext[0] = {dx: minDx + halfScreenWidth, dy: minDy, height: halfScreenHeight, width: halfScreenWidth};
            } else {
                /// show on top
                mainWindow.y = minDy;
                filteredQuaters = [0, 1];
            }
        } else {
            /// return to initial position
            mainWindow.width /= 2;
            mainWindow.x = storedQuaterPosition.dx; mainWindow.y = storedQuaterPosition.dy;
            columnsCount = 2;
            filteredQuaters = [];
            quatersToShowNext[0] = storedFirstQuaterToShow;
        }
    } else if (layoutMode == 3) {
        /// three-in-a-row layout
        const thirdOfScreenWidth = currentScreenWidth / 3;

        if (lastActiveClient.x == minDx + thirdOfScreenWidth) {
            /// snapped window in the center
            if (isEqual(mainWindow.x, minDx)) {
                /// move third to right
                mainWindow.x = minDx + (thirdOfScreenWidth * 2);
                filteredQuaters = [2];
                quatersToShowNext[0] = {dx: minDx, dy: minDy, height: currentScreenHeight, width: thirdOfScreenWidth};
            } else {
                /// move third to left
                mainWindow.x = minDx;
                filteredQuaters = [];
                delete quatersToShowNext[0];
            }
        } else {
            /// snapped window on the side
            if (isEqual(mainWindow.width, thirdOfScreenWidth)) {
                /// expand to take two thirds
                storedQuaterPosition.dx = mainWindow.x;
                mainWindow.width = thirdOfScreenWidth * 2;
                columnsCount = 2;
                filteredQuaters = isEqual(mainWindow.x, minDx) ? [1] : [2];

            } else if (isEqual(mainWindow.height, currentScreenHeight / 2)) {
                /// return to initial position
                mainWindow.width = thirdOfScreenWidth;
                mainWindow.height = currentScreenHeight;
                mainWindow.x = storedQuaterPosition.dx;
                columnsCount = 1;
                filteredQuaters = [];
                delete quatersToShowNext[0];

            } else if (isEqual(mainWindow.width, thirdOfScreenWidth * 2)) {
                /// show vertically
                mainWindow.height = currentScreenHeight / 2;
                filteredQuaters = [1, 2];
                quatersToShowNext[0] = {dx: mainWindow.x, dy: minDy + (currentScreenHeight / 2), height: currentScreenHeight / 2, width: mainWindow.width};
            }
        }
    }
}

function selectClient(client){
    client.setMaximize(false, false);
    // NOTE (Plasma 6): Window has no shade property anymore (roll-up/shade
    // was removed from KWin), so the old `client.shade = false` is gone.

    if (rememberWindowSizes)
        windowSizesBeforeSnap[client.internalId] = { height: client.height, width: client.width };

    client.frameGeometry = Qt.rect(
        mainWindow.x - (assistPadding / 2),
        mainWindow.y - (assistPadding / 2),
        mainWindow.width + assistPadding,
        mainWindow.height + assistPadding
    );

    KWinComponents.Workspace.activeWindow = client;

    if (trackSnappedWindows) {
        removeWindowFromTrack(client.internalId); /// remove from track if was previously snapped
        snappedWindows.push(client.internalId);
    }

    checkToShowNextQuaterAssist(client);
}

/// listeners
function addListenersToClient(client) {
    if (!client || client.specialWindow) return;

    client.frameGeometryChanged.connect(function() {
        if (!client.move && !client.resize && activated == false && preventFromShowing == false) {
            if (delayBeforeShowingAssist == 0) {
                onWindowResize(client);
            } else {
                timer.setTimeout(function(){
                    onWindowResize(client);
                }, delayBeforeShowingAssist);
            }
        }
    });

    // NOTE (Plasma 6): windowStartUserMovedResized is gone; the replacement
    // is interactiveMoveResizeStarted(), which passes no arguments, so the
    // closure's `client` is used instead of the old `cl` parameter.
    client.interactiveMoveResizeStarted.connect(function(){
        if (trackSnappedWindows && !client.resize)
            removeWindowFromTrack(client.internalId, function(group){
                if (fillOnSnappedMove) fillClosedWindow(client, group);
            });

        if (rememberWindowSizes){
            const storedSize = windowSizesBeforeSnap[client.internalId];
            if (storedSize) {
                // NOTE: assigning to frameGeometry.height/.width directly
                // is a no-op (frameGeometry is a value type, the getter
                // returns a copy), so assign a whole new rect instead.
                client.frameGeometry = Qt.rect(
                    client.frameGeometry.x,
                    client.frameGeometry.y,
                    storedSize.width ?? client.width,
                    storedSize.height ?? client.height
                );
                delete windowSizesBeforeSnap[client.internalId];
            }
        }
    });

    // NOTE (Plasma 6): windowClosed is gone; Window.closed() fires from
    // destroyWindow() while the geometry is still readable.
    client.closed.connect(function(){
        handleWindowClose(client);
    });

    // NOTE (Plasma 6): desktopChanged is gone; desktopsChanged covers it
    // (Window.desktops is now a list of VirtualDesktop objects).
    client.desktopsChanged.connect(function(){
        if (trackSnappedWindows && !client.resize) removeWindowFromTrack(client.internalId);
    });

    // NOTE (Plasma 6): windowMinimized/windowUnminimized are gone; both are
    // covered by minimizedChanged, branching on client.minimized.
    client.minimizedChanged.connect(function(){
        if (!trackSnappedWindows || !minimizeSnappedTogether) return;
        if (client.minimized) {
            applyActionToAssosiatedSnapGroup(client, function(cl){ if (cl) cl.minimized = true; });
        } else {
            applyActionToAssosiatedSnapGroup(client, function(cl) {
                if (cl) {
                    cl.minimized = false;
                    if (trackActiveWindows) {
                        const d = new Date();
                        activationTime[cl.internalId] = d.getTime();
                    }
                }
            });
        }
    });

    // NOTE (Plasma 6): Workspace has no onWindowFullScreenChanged signal.
    // Per-window fullScreenChanged replaces it: when the user exits
    // fullscreen we don't want the assist to pop up.
    client.fullScreenChanged.connect(function(){
        if (!client.fullScreen) preventAssistFromShowing();
    });
}

/// Windows 11 snap layouts, mirroring the KZones layoutsJson (zone rects in
/// screen percentages: x, y, width, height). KZones sets window.zone and
/// window.layout when it places a window, and those properties ARE visible
/// to this script (verified Nov 18, 2026 via journal: a KZones-placed window
/// read back zone=0 layout=4). So when KZones placed the window we can offer
/// exactly the remaining zones of the chosen layout instead of guessing from
/// geometry, which is ambiguous for the L-shape layouts (a half window looks
/// like plain Halves). Layout order matches KZones: 0 Halves, 1 Wide Left,
/// 2 Thirds, 3 Quadrants, 4 Left Half + Split, 5 Right Half + Split.
const WIN11_LAYOUTS = [
    [{x:0, y:0, w:50, h:100}, {x:50, y:0, w:50, h:100}],
    [{x:0, y:0, w:66.67, h:100}, {x:66.67, y:0, w:33.33, h:100}],
    [{x:0, y:0, w:33.33, h:100}, {x:33.33, y:0, w:33.34, h:100}, {x:66.67, y:0, w:33.33, h:100}],
    [{x:0, y:0, w:50, h:50}, {x:50, y:0, w:50, h:50}, {x:0, y:50, w:50, h:50}, {x:50, y:50, w:50, h:50}],
    [{x:0, y:0, w:50, h:100}, {x:50, y:0, w:50, h:50}, {x:50, y:50, w:50, h:50}],
    [{x:0, y:0, w:50, h:50}, {x:0, y:50, w:50, h:50}, {x:50, y:0, w:50, h:100}]
];

function onWindowResize(window) {
    if (activated || !window || window.deleted || window.specialWindow) return;
    finishSnap(false); /// make sure we cleared all variables

    /// don't show assist if window could be fit in the group behind
    if (fitWindowInGroupBehind && windowFitsInSnapGroup(window)) return;

    const maxArea = KWinComponents.Workspace.clientArea(KWin.FullScreenArea, window);
    currentScreenWidth = maxArea.width; currentScreenHeight = maxArea.height;
    minDx = maxArea.x; minDy = maxArea.y;
    const dx = window.x, dy = window.y;
    const width = window.width, height = window.height;
    const halfScreenWidth = currentScreenWidth / 2, halfScreenHeight = currentScreenHeight / 2;

    /// Layout-aware picker (KZones placed this window): offer exactly the
    /// remaining zones of the chosen layout. This is what makes the L-shape
    /// layouts (4, 5) offer the two stacked quarters instead of the whole
    /// other half. Falls through to the geometric detection below when KZones
    /// did not place the window (zone -1 / undefined, e.g. a native snap).
    const kzLayout = window.layout;
    const kzZone = window.zone;
    if (typeof kzLayout === "number" && typeof kzZone === "number" && kzLayout >= 0 && kzLayout < WIN11_LAYOUTS.length && kzZone >= 0 && kzZone < WIN11_LAYOUTS[kzLayout].length) {
        const zones = WIN11_LAYOUTS[kzLayout];
        const snapped = zones[kzZone];
        // only trust zone/layout if the window is actually in that zone;
        // during a drag they can be stale (KZones matchZone runs at drag-end)
        const expDx = minDx + (snapped.x / 100) * currentScreenWidth;
        const expDy = minDy + (snapped.y / 100) * currentScreenHeight;
        const expW = (snapped.w / 100) * currentScreenWidth;
        const expH = (snapped.h / 100) * currentScreenHeight;
        if (isEqual(dx, expDx) && isEqual(dy, expDy) && isEqual(width, expW) && isEqual(height, expH)) {
            quatersToShowNext = {};
            let remaining = 0;
            for (let i = 0; i < zones.length; i++) {
                if (i === kzZone) continue;
                const z = zones[i];
                quatersToShowNext[remaining++] = {
                    dx: minDx + (z.x / 100) * currentScreenWidth,
                    dy: minDy + (z.y / 100) * currentScreenHeight,
                    width: (z.w / 100) * currentScreenWidth,
                    height: (z.h / 100) * currentScreenHeight
                };
            }
            if (remaining === 0) return;
            layoutMode = quatersToShowNext[0].width <= currentScreenWidth / 3 + snapDetectPrecision ? 3 : 1;
            columnsCount = layoutMode === 3 ? 1 : 2;
            filteredClients.push(window);
            checkToShowNextQuaterAssist(window);
            /// if only one window available, show it in center and bigger
            if (clients && clients.length == 1) {
                columnsCount = 1;
                cardWidth *= 1.2;
                cardHeight *= 1.2;
            }
            return;
        }
    }

    /// Detect if window was snapped
    /// left/right halves
    if (isEqual(width, halfScreenWidth) && isEqual(height, currentScreenHeight) && isEqual(dy, minDy)) {
        if (isEqual(dx, minDx)) {
            /// show on right half
            delayedShowAssist(minDx + window.width, window.y, undefined, undefined, window);
        } else if (isEqual(dx, minDx + halfScreenWidth)) {
            /// show on left half
            delayedShowAssist(minDx, minDy, undefined, undefined, window);
        }
        columnsCount = 2;
        layoutMode = 0;
        filteredClients.push(window);

    /// top/bottom halves
    } else if (isEqual(width, currentScreenWidth) && isEqual(height, halfScreenHeight) && isEqual(dx, minDx)) {
        if (isEqual(dy, minDy)) {
            /// show in bottom half
            delayedShowAssist(minDx, minDy + halfScreenHeight, halfScreenHeight, currentScreenWidth);
        } else if (isEqual(dy, minDy + halfScreenHeight)) {
            /// show in top half
            delayedShowAssist(minDx, minDy, halfScreenHeight, currentScreenWidth);
        }
        columnsCount = 3;
        layoutMode = 2;
        filteredClients.push(window);
    }

    /// quater tiling
    else if (isEqual(width, halfScreenWidth) && isEqual(height, halfScreenHeight)) {
        /// define current screen quaters
            quatersToShowNext = {
            0: { dx: minDx, dy:  minDy, height: halfScreenHeight, width: halfScreenWidth, },
            1: { dx: minDx + halfScreenWidth, dy:  minDy, height: halfScreenHeight, width: halfScreenWidth, },
            2: { dx: minDx, dy: minDy + halfScreenHeight, height: halfScreenHeight, width: halfScreenWidth, },
            3: { dx: minDx + halfScreenWidth, dy:  minDy + halfScreenHeight, height: halfScreenHeight, width: halfScreenWidth, },
        };

        /// detect which quater snapped window takes
        let currentQuater = -1;
        let l = Object.keys(quatersToShowNext).length;

        for (let i = 0; i < l; i++) {
            const quater = quatersToShowNext[i];
            if (isEqual(dx, quater.dx) && isEqual(dy, quater.dy)) {
                currentQuater = i;
                delete quatersToShowNext[i];
                break;
            }
        }

        /// show snap assist in next quater
        if (currentQuater == -1) return;
        checkToShowNextQuaterAssist(window);
        layoutMode = 1;
        columnsCount = 2;
    }

    /// 3-in-row tiling
    else if (isEqual(height, currentScreenHeight)) {
        const thirdOfScreenWidth = currentScreenWidth / 3;
        if (isEqual(width, thirdOfScreenWidth)) {
            /// define current screen thirds
            quatersToShowNext = {
                0: { dx: minDx, dy:  minDy, height: currentScreenHeight, width: thirdOfScreenWidth, },
                1: { dx: minDx + thirdOfScreenWidth, dy:  minDy, height: currentScreenHeight, width: thirdOfScreenWidth, },
                2: { dx: minDx + (thirdOfScreenWidth * 2), dy:  minDy, height: currentScreenHeight, width: thirdOfScreenWidth, },
            };

            /// detect which quater snapped window takes
            let currentQuater = -1;
            let l = Object.keys(quatersToShowNext).length;

            for (let i = 0; i < l; i++) {
                const quater = quatersToShowNext[i];
                if (isEqual(dx, quater.dx) && isEqual(dy, quater.dy)) {
                    currentQuater = i;
                    delete quatersToShowNext[i];
                    break;
                }
            }

            /// show snap assist in next quater
            if (currentQuater == -1) return;
            checkToShowNextQuaterAssist(window);
            layoutMode = 3;
            columnsCount = 1;
        }
        else if (isEqual(width, thirdOfScreenWidth * 2)) {
            /// 2/3-wide window (Windows 11 "Wide" layout via KZones);
            /// offer the remaining 1/3 zone for the next window
            if (isEqual(dx, minDx)) {
                delayedShowAssist(minDx + thirdOfScreenWidth * 2, minDy, undefined, undefined, window);
            } else if (isEqual(dx, minDx + thirdOfScreenWidth)) {
                delayedShowAssist(minDx, minDy, undefined, undefined, window);
            }
            columnsCount = 1;
            layoutMode = 3;
            filteredClients.push(window);
        }
    }

    /// if only one window available, show it in center and bigger
    if (clients && clients.length == 1) {
        columnsCount = 1;
        cardWidth *= 1.2;
        cardHeight *= 1.2;
    }
}

function handleWindowFocus(window) {
    if (ignoreFocusChange) return;
    if (activated) hideAssist(false);
    if (!window || window.specialWindow) return;

    /// Store timestamp of last window activation
    if (trackActiveWindows) {
        const d = new Date();
        activationTime[window.internalId] = d.getTime();
    }

    /// Raise all snapped windows together
    if (trackSnappedWindows && raiseSnappedTogether && !activated) {
        const i = snappedWindowGroups.findIndex((group) => group.windows.includes(window.internalId));
        if (i > -1) {
            ignoreFocusChange = true;
            const windows = snappedWindowGroups[i].windows;
            const l = windows.length;
            if (l < 2) return;

            for(let i = 0; i < l; i++) {
                if (windows[i] !== window.internalId) {
                    const w = getClientFromId(windows[i]);
                    if (w && !w.minimized) KWinComponents.Workspace.activeWindow = w;
                }
            }

            KWinComponents.Workspace.activeWindow = window;
            timer.setTimeout(function(){
                ignoreFocusChange = false;
            }, 100);
        }
    }
}

function handleWindowClose(window){
    if (!window || window.specialWindow) return;
    if (trackActiveWindows) delete activationTime[window.internalId];
    if (rememberWindowSizes) delete windowSizesBeforeSnap[window.internalId];

    if (trackSnappedWindows) {
        /// remove window if it was snapped
        removeWindowFromTrack(window.internalId, function(group){
            /// callback when snapped window was closed.
            if (fillOnSnappedClose) fillClosedWindow(window, group);
        });
    }
}


/// for snap groups
function applyActionToAssosiatedSnapGroup(client, callback){
    if (!client || !client.internalId) return;

    const i = snappedWindowGroups.findIndex((group) => group.windows.includes(client.internalId));
    if (i > -1) {
        const windows = snappedWindowGroups[i].windows;
        windows.forEach(windowId => callback(getClientFromId(windowId)));
    }
}

function removeWindowFromTrack(windowId, callback){
    /// Removes provided windowId from tracking of snapped windows
    if (!windowId) return;

    let i2 = -1;
    const i = snappedWindowGroups.findIndex(function(group) {
        i2 = group.windows.indexOf(windowId);
        return i2 > -1;
    });

    if (i > -1) {
        snappedWindowGroups[i].windows.splice(i2, 1);
        if (callback) callback(snappedWindowGroups[i]);
        if (snappedWindowGroups[i].windows.length < 1) snappedWindowGroups.splice(i, 1);
    }
}

function fillClosedWindow(closedWindow, group){
    /// fill the free area when snapped window closed or moved
    const closedWindowGeom = closedWindow.frameGeometry;
    const remainingWindows = group.windows;
    for(let i = 0, l = remainingWindows.length; i < l; i++){
        const window = getClientFromId(remainingWindows[i]);
        if (!window) continue;
        if (window.internalId == closedWindow.internalId) continue;
        const windowGeom = window.frameGeometry;
        if (!windowGeom) continue;

        if (windowGeom.x == closedWindowGeom.x && windowGeom.width == closedWindowGeom.width){
            /// expand vertically
            preventAssistFromShowing();
            let newHeight = windowGeom.height + closedWindowGeom.height;
            if (newHeight > currentScreenHeight) newHeight = currentScreenHeight;
            window.frameGeometry = Qt.rect(windowGeom.x,
                                           windowGeom.y - (windowGeom.y > closedWindowGeom.y ? closedWindowGeom.height : 0),
                                           windowGeom.width, newHeight);
            break;
        } else if(windowGeom.y == closedWindowGeom.y && windowGeom.height == closedWindowGeom.height) {
            /// expand horizontally
            preventAssistFromShowing();
            let newWidth = windowGeom.width + closedWindowGeom.width;
            if (newWidth > currentScreenWidth) newWidth = currentScreenWidth;
            window.frameGeometry = Qt.rect(
                windowGeom.x - (windowGeom.x > closedWindowGeom.x ? closedWindowGeom.width : 0),
                windowGeom.y, newWidth, windowGeom.height);
            break;
        }
    }
}

function windowFitsInSnapGroup(client){
    /// determines if newly snapped window could be fit in group behind it
    /// requires track activation time and raise snapped windows together

    /// find last active client
    let lastActiveWindowId = -1, lastActiveTime = -1;
    const activeClientId = KWinComponents.Workspace.activeWindow ? KWinComponents.Workspace.activeWindow.internalId : null;
    Object.keys(activationTime).forEach(function(key) {
        if(activationTime[key] > lastActiveTime && key != client.internalId && key != activeClientId) {
            const c = getClientFromId(key);
            // NOTE (Plasma 6): Window.screen (int) and Window.desktop (int)
            // are gone. Use output (LogicalOutput*) and desktops (list of
            // VirtualDesktop objects); KWinComponents.Workspace.activeScreen is now a
            // LogicalOutput* and KWinComponents.Workspace.currentDesktop a VirtualDesktop.
            if (c && !c.minimized && c.output === KWinComponents.Workspace.activeScreen && c.desktops.indexOf(KWinComponents.Workspace.currentDesktop) > -1) {
                lastActiveWindowId = c.internalId;
                lastActiveTime = activationTime[key];
            }
        }
    });
    if (lastActiveWindowId < 0) return false;

    /// find if it belongs to snap group
    const indexOfGroup = snappedWindowGroups.findIndex((group) => group.windows.includes(lastActiveWindowId));
    if (indexOfGroup < 0) return false;

    /// check rest of windows in that group
    const snappedWindows = snappedWindowGroups[indexOfGroup].windows;

    for (let i = 0, l = snappedWindows.length; i < l; i++) {
        const w = getClientFromId(snappedWindows[i]);
        if (!w) continue;

        if (w.y == client.y && w.height == client.height && w.width > client.width) {
            /// reduce window width to fit new window in layout
            snappedWindowGroups[indexOfGroup].windows.push(client.internalId);
            preventAssistFromShowing();
            const newWidth = w.frameGeometry.width - client.width;
            w.frameGeometry = Qt.rect(w.frameGeometry.x + (w.x == client.x ? client.width : 0), w.frameGeometry.y, newWidth, w.frameGeometry.height);
            return true;

        } else if (w.x == client.x && w.width == client.width && w.height > client.height) {
            /// reduce window height to fit new window in layout
            snappedWindowGroups[indexOfGroup].windows.push(client.internalId);
            preventAssistFromShowing();
            const newHeight = w.frameGeometry.height - client.height;
            w.frameGeometry = Qt.rect(w.frameGeometry.x, w.frameGeometry.y + (w.y == client.y ? client.height : 0), w.frameGeometry.width, newHeight);
            return true;

        } else if (w.x == client.x && w.y == client.y && w.height == client.height && w.width == client.width) {
            /// replace window in group with newly snapped window
            snappedWindowGroups[indexOfGroup].windows.splice(i, 1);
            snappedWindowGroups[indexOfGroup].windows.push(client.internalId);
            return true;
        }
    }

    return false;
}


/// utility functions
function isEqual(a, b) {
    /// for compatibility with scripts like Window Gap
    return a - b <= snapDetectPrecision && a - b >= -snapDetectPrecision;
}

function getClientFromId(windowId){
    //return workspace.getClient(windowId);
    /// Works on Wayland
    // NOTE (Plasma 6): KWinComponents.Workspace.clientList() is gone; KWinComponents.Workspace.windows
    // is the declarative list property (exposed as a JS array).
    return Object.values(KWinComponents.Workspace.windows).find((el) => el.internalId == windowId);
}

function shouldShowWindow(client) {
    if (filteredClients.includes(client)) return false;
    if (client.active || client.specialWindow) return false;
    if (!showMinimizedWindows && client.minimized) return false;
    // NOTE (Plasma 6): client.screen (int) and client.desktop (int) are
    // gone; see windowFitsInSnapGroup for the replacements.
    if (!showOtherScreensWindows && client.output !== KWinComponents.Workspace.activeScreen) return false;
    if (!showOtherDesktopsWindows && client.desktops.indexOf(KWinComponents.Workspace.currentDesktop) === -1) return false;
    if (!showSnappedWindows && snappedWindowGroups.findIndex(group => group.windows.includes(client.internalId) && group.windows.length > 1) > -1) return false;
    if (client.activities.length > 0 && !client.activities.includes(KWinComponents.Workspace.currentActivity)) return false;
    return true;
}

function sortClientsByLastActive() {
    clients = clients.sort(function(a, b) {
        const windowIdA = a.internalId, windowIdB = b.internalId;
        if (activationTime[windowIdA] && !activationTime[windowIdB]) return 1;
        if (!activationTime[windowIdA] && activationTime[windowIdB]) return -1;
        return activationTime[windowIdA] - activationTime[windowIdB];
    });
}
