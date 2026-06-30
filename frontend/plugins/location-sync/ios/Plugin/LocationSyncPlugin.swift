import Foundation
import Capacitor

@objc(LocationSyncPlugin)
public class LocationSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocationSyncPlugin"
    public let jsName = "LocationSync"
    public let pluginMethods: [CAPPluginMethod] = [
        .init(name: "startTracking", returnType: CAPPluginReturnPromise),
        .init(name: "stopTracking", returnType: CAPPluginReturnPromise),
        .init(name: "updateWalkId", returnType: CAPPluginReturnPromise),
        .init(name: "getStatus", returnType: CAPPluginReturnPromise),
        .init(name: "markBackgrounded", returnType: CAPPluginReturnPromise),
        .init(name: "markForegrounded", returnType: CAPPluginReturnPromise)
    ]

    private let service = LocationSyncService()

    @objc public func startTracking(_ call: CAPPluginCall) {
        NSLog("[LocationSyncPlugin] startTracking called")
        guard let serverUrl = call.getString("serverUrl"),
              let deviceToken = call.getString("deviceToken"),
              let walkId = call.getInt("walkId") else {
            NSLog("[LocationSyncPlugin] Missing parameters")
            call.reject("Missing required parameters: serverUrl, deviceToken, walkId")
            return
        }

        NSLog("[LocationSyncPlugin] Parameters: serverUrl=\(serverUrl), deviceToken=\(deviceToken), walkId=\(walkId)")
        service.start(walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl)
        call.resolve()
    }

    @objc public func stopTracking(_ call: CAPPluginCall) {
        service.stop()
        call.resolve()
    }

    @objc public func updateWalkId(_ call: CAPPluginCall) {
        guard let walkId = call.getInt("walkId") else {
            call.reject("Missing required parameter: walkId")
            return
        }

        service.updateWalkId(walkId)
        call.resolve()
    }

    @objc public func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "isTracking": service.isRunning,
            "pointsSent": service.pointsSent,
            "lastSentAt": service.lastSentAt as Any
        ])
    }

    @objc public func markBackgrounded(_ call: CAPPluginCall) {
        service.markBackgrounded()
        call.resolve()
    }

    @objc public func markForegrounded(_ call: CAPPluginCall) {
        service.markForegrounded()
        call.resolve()
    }
}
