//
//  FastLogSharedState.swift
//  FastLog widget extension
//
//  Decodes the fasting state the main app writes into the shared App
//  Group (group.com.fastlog.app) under the key "fastingState".
//

import Foundation

public struct FastLogFastingState: Codable {
    public let isActive: Bool
    public let startedAt: Date?
    public let targetHours: Int
    public let phase: String
    public let fastingProtocol: String

    enum CodingKeys: String, CodingKey {
        case isActive
        case startedAt
        case targetHours
        case phase
        case fastingProtocol = "protocol"
    }

    public init(
        isActive: Bool,
        startedAt: Date?,
        targetHours: Int,
        phase: String,
        fastingProtocol: String
    ) {
        self.isActive = isActive
        self.startedAt = startedAt
        self.targetHours = targetHours
        self.phase = phase
        self.fastingProtocol = fastingProtocol
    }

    public static let placeholder = FastLogFastingState(
        isActive: false,
        startedAt: nil,
        targetHours: 16,
        phase: "Fed State",
        fastingProtocol: "16:8"
    )

    public static let previewActive = FastLogFastingState(
        isActive: true,
        startedAt: Date().addingTimeInterval(-60 * 60 * 9),
        targetHours: 16,
        phase: "Fat Burning Begins",
        fastingProtocol: "16:8"
    )
}

public enum FastLogAppGroup {
    public static let identifier = "group.com.fastlog.app"
    public static let stateKey = "fastingState"

    public static func load() -> FastLogFastingState {
        guard let defaults = UserDefaults(suiteName: identifier) else {
            return .placeholder
        }

        // Accept either a JSON string or a Data blob — the JS side writes
        // a string because React Native's bridge marshals that cheaply.
        let raw: Data?
        if let s = defaults.string(forKey: stateKey), let d = s.data(using: .utf8) {
            raw = d
        } else if let d = defaults.data(forKey: stateKey) {
            raw = d
        } else {
            raw = nil
        }

        guard let data = raw else { return .placeholder }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let decoded = try? decoder.decode(FastLogFastingState.self, from: data) {
            return decoded
        }
        return .placeholder
    }
}

struct FastLogDerivedState {
    let isActive: Bool
    let startedAt: Date?
    let targetHours: Int
    let protocolLabel: String
    let phase: FastLogPhase
    let elapsedHours: Double
    let progress: Double
    let percent: Int
    let endAt: Date?

    init(from state: FastLogFastingState, now: Date = Date()) {
        let safeTarget = state.targetHours > 0 ? state.targetHours : 16
        self.isActive = state.isActive && state.startedAt != nil
        self.startedAt = state.startedAt
        self.targetHours = safeTarget
        self.protocolLabel = state.fastingProtocol.isEmpty ? "16:8" : state.fastingProtocol

        if let start = state.startedAt, self.isActive {
            let elapsed = now.timeIntervalSince(start) / 3600.0
            self.elapsedHours = max(0, elapsed)
            self.phase = FastLogPhase.from(elapsedHours: self.elapsedHours)
            let p = min(max(elapsed / Double(safeTarget), 0), 1)
            self.progress = p
            self.percent = Int((p * 100).rounded())
            self.endAt = start.addingTimeInterval(Double(safeTarget) * 3600)
        } else {
            self.elapsedHours = 0
            self.phase = FastLogPhase.from(name: state.phase)
            self.progress = 0
            self.percent = 0
            self.endAt = nil
        }
    }
}
