package com.pathguard.app.plugin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.core.app.NotificationCompat;

public class NotificationHelper {

    public static final String CHANNEL_ID = "pathguard_walk";
    public static final int NOTIFICATION_ID = 1;

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Passeig PathGuard",
                    NotificationManager.IMPORTANCE_MIN
            );
            channel.setDescription("Només mentre duri el passeig");
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
        int icon = context.getApplicationInfo().icon;
        return new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("Bon passeig")
                .setContentText(null)
                .setSmallIcon(icon)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setSilent(true)
                .setShowWhen(false)
                .build();
    }
}
