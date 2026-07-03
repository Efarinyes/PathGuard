import Foundation

class LocationBuffer {
    private static let BUFFER_MAX_SIZE = 200
    private static let RECOVERY_STREAK_THRESHOLD = 3
    
    private var buffer: [LocationPoint] = []
    private let store: BufferStore
    private(set) var lastFlushFailed = false
    private var recoveryStreak = 0
    
    init(store: BufferStore) {
        self.store = store
        self.buffer = store.load()
        self.lastFlushFailed = store.getLastFlushFailed()
        self.recoveryStreak = store.getRecoveryStreak()
        
        for i in 0..<buffer.count {
            buffer[i].isRecovered = true
        }
    }
    
    func add(_ point: LocationPoint) {
        buffer.append(point)
        buffer.sort { $0.timestampMs < $1.timestampMs }
        if buffer.count > Self.BUFFER_MAX_SIZE {
            buffer.removeFirst()
        }
    }
    
    func drainAll() -> [LocationPoint] {
        let batch = buffer
        buffer.removeAll()
        return batch
    }
    
    func save() {
        store.save(buffer, lastFlushFailed: lastFlushFailed, recoveryStreak: recoveryStreak)
    }
    
    func clear() {
        store.clear()
    }
    
    func onFlushSuccess() {
        recoveryStreak = 0
        lastFlushFailed = false
        store.clear()
    }

    func onFlushFailure(_ batch: [LocationPoint]) {
        recoveryStreak += 1
        if recoveryStreak >= Self.RECOVERY_STREAK_THRESHOLD {
            lastFlushFailed = true
        }
        reAdd(batch)
    }

    private func reAdd(_ batch: [LocationPoint]) {
        for var point in batch {
            point.isRecovered = true
            buffer.append(point)
        }
        buffer.sort { $0.timestampMs < $1.timestampMs }
        while buffer.count > Self.BUFFER_MAX_SIZE {
            buffer.removeFirst()
        }
        store.save(buffer, lastFlushFailed: lastFlushFailed, recoveryStreak: recoveryStreak)
    }
    
    var isEmpty: Bool {
        return buffer.isEmpty
    }
    
    var isLastFlushFailed: Bool {
        return lastFlushFailed
    }
}
