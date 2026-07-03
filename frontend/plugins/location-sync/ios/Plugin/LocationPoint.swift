import Foundation

struct LocationPoint: Codable, Comparable {
    let latitude: Double
    let longitude: Double
    let timestampMs: Int64
    let clientId: String
    var isRecovered: Bool
    
    enum CodingKeys: String, CodingKey {
        case latitude = "lat"
        case longitude = "lng"
        case timestampMs = "ts"
        case clientId = "cid"
        case isRecovered = "rec"
    }
    
    init(latitude: Double, longitude: Double, timestampMs: Int64, clientId: String) {
        self.latitude = latitude
        self.longitude = longitude
        self.timestampMs = timestampMs
        self.clientId = clientId
        self.isRecovered = false
    }
    
    static func < (lhs: LocationPoint, rhs: LocationPoint) -> Bool {
        lhs.timestampMs < rhs.timestampMs
    }
    
    static func == (lhs: LocationPoint, rhs: LocationPoint) -> Bool {
        lhs.timestampMs == rhs.timestampMs && lhs.clientId == rhs.clientId
    }
}
