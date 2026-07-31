package com.pathguard.app.plugin;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationSync")
public class LocationSyncPlugin extends Plugin {

    private static final int REQUEST_POST_NOTIFICATIONS = 1001;
    private static final int REQUEST_FINE_LOCATION = 1002;

    private PluginCall pendingStartCall;
    private String pendingServerUrl;
    private String pendingDeviceToken;
    private Integer pendingWalkId;

    @PluginMethod
    public void startTracking(PluginCall call) {
        String serverUrl = call.getString("serverUrl");
        String deviceToken = call.getString("deviceToken");
        Integer walkId = call.getInt("walkId");

        if (serverUrl == null || deviceToken == null || walkId == null) {
            call.reject("Missing required parameters: serverUrl, deviceToken, walkId");
            return;
        }

        pendingStartCall = call;
        pendingServerUrl = serverUrl;
        pendingDeviceToken = deviceToken;
        pendingWalkId = walkId;

        if (!ensurePermissionsAndStart()) {
            // Waiting for permission dialog; call resolved/rejected in callback.
        }
    }

    /**
     * FGS with foregroundServiceType=location does not require ACCESS_BACKGROUND_LOCATION
     * when started from the foreground with while-in-use location granted (Android 10+).
     */
    private boolean ensurePermissionsAndStart() {
        Context context = getContext();

        if (!hasLocationPermission(context)) {
            if (getActivity() == null) {
                rejectPending("No es pot demanar el permís d'ubicació sense activitat activa.");
                return false;
            }
            ActivityCompat.requestPermissions(
                getActivity(),
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                REQUEST_FINE_LOCATION
            );
            return false;
        }

        if (Build.VERSION.SDK_INT >= 34) {
            boolean hasFgsLocation = context.checkSelfPermission(Manifest.permission.FOREGROUND_SERVICE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
            if (!hasFgsLocation) {
                rejectPending("Permís FOREGROUND_SERVICE_LOCATION no concedit.");
                return false;
            }
        }

        if (Build.VERSION.SDK_INT >= 33) {
            boolean hasNotifications = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
            if (!hasNotifications) {
                if (getActivity() == null) {
                    rejectPending("No es pot demanar el permís de notificacions sense activitat activa.");
                    return false;
                }
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_POST_NOTIFICATIONS
                );
                return false;
            }
        }

        completePendingStart();
        return true;
    }

    private static boolean hasLocationPermission(Context context) {
        boolean hasFine = context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        return hasFine || hasCoarse;
    }

    private void completePendingStart() {
        if (pendingStartCall == null || pendingServerUrl == null || pendingDeviceToken == null || pendingWalkId == null) {
            return;
        }
        doStartTracking(pendingServerUrl, pendingDeviceToken, pendingWalkId);
        pendingStartCall.resolve();
        clearPendingStart();
    }

    private void rejectPending(String message) {
        if (pendingStartCall != null) {
            pendingStartCall.reject(message);
        }
        clearPendingStart();
    }

    private void clearPendingStart() {
        pendingStartCall = null;
        pendingServerUrl = null;
        pendingDeviceToken = null;
        pendingWalkId = null;
    }

    private void doStartTracking(String serverUrl, String deviceToken, Integer walkId) {
        Context context = getContext();
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("START");
        intent.putExtra("serverUrl", serverUrl);
        intent.putExtra("deviceToken", deviceToken);
        intent.putExtra("walkId", walkId);
        context.startForegroundService(intent);
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
        if (pendingStartCall == null) {
            return;
        }

        if (requestCode == REQUEST_FINE_LOCATION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                ensurePermissionsAndStart();
            } else {
                rejectPending("Permís d'ubicació no concedit. Cal permetre l'accés a la ubicació per iniciar el passeig.");
            }
            return;
        }

        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                ensurePermissionsAndStart();
            } else {
                rejectPending("Permís de notificacions denegat. El servei en primer pla no podrà mostrar la icona discreta del passeig.");
            }
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("STOP");
        context.startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void updateWalkId(PluginCall call) {
        Integer walkId = call.getInt("walkId");
        if (walkId == null) {
            call.reject("Missing required parameter: walkId");
            return;
        }

        Context context = getContext();
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("UPDATE_WALK_ID");
        intent.putExtra("walkId", walkId);
        context.startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isTracking", LocationSyncForegroundService.isRunning());
        ret.put("pointsSent", LocationSyncForegroundService.getPointsSent());
        ret.put("lastSentAt", LocationSyncForegroundService.getLastSentAt());
        call.resolve(ret);
    }

    @PluginMethod
    public void markBackgrounded(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("MARK_BACKGROUNDED");
        context.startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void markForegrounded(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("MARK_FOREGROUNDED");
        context.startService(intent);
        call.resolve();
    }
}
