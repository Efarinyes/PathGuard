import Foundation

class LocationHttpClient {
    private let session: URLSession
    private let timeout: TimeInterval = 15
    private let isoFormatter: ISO8601DateFormatter
    
    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        self.session = URLSession(configuration: config)
        self.isoFormatter = ISO8601DateFormatter()
        self.isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }
    
    func sendBatch(
        _ batch: [LocationPoint],
        walkId: Int,
        deviceToken: String,
        serverUrl: String,
        completion: @escaping (Bool) -> Void
    ) {
        var pointsArray: [[String: Any]] = []
        for p in batch {
            let date = Date(timeIntervalSince1970: TimeInterval(p.timestampMs) / 1000.0)
            let point: [String: Any] = [
                "latitude": p.latitude,
                "longitude": p.longitude,
                "timestamp": isoFormatter.string(from: date),
                "client_id": p.clientId,
                "walk_id": walkId,
                "is_recovered": p.isRecovered
            ]
            pointsArray.append(point)
        }
        
        let body: [String: Any] = [
            "walk_id": walkId,
            "batch_id": UUID().uuidString,
            "points": pointsArray
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            NSLog("[LocationHttpClient] Failed to serialize JSON")
            completion(false)
            return
        }
        
        let cleanedUrl = serverUrl.hasSuffix("/") ? String(serverUrl.dropLast()) : serverUrl
        let fullUrl = "\(cleanedUrl)/locations/batch"
        NSLog("[LocationHttpClient] Sending to URL: \(fullUrl)")
        guard let url = URL(string: fullUrl) else {
            NSLog("[LocationHttpClient] Invalid URL: \(fullUrl)")
            completion(false)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(deviceToken, forHTTPHeaderField: "X-Patient-Token")
        request.httpBody = jsonData
        
        let task = session.dataTask(with: request) { _, response, error in
            if let error = error {
                NSLog("[LocationHttpClient] Network error: \(error.localizedDescription)")
                completion(false)
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                NSLog("[LocationHttpClient] Invalid HTTP response")
                completion(false)
                return
            }
            let success = (200...299).contains(httpResponse.statusCode)
            NSLog("[LocationHttpClient] HTTP response: statusCode=\(httpResponse.statusCode), success=\(success)")
            completion(success)
        }
        task.resume()
    }
}
