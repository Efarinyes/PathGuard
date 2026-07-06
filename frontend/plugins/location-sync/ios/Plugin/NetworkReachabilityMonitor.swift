import Foundation
import Network

/**
 * Monitors iOS network reachability using NWPathMonitor.
 *
 * WKWebView (Capacitor) does not reliably fire the `online` event nor does
 * `navigator.onLine` reflect real connectivity. This monitor runs outside the
 * WebView process and reports changes back to the plugin, which forwards them
 * to the TypeScript layer via Capacitor events.
 */
final class NetworkReachabilityMonitor {
    private var monitor: NWPathMonitor?
    private let queue = DispatchQueue(label: "com.pathguard.network-monitor")
    private let lock = NSLock()
    private var _isConnected = false

    var isConnected: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _isConnected
    }

    var onConnected: (() -> Void)?
    var onDisconnected: (() -> Void)?

    func start() {
        guard monitor == nil else { return }

        let newMonitor = NWPathMonitor()
        newMonitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            let isSatisfied = path.status == .satisfied

            // pathUpdateHandler already runs serially on `queue`, but we still
            // protect `_isConnected` with a lock so external readers (getter,
            // stop) see consistent state without risking deadlock via queue.sync.
            self.lock.lock()
            let previous = self._isConnected
            self._isConnected = isSatisfied
            self.lock.unlock()

            if !previous && isSatisfied {
                DispatchQueue.main.async { [weak self] in
                    self?.onConnected?()
                }
            } else if previous && !isSatisfied {
                DispatchQueue.main.async { [weak self] in
                    self?.onDisconnected?()
                }
            }
        }

        newMonitor.start(queue: queue)
        monitor = newMonitor
    }

    func stop() {
        monitor?.cancel()
        monitor = nil
        lock.lock()
        _isConnected = false
        lock.unlock()
    }

    deinit {
        stop()
    }
}
