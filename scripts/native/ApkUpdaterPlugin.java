package com.campus.events;

/*
 * CEM 3.14.0: in-app updates.
 *
 * Downloads the new APK from this repository's GitHub Releases INSIDE the app (with progress), checks it,
 * then hands it to Android's normal installer, which shows the usual "Do you want to update this app?" screen.
 *
 * This file is NOT compiled from this folder. scripts/patch-updater.sh copies it into the Android project that
 * "npx cap add android" generates during the Build APK workflow, and registers it in MainActivity.
 *
 * JavaScript side: www/updater.js  ->  Capacitor.Plugins.ApkUpdater
 *   info()                    -> { versionName, versionCode, packageName, canInstall }
 *   start({url,version,size,sha256}) -> status   (returns at once; the download runs on its own thread)
 *   status()                  -> { state: idle | downloading | ready | error, downloaded, total, version, error, canInstall }
 *   cancel()                  -> status
 *   install()                 -> { started: true } | { started: false, needsPermission: true }
 *
 * Every plugin call shares ONE Capacitor thread, so nothing slow may run inside a call. The download therefore has
 * its own thread, and JavaScript polls status().
 *
 * Safety:
 *  - only https URLs of THIS repository's releases are accepted, and every redirect must stay on GitHub's hosts
 *  - the file size (and SHA-256, when GitHub provides it) must match before the file is marked ready
 *  - before the installer opens, the package name, version code and signing key are compared with the installed app,
 *    so the person gets a clear message instead of Android's vague "App not installed"
 */

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    /** Only release downloads of this repository are accepted. Change it together with OWNER/REPO in www/updater.js. */
    private static final String ALLOWED_PATH = "/real-debabrata/cem/releases/download/";

    private static final String STATE_IDLE = "idle";
    private static final String STATE_DOWNLOADING = "downloading";
    private static final String STATE_READY = "ready";
    private static final String STATE_ERROR = "error";

    private final Object lock = new Object();
    private volatile String state = STATE_IDLE;
    private volatile long downloaded = 0;
    private volatile long total = 0;
    private volatile String version = "";
    private volatile String error = "";
    private volatile File readyFile = null;
    private volatile boolean cancelled = false;

    private static class CancelledException extends IOException {
        CancelledException() { super("cancelled"); }
    }

    // ------------------------------------------------------------------ housekeeping

    private File updateDir() {
        File d = new File(getContext().getCacheDir(), "cem-update");
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    /** At app start: remove half-finished downloads and update files that are already installed (or older). */
    @Override
    public void load() {
        new Thread(() -> {
            try {
                File[] files = updateDir().listFiles();
                if (files == null) return;
                PackageManager pm = getContext().getPackageManager();
                long mine = versionCode(pm.getPackageInfo(getContext().getPackageName(), 0));
                for (File f : files) {
                    String n = f.getName();
                    if (n.endsWith(".part")) { f.delete(); continue; }
                    if (!n.endsWith(".apk")) continue;
                    PackageInfo p = pm.getPackageArchiveInfo(f.getAbsolutePath(), 0);
                    if (p == null || versionCode(p) <= mine) f.delete();
                }
            } catch (Throwable ignored) { /* housekeeping only */ }
        }, "cem-update-clean").start();
    }

    // ------------------------------------------------------------------ plugin methods

    @PluginMethod
    public void info(PluginCall call) {
        try {
            Context c = getContext();
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versionName", p.versionName == null ? "" : p.versionName);
            r.put("versionCode", versionCode(p));
            r.put("packageName", c.getPackageName());
            r.put("canInstall", canInstall());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read the app version.");
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusJson());
    }

    @PluginMethod
    public void start(PluginCall call) {
        final String url = call.getString("url", "");
        final String ver = safeVersion(call.getString("version", ""));
        // getLong() only accepts a real Long; a JSON number such as 25000000 arrives as an Integer. optLong accepts both.
        final long size = call.getData().optLong("size", 0L);
        final String sha = call.getString("sha256", "").trim().toLowerCase(Locale.ROOT);

        if (!allowedStart(url)) {
            call.reject("Blocked: this is not an official release download of the app.");
            return;
        }

        synchronized (lock) {
            if (STATE_DOWNLOADING.equals(state)) {
                if (ver.equals(version)) { call.resolve(statusJson()); return; }
                call.reject("Another download is already running. Cancel it first.");
                return;
            }

            final File dir = updateDir();
            final File apk = new File(dir, "cem-update-" + ver + ".apk");

            // keep only the file we are about to use
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (!f.getName().equals(apk.getName())) f.delete();
            new File(apk.getPath() + ".part").delete();

            // already downloaded earlier and still intact? Then there is nothing to download again.
            try {
                if (apk.isFile() && size > 0 && apk.length() == size && (sha.isEmpty() || sha.equals(sha256(apk)))) {
                    version = ver; total = size; downloaded = size; error = "";
                    readyFile = apk; state = STATE_READY;
                    call.resolve(statusJson());
                    return;
                }
            } catch (Exception ignored) { /* fall through and download again */ }
            apk.delete();

            version = ver; total = size; downloaded = 0; error = "";
            readyFile = null; cancelled = false; state = STATE_DOWNLOADING;

            Thread t = new Thread(() -> download(url, apk, size, sha), "cem-update-download");
            t.setDaemon(true);
            t.start();
        }
        call.resolve(statusJson());
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        synchronized (lock) {
            if (STATE_DOWNLOADING.equals(state)) {
                cancelled = true;       // the download thread notices, cleans up and sets the state back to idle
            } else if (STATE_READY.equals(state) || STATE_ERROR.equals(state)) {
                File f = readyFile;
                if (f != null) f.delete();
                readyFile = null; state = STATE_IDLE; error = ""; downloaded = 0;
            }
        }
        call.resolve(statusJson());
    }

    @PluginMethod
    public void install(PluginCall call) {
        final File apk = readyFile;
        if (!STATE_READY.equals(state) || apk == null || !apk.isFile()) {
            call.reject("The update file is not ready. Please download it again.");
            return;
        }

        String problem = checkApk(apk);
        if (problem != null) {
            apk.delete();
            readyFile = null; state = STATE_ERROR; error = problem;
            call.reject(problem);
            return;
        }

        Context ctx = getContext();
        try {
            // Android 8+: the person must allow THIS app to install apps. One-time switch; we open the exact settings page.
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(s);
                JSObject r = new JSObject();
                r.put("started", false);
                r.put("needsPermission", true);
                call.resolve(r);
                return;
            }

            // The Capacitor template already declares this FileProvider (android:authorities="${applicationId}.fileprovider").
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);

            JSObject r = new JSObject();
            r.put("started", true);
            r.put("needsPermission", false);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not open the Android installer: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------ download

    private void download(String firstUrl, File apk, long expectedSize, String expectedSha) {
        File part = new File(apk.getPath() + ".part");
        HttpURLConnection c = null;
        try {
            String current = firstUrl;
            for (int hop = 0; ; hop++) {
                if (hop > 6) throw new IOException("Too many redirects.");
                URL u = new URL(current);
                if (!allowedHost(u)) throw new IOException("The download was redirected to an untrusted address.");
                c = (HttpURLConnection) u.openConnection();
                c.setInstanceFollowRedirects(false);   // we follow redirects ourselves so every hop is checked
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", "CampusEvents-Updater");
                c.setRequestProperty("Accept", "application/octet-stream");
                int code = c.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    c = null;
                    if (loc == null || loc.isEmpty()) throw new IOException("Bad redirect from the server.");
                    current = new URL(u, loc).toString();
                    continue;
                }
                if (code != 200) throw new IOException("The server answered " + code + ". Please try again later.");
                break;
            }

            long len = parseLong(c.getHeaderField("Content-Length"));
            if (len > 0) total = len; else if (expectedSize > 0) total = expectedSize;

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            long got = 0;
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (cancelled) throw new CancelledException();
                    out.write(buf, 0, n);
                    md.update(buf, 0, n);
                    got += n;
                    downloaded = got;
                }
                out.flush();
            }
            if (cancelled) throw new CancelledException();

            if (expectedSize > 0 && got != expectedSize)
                throw new IOException("The download is incomplete (" + got + " of " + expectedSize + " bytes). Please try again.");
            if (!expectedSha.isEmpty() && !expectedSha.equals(hex(md.digest())))
                throw new IOException("The downloaded file is damaged (checksum mismatch). Please try again.");

            apk.delete();
            if (!part.renameTo(apk)) throw new IOException("Could not save the update file.");

            synchronized (lock) {
                total = got; downloaded = got; readyFile = apk; error = ""; state = STATE_READY;
            }
        } catch (CancelledException e) {
            part.delete();
            synchronized (lock) { state = STATE_IDLE; downloaded = 0; error = ""; readyFile = null; }
        } catch (Throwable e) {
            part.delete();
            synchronized (lock) { state = STATE_ERROR; error = friendly(e); readyFile = null; }
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // ------------------------------------------------------------------ checks

    /** null = fine. Otherwise a message for the person. Anything we cannot read is left to Android to decide. */
    @SuppressWarnings("deprecation")
    private String checkApk(File apk) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            String me = ctx.getPackageName();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;

            PackageInfo n = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
            if (n == null) return "The downloaded file is not a valid app package. Please download it again.";
            if (!me.equals(n.packageName)) return "The downloaded file belongs to a different app.";

            PackageInfo cur = pm.getPackageInfo(me, flags);
            if (versionCode(n) <= versionCode(cur)) return "This version is already installed.";

            Set<String> a = certs(n, true), b = certs(cur, false);
            if (!a.isEmpty() && !b.isEmpty() && Collections.disjoint(a, b)) {
                return "This update is signed with a different key than the installed app, so Android would refuse it. "
                     + "Uninstall the app once and install the latest version from the download page.";
            }
        } catch (Throwable ignored) { /* cannot verify: let Android decide */ }
        return null;
    }

    @SuppressWarnings("deprecation")
    private static Set<String> certs(PackageInfo p, boolean withHistory) throws Exception {
        Set<String> out = new HashSet<>();
        if (Build.VERSION.SDK_INT >= 28) {
            SigningInfo si = p.signingInfo;
            if (si != null) {
                add(out, si.getApkContentsSigners());
                if (withHistory) add(out, si.getSigningCertificateHistory());
            }
        } else {
            add(out, p.signatures);
        }
        return out;
    }

    private static void add(Set<String> out, Signature[] sigs) throws Exception {
        if (sigs == null) return;
        for (Signature s : sigs) out.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
    }

    // ------------------------------------------------------------------ helpers

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private JSObject statusJson() {
        JSObject o = new JSObject();
        o.put("state", state);
        o.put("downloaded", downloaded);
        o.put("total", total);
        o.put("version", version);
        o.put("error", error == null ? "" : error);
        o.put("canInstall", canInstall());
        return o;
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    private static boolean allowedHost(URL u) {
        if (!"https".equalsIgnoreCase(u.getProtocol())) return false;
        if (u.getPort() != -1 && u.getPort() != 443) return false;
        String h = u.getHost().toLowerCase(Locale.ROOT);
        return h.equals("github.com") || h.equals("githubusercontent.com") || h.endsWith(".githubusercontent.com");
    }

    /** The URL JavaScript hands us must be a release download of this repository on github.com. */
    private static boolean allowedStart(String url) {
        try {
            URL u = new URL(url);
            String path = u.getPath();
            // no "..", no percent-encoding, no backslash: nothing that could climb out of this repository's /releases/download/ folder
            if (path.contains("..") || path.contains("%") || path.contains("\\")) return false;
            return allowedHost(u)
                && u.getHost().equalsIgnoreCase("github.com")
                && path.toLowerCase(Locale.ROOT).startsWith(ALLOWED_PATH.toLowerCase(Locale.ROOT));
        } catch (Exception e) {
            return false;
        }
    }

    private static String safeVersion(String v) {
        String s = v == null ? "" : v.replaceAll("[^0-9A-Za-z._-]", "");
        return s.isEmpty() ? "latest" : s;
    }

    private static long parseLong(String s) {
        try { return s == null ? 0 : Long.parseLong(s.trim()); } catch (Exception e) { return 0; }
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        }
        return hex(md.digest());
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format(Locale.ROOT, "%02x", x));
        return sb.toString();
    }

    private static String friendly(Throwable e) {
        if (e instanceof UnknownHostException) return "No internet connection. Check your network and try again.";
        if (e instanceof SocketTimeoutException) return "The connection timed out. Please try again.";
        String m = e.getMessage() == null ? "" : e.getMessage();
        if (m.contains("ENOSPC") || m.toLowerCase(Locale.ROOT).contains("no space")) return "Not enough free storage on the phone. Free some space and try again.";
        return m.isEmpty() ? "The download failed. Please try again." : m;
    }
}
