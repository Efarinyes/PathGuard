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
    private var _isConnected = false

    var isConnected: Bool {
        queue.sync { _isConnected }
    }

    var onConnected: (() -> Void)?
    var onDisconnected: (() -> Void)?

    func start() {
        guard monitor == nil else { return }

        let newMonitor = NWPathMonitor()
        newMonitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            let isSatisfied = path.status == .satisfied

            self.queue.sync {
                let previous = self._isConnected
                self._isConnected = isSatisfied

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
        }

        newMonitor.start(queue: queue)
        monitor = newMonitor
    }

    func stop() {
        monitor?.cancel()
        monitor = nil
        queue.sync { _isConnected = false }
    }

    deinit {
        stop()
    }
}
