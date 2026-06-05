package com.pathguard.app.plugin;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;

public class LocationHttpClient {
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private final OkHttpClient client;

    public LocationHttpClient() {
        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();
    }

    public boolean sendBatch(List<LocationPoint> batch, int walkId, String deviceToken, String serverUrl, SimpleDateFormat isoFormatter) {
        JsonArray pointsArray = new JsonArray();
        for (LocationPoint p : batch) {
            JsonObject obj = new JsonObject();
            obj.addProperty("latitude", p.latitude);
            obj.addProperty("longitude", p.longitude);
            obj.addProperty("timestamp", isoFormatter.format(new Date(p.timestampMs)));
            obj.addProperty("client_id", p.clientId);
            obj.addProperty("walk_id", walkId);
            obj.addProperty("is_recovered", p.isRecovered);
            pointsArray.add(obj);
        }

        JsonObject body = new JsonObject();
        body.addProperty("walk_id", walkId);
        body.addProperty("batch_id", UUID.randomUUID().toString());
        body.add("points", pointsArray);

        String url = serverUrl.replaceAll("/$", "") + "/locations/batch";

        Request request = new Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .header("X-Patient-Token", deviceToken)
            .post(RequestBody.create(body.toString(), JSON))
            .build();

        try {
            okhttp3.Response response = client.newCall(request).execute();
            boolean success = response.isSuccessful() || response.code() == 409;
            response.close();
            return success;
        } catch (Exception e) {
            return false;
        }
    }
}
