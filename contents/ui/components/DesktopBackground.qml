import QtQuick
import QtQuick.Window
import QtQuick.Effects
import org.kde.kwin as KWinComponents

Item {
    y: - (mainWindow.y - minDy)
    x: - (mainWindow.x - minDx)
    height: Screen.height
    width: currentScreenWidth
    visible: showDesktopBackground && mainWindow.activated

    // NOTE (Plasma 6): WindowThumbnail.client takes a Window object, not
    // an id. wId takes the desktop window's internalId (QUuid) and looks
    // the window up, same as the Plasma 5 ThumbnailItem this replaces.
    KWinComponents.WindowThumbnail {
        wId: desktopWindowId
        id: desktopBackground
        anchors.fill: parent
    }

    /// configurable blur
    // NOTE (Plasma 6): FastBlur from Qt5Compat.QtGraphicalEffects is gone;
    // MultiEffect from QtQuick.Effects is the Qt 6 replacement. Its blur
    // is normalized 0..1, so the 0..60 px config value is scaled to fit.
    MultiEffect {
        id: blurBackground
        anchors.fill: parent
        source: desktopBackground
        blurEnabled: true
        blur: Math.min(desktopBackgroundBlur / 60, 1)
        visible: desktopBackgroundBlur > 0
    }
}
