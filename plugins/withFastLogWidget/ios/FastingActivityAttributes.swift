//
//  FastingActivityAttributes.swift
//  FastLog — Live Activity attributes (shared between main app and widget
//  extension). ActivityKit requires the same struct in both targets.
//

import Foundation
import ActivityKit

public struct FastingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var startedAt: Date
        public var targetHours: Int
        public var phase: String
        public var phaseDescription: String
        public var fastingProtocol: String

        enum CodingKeys: String, CodingKey {
            case startedAt
            case targetHours
            case phase
            case phaseDescription
            case fastingProtocol = "protocol"
        }

        public init(
            startedAt: Date,
            targetHours: Int,
            phase: String,
            phaseDescription: String,
            fastingProtocol: String
        ) {
            self.startedAt = startedAt
            self.targetHours = targetHours
            self.phase = phase
            self.phaseDescription = phaseDescription
            self.fastingProtocol = fastingProtocol
        }
    }

    public var id: String

    public init(id: String) {
        self.id = id
    }
}
