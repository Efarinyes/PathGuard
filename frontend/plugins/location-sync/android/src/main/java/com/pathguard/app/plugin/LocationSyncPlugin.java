package com.pathguard.app.plugin;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationSync")
public class LocationSyncPlugin extends Plugin {

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
        Intent intent = new Intent(context, LocationSyncForegroundService.class);
        intent.setAction("START");
        intent.putExtra("serverUrl", serverUrl);
        intent.putExtra("deviceToken", deviceToken);
        intent.putExtra("walkId", walkId);

        context.startForegroundService(intent);
        call.resolve();
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
}
