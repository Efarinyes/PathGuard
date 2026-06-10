package com.pathguard.app.plugin;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationSync")
public class LocationSyncPlugin extends Plugin {

    private static final int REQUEST_POST_NOTIFICATIONS = 1001;

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

        Context context = getContext();

        if (Build.VERSION.SDK_INT >= 34) {
            boolean hasFine = context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (!hasFine && !hasCoarse) {
                call.reject("Permís d'ubicació no concedit. Cal ACCESS_FINE_LOCATION o ACCESS_COARSE_LOCATION.");
                return;
            }
            if (Build.VERSION.SDK_INT >= 35) {
                boolean hasFgsLocation = context.checkSelfPermission(Manifest.permission.FOREGROUND_SERVICE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (!hasFgsLocation) {
                    call.reject("Permís FOREGROUND_SERVICE_LOCATION no concedit.");
                    return;
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                pendingStartCall = call;
                pendingServerUrl = serverUrl;
                pendingDeviceToken = deviceToken;
                pendingWalkId = walkId;

                Activity activity = getActivity();
                if (activity != null) {
                    ActivityCompat.requestPermissions(activity,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            REQUEST_POST_NOTIFICATIONS);
                } else {
                    call.reject("No s'ha pogut obtenir l'Activity per demanar permís de notificacions.");
                }
                return;
            }
        }

        doStartTracking(serverUrl, deviceToken, walkId);
        call.resolve();
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
        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            if (pendingStartCall != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    doStartTracking(pendingServerUrl, pendingDeviceToken, pendingWalkId);
                    pendingStartCall.resolve();
                } else {
                    pendingStartCall.reject("Permís de notificacions denegat. El servei en primer pla no podrà mostrar notificacions.");
                }
                pendingStartCall = null;
                pendingServerUrl = null;
                pendingDeviceToken = null;
                pendingWalkId = null;
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