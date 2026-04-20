//
//  FastingActivityAttributes.swift
//  Main-app copy of the Live Activity attributes struct. ActivityKit
//  serializes attributes by fully-qualified type name, so the struct
//  must be declared in BOTH the app and the widget-extension targets.
//  Keep in sync with
//  plugins/withFastLogWidget/ios/FastingActivityAttributes.swift.
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
