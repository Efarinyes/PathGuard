import Foundation
import UIKit

class LocationSyncService {
    private static let IDLE_INTERVAL_SECONDS: TimeInterval = 30
    private static let FLUSH_DELAY_SECONDS: TimeInterval = 2
    
    private let store: BufferStore
    private let buffer: LocationBuffer
    private let httpClient: LocationHttpClient
    private let acquirer: LocationAcquirer
    
    private var walkId = 0
    private var deviceToken = ""
    private var serverUrl = ""
    
    private var flushTimer: DispatchSourceTimer?
    private var idleTimer: DispatchSourceTimer?
    
    private(set) var isRunning = false
    private(set) var pointsSent = 0
    private(set) var lastSentAt: String?
    private var appInForeground: Bool = true
    
    private lazy var isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    
    init() {
        NSLog("[LocationSyncService] init called")
        store = BufferStore()
        buffer = LocationBuffer(store: store)
        httpClient = LocationHttpClient()
        acquirer = LocationAcquirer()
        
        loadSession()
        
        if !buffer.isEmpty && !serverUrl.isEmpty && !deviceToken.isEmpty {
            NSLog("[LocationSyncService] Found pending buffer, scheduling flush")
            DispatchQueue.global().asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.flushBuffer()
            }
        }
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        flushTimer?.cancel()
        idleTimer?.cancel()
    }
    
    func start(walkId: Int, deviceToken: String, serverUrl: String) {
        NSLog("[LocationSyncService] start called: walkId=\(walkId), serverUrl=\(serverUrl)")
        self.serverUrl = serverUrl
        self.deviceToken = deviceToken
        self.walkId = walkId
        saveSession()
        
        if isRunning {
            NSLog("[LocationSyncService] Already running, skipping")
            return
        }
        isRunning = true
        pointsSent = 0
        lastSentAt = nil
        
        acquirer.setWalkId(walkId)
        acquirer.start(callback: self)
        
        if !buffer.isEmpty {
            NSLog("[LocationSyncService] Buffer not empty, flushing")
            flushBuffer()
        }
        
        startIdleTimer()
    }
    
    func stop() {
        isRunning = false
        acquirer.stop()
        flushBuffer()
        stopIdleTimer()
        clearSession()
        store.clear()
    }
    
    func updateWalkId(_ walkId: Int) {
        self.walkId = walkId
        acquirer.setWalkId(walkId)
        saveSession()
    }
    
    func markBackgrounded() {
        NSLog("[LocationSyncService] markBackgrounded")
        appInForeground = false
    }

    func markForegrounded() {
        NSLog("[LocationSyncService] markForegrounded")
        appInForeground = true
        if isRunning && !buffer.isEmpty {
            flushBuffer()
        }
    }

    @objc private func applicationDidBecomeActive() {
        if !appInForeground {
            markForegrounded()
        }
    }

    @objc private func applicationWillResignActive() {
        if appInForeground {
            markBackgrounded()
        }
    }

    private func onPointAccepted(_ point: LocationPoint) {
        NSLog("[LocationSyncService] onPointAccepted: lat=\(point.latitude), lng=\(point.longitude)")
        buffer.add(point)
        scheduleFlush()
    }
    
    private func scheduleFlush() {
        flushTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: .global())
        timer.schedule(deadline: .now() + Self.FLUSH_DELAY_SECONDS, leeway: .milliseconds(100))
        timer.setEventHandler { [weak self] in
            self?.flushBuffer()
        }
        timer.resume()
        flushTimer = timer
    }
    
    private func flushBuffer() {
        NSLog("[LocationSyncService] flushBuffer called, buffer.isEmpty=\(buffer.isEmpty)")
        if buffer.isEmpty { return }
        if serverUrl.isEmpty || deviceToken.isEmpty {
            NSLog("[LocationSyncService] flushBuffer: missing serverUrl or deviceToken")
            return
        }
        
        let batch = buffer.drainAll()
        if batch.isEmpty { return }
        
        NSLog("[LocationSyncService] flushBuffer: sending \(batch.count) points")
        httpClient.sendBatch(batch, walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl) { [weak self] success in
            guard let self = self else { return }
            NSLog("[LocationSyncService] flushBuffer HTTP result: success=\(success)")
            if success {
                self.pointsSent += batch.count
                self.lastSentAt = self.isoFormatter.string(from: Date())
                self.buffer.onFlushSuccess()
            } else {
                self.buffer.onFlushFailure(batch)
            }
        }
    }
    
    private func startIdleTimer() {
        let timer = DispatchSource.makeTimerSource(queue: .global())
        timer.schedule(deadline: .now() + Self.IDLE_INTERVAL_SECONDS, repeating: Self.IDLE_INTERVAL_SECONDS, leeway: .seconds(5))
        timer.setEventHandler { [weak self] in
            self?.flushBuffer()
        }
        timer.resume()
        idleTimer = timer
    }
    
    private func stopIdleTimer() {
        idleTimer?.cancel()
        idleTimer = nil
    }
    
    private func loadSession() {
        let defaults = UserDefaults.standard
        walkId = defaults.integer(forKey: "pg_walk_id")
        deviceToken = defaults.string(forKey: "pg_device_token") ?? ""
        serverUrl = defaults.string(forKey: "pg_server_url") ?? ""
    }
    
    private func saveSession() {
        let defaults = UserDefaults.standard
        defaults.set(walkId, forKey: "pg_walk_id")
        defaults.set(deviceToken, forKey: "pg_device_token")
        defaults.set(serverUrl, forKey: "pg_server_url")
    }
    
    private func clearSession() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "pg_walk_id")
        defaults.removeObject(forKey: "pg_device_token")
        defaults.removeObject(forKey: "pg_server_url")
    }
}

extension LocationSyncService: LocationAcquirerCallback {
    func onLocationAccepted(_ point: LocationPoint) {
        var point = point
        onPointAccepted(point)
    }
}
