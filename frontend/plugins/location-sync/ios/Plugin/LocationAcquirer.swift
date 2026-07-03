import Foundation
import CoreLocation
import CryptoKit

protocol LocationAcquirerCallback: AnyObject {
    func onLocationAccepted(_ point: LocationPoint)
}

class LocationAcquirer: NSObject {
    private static let MIN_DISTANCE_M: Double = 15.0
    private static let MAX_ACCURACY_M: Double = 50.0
    private static let MAX_JUMP_M: Double = 80.0
    private static let MAX_SPEED_MS: Double = 5.0
    private static let MAX_FIX_AGE_MS: Int64 = 10_000
    private static let AUTO_ESCALATE_AFTER_VALID_POINTS = 20

    private let manager = CLLocationManager()
    private var lastAcceptedPoint: LocationPoint?
    private weak var callback: LocationAcquirerCallback?
    private var walkId = 0
    private var acceptedPointsCount = 0
    private var hasEscalatedToAlways = false
    private(set) var isRunning = false
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = Self.MIN_DISTANCE_M
        manager.activityType = .fitness
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
    }
    
    func setWalkId(_ walkId: Int) {
        self.walkId = walkId
    }
    
    func start(callback: LocationAcquirerCallback) {
        NSLog("[LocationAcquirer] start called")
        if isRunning {
            NSLog("[LocationAcquirer] Already running, skipping")
            return
        }
        self.callback = callback
        isRunning = true
        lastAcceptedPoint = nil
        
        let status = manager.authorizationStatus
        NSLog("[LocationAcquirer] Authorization status: \(status.rawValue)")
        if status == .notDetermined {
            NSLog("[LocationAcquirer] Requesting when-in-use authorization first")
            manager.requestWhenInUseAuthorization()
        } else if status == .authorizedAlways || status == .authorizedWhenInUse {
            NSLog("[LocationAcquirer] Starting location updates")
            manager.startUpdatingLocation()
        } else {
            NSLog("[LocationAcquirer] Cannot start, status denied or restricted")
        }
    }
    
    func stop() {
        isRunning = false
        manager.stopUpdatingLocation()
        lastAcceptedPoint = nil
        acceptedPointsCount = 0
        hasEscalatedToAlways = false
    }
    
    private func processLocation(_ location: CLLocation) {
        NSLog("[LocationAcquirer] processLocation: accuracy=\(location.horizontalAccuracy), age=\(Int64(Date().timeIntervalSince(location.timestamp) * 1000))ms")
        
        guard passesAccuracyGate(location) else {
            NSLog("[LocationAcquirer] REJECTED by accuracy gate: \(location.horizontalAccuracy)")
            return
        }
        guard passesFixAgeGate(location) else {
            NSLog("[LocationAcquirer] REJECTED by fix age gate")
            return
        }
        
        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude
        let nowMs = Int64(location.timestamp.timeIntervalSince1970 * 1000)
        
        let candidate = LocationPoint(latitude: lat, longitude: lng, timestampMs: nowMs, clientId: "")
        
        guard passesAntiJitterGate(candidate) else {
            NSLog("[LocationAcquirer] REJECTED by anti-jitter gate")
            return
        }
        
        let elapsedMs = lastAcceptedPoint != nil ? nowMs - lastAcceptedPoint!.timestampMs : 0
        guard passesTeleportGate(candidate, elapsedMs: elapsedMs) else {
            NSLog("[LocationAcquirer] REJECTED by teleport gate")
            return
        }
        
        if let last = lastAcceptedPoint {
            let distance = Self.haversine(lat1: last.latitude, lng1: last.longitude, lat2: lat, lng2: lng)
            guard passesSpeedGate(distance: distance, elapsedMs: elapsedMs) else {
                NSLog("[LocationAcquirer] REJECTED by speed gate: distance=\(distance), elapsed=\(elapsedMs)")
                return
            }
        }
        
        let clientId = generateClientId(timestampMs: nowMs, lat: lat, lng: lng)
        let point = LocationPoint(latitude: lat, longitude: lng, timestampMs: nowMs, clientId: clientId)
        lastAcceptedPoint = point
        acceptedPointsCount += 1

        NSLog("[LocationAcquirer] ACCEPTED point: lat=\(lat), lng=\(lng), total=\(acceptedPointsCount)")
        callback?.onLocationAccepted(point)
        maybeEscalateToAlways()
    }

    private func maybeEscalateToAlways() {
        guard !hasEscalatedToAlways else { return }
        guard acceptedPointsCount >= Self.AUTO_ESCALATE_AFTER_VALID_POINTS else { return }
        if #available(iOS 14.0, *) {
            let status = manager.authorizationStatus
            guard status == .authorizedWhenInUse else { return }
        }
        hasEscalatedToAlways = true
        NSLog("[LocationAcquirer] Auto-escalating to always authorization after \(acceptedPointsCount) valid points")
        DispatchQueue.main.async { [weak self] in
            self?.manager.requestAlwaysAuthorization()
        }
    }
    
    private func passesAccuracyGate(_ location: CLLocation) -> Bool {
        return location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= Self.MAX_ACCURACY_M
    }
    
    private func passesFixAgeGate(_ location: CLLocation) -> Bool {
        let ageMs = Int64(Date().timeIntervalSince(location.timestamp) * 1000)
        return ageMs <= Self.MAX_FIX_AGE_MS
    }
    
    private func passesAntiJitterGate(_ candidate: LocationPoint) -> Bool {
        guard let last = lastAcceptedPoint else { return true }
        let distance = Self.haversine(
            lat1: last.latitude, lng1: last.longitude,
            lat2: candidate.latitude, lng2: candidate.longitude
        )
        return distance >= Self.MIN_DISTANCE_M
    }
    
    private func passesTeleportGate(_ candidate: LocationPoint, elapsedMs: Int64) -> Bool {
        guard let last = lastAcceptedPoint, elapsedMs <= 5000 else { return true }
        let distance = Self.haversine(
            lat1: last.latitude, lng1: last.longitude,
            lat2: candidate.latitude, lng2: candidate.longitude
        )
        return distance <= Self.MAX_JUMP_M
    }
    
    private func passesSpeedGate(distance: Double, elapsedMs: Int64) -> Bool {
        if elapsedMs <= 0 { return false }
        let speedMs = distance / (Double(elapsedMs) / 1000.0)
        return speedMs <= Self.MAX_SPEED_MS
    }
    
    private static func haversine(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
        let R = 6371000.0
        let dLat = (lat2 - lat1) * .pi / 180.0
        let dLng = (lng2 - lng1) * .pi / 180.0
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180.0) * cos(lat2 * .pi / 180.0)
            * sin(dLng / 2) * sin(dLng / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }
    
    private func generateClientId(timestampMs: Int64, lat: Double, lng: Double) -> String {
        let input = "\(timestampMs):\(String(format: "%.6f", lat)):\(String(format: "%.6f", lng)):\(walkId)"
        guard let data = input.data(using: .utf8) else {
            return UUID().uuidString
        }
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

extension LocationAcquirer: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        NSLog("[LocationAcquirer] didUpdateLocations: received \(locations.count) locations")
        for location in locations {
            processLocation(location)
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        NSLog("[LocationAcquirer] didFailWithError: \(error.localizedDescription)")
        if let clError = error as? CLError, clError.code == .denied {
            isRunning = false
        }
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = manager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        NSLog("[LocationAcquirer] locationManagerDidChangeAuthorization: \(status.rawValue)")
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            if isRunning {
                NSLog("[LocationAcquirer] Starting location updates after auth change")
                manager.startUpdatingLocation()
            }
        }
    }
}
