import Foundation

class BufferStore {
    private let defaults = UserDefaults.standard
    private let bufferKey = "pathguard_buffer"
    private let flushFailedKey = "pathguard_flush_failed"
    private let streakKey = "pathguard_recovery_streak"
    
    private let walkIdKey = "pathguard_walk_id"
    private let deviceTokenKey = "pathguard_device_token"
    private let serverUrlKey = "pathguard_server_url"
    
    func save(_ buffer: [LocationPoint], lastFlushFailed: Bool, recoveryStreak: Int) {
        if let data = try? JSONEncoder().encode(buffer) {
            defaults.set(data, forKey: bufferKey)
        }
        defaults.set(lastFlushFailed, forKey: flushFailedKey)
        defaults.set(recoveryStreak, forKey: streakKey)
    }
    
    func load() -> [LocationPoint] {
        guard let data = defaults.data(forKey: bufferKey),
              let buffer = try? JSONDecoder().decode([LocationPoint].self, from: data) else {
            return []
        }
        return buffer
    }
    
    func getLastFlushFailed() -> Bool {
        return defaults.bool(forKey: flushFailedKey)
    }
    
    func getRecoveryStreak() -> Int {
        return defaults.integer(forKey: streakKey)
    }
    
    func clear() {
        defaults.removeObject(forKey: bufferKey)
        defaults.removeObject(forKey: flushFailedKey)
        defaults.removeObject(forKey: streakKey)
    }
    
    func saveSession(walkId: Int, deviceToken: String, serverUrl: String) {
        defaults.set(walkId, forKey: walkIdKey)
        defaults.set(deviceToken, forKey: deviceTokenKey)
        defaults.set(serverUrl, forKey: serverUrlKey)
    }
    
    func loadSession() -> (walkId: Int, deviceToken: String, serverUrl: String)? {
        let walkId = defaults.integer(forKey: walkIdKey)
        guard let deviceToken = defaults.string(forKey: deviceTokenKey),
              let serverUrl = defaults.string(forKey: serverUrlKey),
              walkId > 0 else {
            return nil
        }
        return (walkId, deviceToken, serverUrl)
    }
    
    func clearSession() {
        defaults.removeObject(forKey: walkIdKey)
        defaults.removeObject(forKey: deviceTokenKey)
        defaults.removeObject(forKey: serverUrlKey)
    }
}
