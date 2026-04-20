//
//  FastLogLiveActivity.swift
//  FastLog widget extension — Ring Echo Live Activity / Dynamic Island
//

import ActivityKit
import WidgetKit
import SwiftUI
import os.log

private let activityLog = Logger(subsystem: "com.fastlog.app.widgets", category: "FastLogLiveActivity")

// MARK: - Helpers shared across Live Activity layouts

private struct ActivityContext {
    let start: Date
    let end: Date
    let targetHours: Int
    let phase: FastLogPhase
    let phaseName: String
    let phaseDescription: String
    let protocolLabel: String
    let progress: Double

    init(state: FastingActivityAttributes.ContentState, now: Date = Date()) {
        let target = max(1, state.targetHours)
        let safeName = state.phase.isEmpty ? "Fed State" : state.phase
        self.start = state.startedAt
        self.end = state.startedAt.addingTimeInterval(Double(target) * 3600)
        self.targetHours = target
        self.phase = FastLogPhase.from(name: safeName)
        self.phaseName = safeName
        self.phaseDescription = state.phaseDescription
        self.protocolLabel = state.fastingProtocol.isEmpty ? "16:8" : state.fastingProtocol
        let elapsed = now.timeIntervalSince(state.startedAt) / 3600.0
        self.progress = min(max(elapsed / Double(target), 0), 1)
    }
}

private let activityPhases: [Color] = [
    Color(hex: "#E8C89A"),
    Color(hex: "#E6A86B"),
    Color(hex: "#D88845"),
    Color(hex: "#C8621B"),
    Color(hex: "#A04418"),
    Color(hex: "#6B2A12"),
]

private func activityPhaseColor(_ phase: FastLogPhase) -> Color {
    activityPhases[max(0, min(activityPhases.count - 1, phase.rawValue))]
}

private let lockAccent = Color(hex: "#D89B2B")
private let lockText = Color(hex: "#F5F5F5")
private let lockMuted = Color(hex: "#A8957A")
private let lockFaint = Color(hex: "#6B5A44")

// MARK: - Widget

struct FastLogLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FastingActivityAttributes.self) { context in
            LockScreenBanner(state: context.state)
                .onAppear {
                    activityLog.log("lock-screen render phase=\(context.state.phase, privacy: .public)")
                }
        } dynamicIsland: { context in
            let ctx = ActivityContext(state: context.state)

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeading(ctx: ctx)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailing(ctx: ctx)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(ctx: ctx)
                }
            } compactLeading: {
                MiniGauge(progress: ctx.progress, tint: activityPhaseColor(ctx.phase))
                    .frame(width: 22, height: 22)
            } compactTrailing: {
                Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(lockText)
                    .frame(maxWidth: 56)
            } minimal: {
                MiniGauge(progress: ctx.progress, tint: activityPhaseColor(ctx.phase))
                    .frame(width: 22, height: 22)
            }
            .widgetURL(URL(string: "fastlog://timer"))
            .keylineTint(activityPhaseColor(ctx.phase))
        }
    }
}

// MARK: - Dynamic Island regions

private struct MiniGauge: View {
    let progress: Double
    let tint: Color

    var body: some View {
        Gauge(value: progress, in: 0...1) {
            EmptyView()
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(tint)
    }
}

private struct ExpandedLeading: View {
    let ctx: ActivityContext

    var body: some View {
        Gauge(value: ctx.progress, in: 0...1) {
            EmptyView()
        } currentValueLabel: {
            VStack(spacing: 0) {
                Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(lockText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text("of \(ctx.targetHours)h")
                    .font(.system(size: 8, weight: .medium))
                    .foregroundColor(lockFaint)
            }
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(activityPhaseColor(ctx.phase))
        .frame(width: 60, height: 60)
        .padding(.leading, 6)
    }
}

private struct ExpandedTrailing: View {
    let ctx: ActivityContext

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(ctx.phaseName.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(1.2)
                .foregroundColor(lockAccent)
                .lineLimit(1)
            Text("\(ctx.protocolLabel) fast")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(lockMuted)
                .lineLimit(1)
        }
        .padding(.trailing, 6)
    }
}

private struct ExpandedBottom: View {
    let ctx: ActivityContext

    var body: some View {
        let endLabel = endLabelFormatter.string(from: ctx.end)
        let desc = ctx.phaseDescription.isEmpty ? ctx.phase.description : ctx.phaseDescription
        HStack {
            Text("\(desc) · ends \(endLabel)")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(lockMuted)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 4)
    }
}

private let endLabelFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateStyle = .none
    f.timeStyle = .short
    return f
}()

// MARK: - Lock-screen banner

private struct LockScreenBanner: View {
    let state: FastingActivityAttributes.ContentState

    var body: some View {
        let ctx = ActivityContext(state: state)
        let endLabel = endLabelFormatter.string(from: ctx.end)
        let desc = ctx.phaseDescription.isEmpty ? ctx.phase.description : ctx.phaseDescription

        HStack(alignment: .center, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: "#C8621B"), Color(hex: "#6B2A12")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 48, height: 48)

                Gauge(value: ctx.progress, in: 0...1) {
                    EmptyView()
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(Color.white)
                .frame(width: 28, height: 28)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(ctx.phaseName.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.3)
                    .foregroundColor(lockAccent)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(lockText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("/ \(ctx.targetHours)h")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundColor(lockMuted)
                }

                Text("\(desc) · ends \(endLabel)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(lockMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
    }
}
