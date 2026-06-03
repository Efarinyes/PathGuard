package com.pathguard.app.plugin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class NotificationHelper {

    public static final String CHANNEL_ID = "location_tracking";
    public static final int NOTIFICATION_ID = 1;

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "PathGuard",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Notificació del servei de localització");
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.enableLights(false);
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_SECRET);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    public static Notification buildNotification(Context context) {
        return new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("Passeig actiu")
                .setContentText(null)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .setShowWhen(false)
                .build();
    }
}
