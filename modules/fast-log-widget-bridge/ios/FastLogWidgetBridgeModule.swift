//
//  FastLogWidgetBridgeModule.swift
//  Bridges FastLog widget + Live Activity state from JS to native.
//

import ExpoModulesCore
import ActivityKit
import WidgetKit
import Foundation
import os.log

private let bridgeLog = Logger(subsystem: "com.fastlog.app", category: "FastLogWidgetBridge")

private enum BridgeError: Error {
    case invalidState(String)
    case activityKitDisabled
    case liveActivityStartFailed(String)
}

private let appGroupIdentifier = "group.com.fastlog.app"
private let stateKey = "fastingState"
private let widgetKind = "FastingWidget"

// Strong references so the swift activity stays alive across calls.
private var liveActivities: [String: Any] = [:]

public class FastLogWidgetBridgeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("FastLogWidgetBridge")

        Constants([
            "appGroup": appGroupIdentifier,
            "widgetKind": widgetKind,
        ])

        // Writes the JSON-encoded fasting state blob into shared
        // UserDefaults and asks WidgetKit to refresh the timeline.
        Function("setFastingState") { (state: [String: Any]) -> Void in
            guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
                bridgeLog.error("setFastingState: could not open App Group \(appGroupIdentifier, privacy: .public)")
                return
            }
            do {
                let data = try JSONSerialization.data(withJSONObject: state, options: [])
                if let json = String(data: data, encoding: .utf8) {
                    defaults.set(json, forKey: stateKey)
                }
                bridgeLog.log("setFastingState: wrote blob (\(data.count, privacy: .public) bytes)")
            } catch {
                bridgeLog.error("setFastingState: encode failed \(String(describing: error), privacy: .public)")
            }
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
            }
        }

        Function("clearFastingState") { () -> Void in
            guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
            defaults.removeObject(forKey: stateKey)
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
            }
        }

        AsyncFunction("startFastingActivity") { (state: [String: Any], promise: Promise) in
            if #available(iOS 16.2, *) {
                do {
                    let contentState = try Self.parseContentState(from: state)
                    let info = ActivityAuthorizationInfo()
                    guard info.areActivitiesEnabled else {
                        promise.reject("ERR_ACTIVITIES_DISABLED", "Live Activities are disabled")
                        return
                    }
                    let id = UUID().uuidString
                    let attributes = FastingActivityAttributes(id: id)
                    let content = ActivityContent(state: contentState, staleDate: nil)
                    let activity = try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: nil
                    )
                    liveActivities[id] = activity
                    bridgeLog.log("startFastingActivity: started id=\(id, privacy: .public)")
                    promise.resolve(id)
                } catch {
                    bridgeLog.error("startFastingActivity failed: \(String(describing: error), privacy: .public)")
                    promise.reject("ERR_LIVE_ACTIVITY_START", String(describing: error))
                }
            } else {
                promise.reject("ERR_UNSUPPORTED_OS", "Live Activities require iOS 16.2+")
            }
        }

        AsyncFunction("updateFastingActivity") { (id: String, state: [String: Any], promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    do {
                        let contentState = try Self.parseContentState(from: state)
                        guard let activity = Self.findActivity(id: id) else {
                            promise.reject("ERR_ACTIVITY_NOT_FOUND", "No activity for id: \(id)")
                            return
                        }
                        let content = ActivityContent(state: contentState, staleDate: nil)
                        await activity.update(content)
                        promise.resolve(nil)
                    } catch {
                        promise.reject("ERR_LIVE_ACTIVITY_UPDATE", String(describing: error))
                    }
                }
            } else {
                promise.reject("ERR_UNSUPPORTED_OS", "Live Activities require iOS 16.2+")
            }
        }

        AsyncFunction("endFastingActivity") { (id: String, promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    guard let activity = Self.findActivity(id: id) else {
                        // Treat missing as success so the JS side can always call end.
                        promise.resolve(nil)
                        return
                    }
                    await activity.end(nil, dismissalPolicy: .default)
                    liveActivities.removeValue(forKey: id)
                    promise.resolve(nil)
                }
            } else {
                promise.resolve(nil)
            }
        }

        AsyncFunction("endAllFastingActivities") { (promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    for activity in Activity<FastingActivityAttributes>.activities {
                        await activity.end(nil, dismissalPolicy: .default)
                    }
                    liveActivities.removeAll()
                    promise.resolve(nil)
                }
            } else {
                promise.resolve(nil)
            }
        }

        AsyncFunction("getActiveFastingActivity") { (promise: Promise) in
            if #available(iOS 16.2, *) {
                let existing = Activity<FastingActivityAttributes>.activities.first
                if let existing = existing {
                    liveActivities[existing.attributes.id] = existing
                    promise.resolve(existing.attributes.id)
                } else {
                    promise.resolve(nil)
                }
            } else {
                promise.resolve(nil)
            }
        }

        AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }
    }

    @available(iOS 16.2, *)
    private static func findActivity(id: String) -> Activity<FastingActivityAttributes>? {
        if let cached = liveActivities[id] as? Activity<FastingActivityAttributes> {
            return cached
        }
        if let found = Activity<FastingActivityAttributes>.activities.first(where: { $0.attributes.id == id }) {
            liveActivities[id] = found
            return found
        }
        return nil
    }

    private static func parseContentState(from raw: [String: Any]) throws -> FastingActivityAttributes.ContentState {
        guard let startedAtRaw = raw["startedAt"] as? String else {
            throw BridgeError.invalidState("missing startedAt")
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var startedAt = formatter.date(from: startedAtRaw)
        if startedAt == nil {
            let fallback = ISO8601DateFormatter()
            fallback.formatOptions = [.withInternetDateTime]
            startedAt = fallback.date(from: startedAtRaw)
        }
        guard let start = startedAt else {
            throw BridgeError.invalidState("unparseable startedAt: \(startedAtRaw)")
        }
        let targetHours = (raw["targetHours"] as? Int) ?? Int((raw["targetHours"] as? Double) ?? 16)
        let phase = (raw["phase"] as? String) ?? "Fed State"
        let description = (raw["phaseDescription"] as? String) ?? ""
        let protocolLabel = (raw["protocol"] as? String) ?? "16:8"
        return FastingActivityAttributes.ContentState(
            startedAt: start,
            targetHours: targetHours,
            phase: phase,
            phaseDescription: description,
            fastingProtocol: protocolLabel
        )
    }
}
