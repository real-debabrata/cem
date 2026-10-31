package com.campus.events;

/*
 * CEM 4.1.1: theme colour behind the status bar (notification bar), the camera cut-out (notch / punch-hole) and the
 * navigation bar.
 *
 * Before this, the app sat in a window with a plain black system bar on top, which also hid the front camera area.
 * Now the window is drawn edge-to-edge and the three system areas are painted with the app's own background colour,
 * so the app looks like it starts at the very top of the screen. The page itself is moved clear of the bars with
 * native padding, so nothing is ever hidden behind the clock, the camera or the gesture bar.
 *
 * This file is NOT compiled from this folder. scripts/patch-themebars.sh copies it into the Android project that
 * "npx cap add android" generates during the Build APK workflow, and calls ThemeBarsPlugin.setup(this) from MainActivity.
 *
 * JavaScript side: www/themebars.js  ->  Capacitor.Plugins.ThemeBars
 *   set({ color: "#rrggbb" })  -> { color }   paints the bars, and picks light or dark icons (clock, battery, ...)
 *
 * Why native padding instead of CSS env(safe-area-inset-*): older Android WebViews report 0 for those values, which would
 * put the header under the clock. Native padding works on every Android version the app supports (5.1 and up).
 */

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThemeBars")
public class ThemeBarsPlugin extends Plugin {

    // Midnight Navy: the same colour as the loading screen, so there is no flash while the app starts.
    private static final int DEFAULT_COLOR = 0xFF10172B;

    // Static so the colour survives if Android re-creates the activity; the next page then starts with the last colour.
    private static int current = DEFAULT_COLOR;

    /** Called from MainActivity.onCreate, right after super.onCreate(), before the first frame is drawn. */
    public static void setup(final Activity activity) {
        try {
            final Window window = activity.getWindow();

            // Let the app draw under the status bar, the camera cut-out and the navigation bar.
            WindowCompat.setDecorFitsSystemWindows(window, false);

            // The camera cut-out is normally left black. Ask Android to draw into it as well.
            if (Build.VERSION.SDK_INT >= 30) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
                window.setAttributes(lp);
            } else if (Build.VERSION.SDK_INT >= 28) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }

            // Transparent bars: the colour we paint underneath shows through.
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= 29) {
                window.setNavigationBarContrastEnforced(false);   // no grey scrim behind the 3-button / gesture bar
            }

            // The keyboard must still push the page up (older Android only does that for "resize").
            window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

            final View content = window.getDecorView().findViewById(android.R.id.content);
            if (content == null) return;

            // Keep the page clear of the bars, the camera cut-out and the keyboard. The bars themselves show
            // this view's background, which is the theme colour.
            ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsetsCompat.CONSUMED;   // the WebView is already inside the safe area: no double padding
            });

            paint(activity, current);
            ViewCompat.requestApplyInsets(content);
        } catch (Throwable t) {
            // Cosmetic only. If a future Android changes something, the app must still open normally.
            android.util.Log.w("ThemeBars", "setup failed: " + t);
        }
    }

    /** Paints the window and picks dark or light icons for the bars. Must run on the UI thread. */
    private static void paint(Activity activity, int color) {
        Window window = activity.getWindow();
        ColorDrawable bg = new ColorDrawable(color);
        window.setBackgroundDrawable(bg);
        View content = window.getDecorView().findViewById(android.R.id.content);
        if (content != null) content.setBackgroundColor(color);

        // Dark icons on a light colour, light icons on a dark colour.
        boolean lightBackground = luminance(color) > 0.5;
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
        if (c != null) {
            c.setAppearanceLightStatusBars(lightBackground);
            c.setAppearanceLightNavigationBars(lightBackground);
        }
    }

    private static double luminance(int color) {
        double r = Color.red(color) / 255.0, g = Color.green(color) / 255.0, b = Color.blue(color) / 255.0;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    @PluginMethod
    public void set(final PluginCall call) {
        String hex = call.getString("color", "");
        final int color;
        try {
            color = 0xFF000000 | (Color.parseColor(hex) & 0x00FFFFFF);   // always fully opaque
        } catch (Exception e) {
            call.reject("color must look like #rrggbb");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) { call.reject("no activity"); return; }
        activity.runOnUiThread(() -> {
            try {
                current = color;
                paint(activity, color);
                JSObject r = new JSObject();
                r.put("color", String.format("#%06x", color & 0x00FFFFFF));
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("could not paint the bars: " + t);
            }
        });
    }
}
