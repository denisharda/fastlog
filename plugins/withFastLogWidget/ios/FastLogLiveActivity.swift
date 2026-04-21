//
//  FastLogLiveActivity.swift
//  FastLog widget extension — Ring Echo Live Activity / Dynamic Island
//

import ActivityKit
import WidgetKit
import SwiftUI
import os.log

private let activityLog = Logger(subsystem: "com.fastlog.app.widgets", category: "FastLogLiveActivity")

// MARK: - Local phase ring for Live Activity / Dynamic Island
//
// We can't reference the widget's PhaseRing across types because SwiftUI
// ViewBuilder generics make it awkward; duplicating the primitive here
// keeps the Live Activity self-contained and lets us guarantee the
// label is centered inside the ring regardless of text width.

private struct ActivityPhaseRing<Label: View>: View {
    let progress: Double
    let color: Color
    let trackColor: Color
    let lineWidth: CGFloat
    let size: CGFloat
    @ViewBuilder let label: () -> Label

    var body: some View {
        let inset = lineWidth / 2
        ZStack {
            Circle()
                .strokeBorder(trackColor, lineWidth: lineWidth)
            Circle()
                .inset(by: inset)
                .trim(from: 0, to: max(0.001, min(progress, 1)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            label()
                .multilineTextAlignment(.center)
                .frame(width: size - lineWidth * 2, height: size - lineWidth * 2)
        }
        .frame(width: size, height: size)
    }
}

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
                ActivityPhaseRing(
                    progress: ctx.progress,
                    color: activityPhaseColor(ctx.phase),
                    trackColor: Color.white.opacity(0.25),
                    lineWidth: 2.5,
                    size: 20
                ) {
                    EmptyView()
                }
            } compactTrailing: {
                Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(lockText)
                    .frame(maxWidth: 56)
            } minimal: {
                ActivityPhaseRing(
                    progress: ctx.progress,
                    color: activityPhaseColor(ctx.phase),
                    trackColor: Color.white.opacity(0.25),
                    lineWidth: 2.5,
                    size: 20
                ) {
                    EmptyView()
                }
            }
            .widgetURL(URL(string: "fastlog://timer"))
            .keylineTint(activityPhaseColor(ctx.phase))
        }
    }
}

// MARK: - Dynamic Island regions

private struct ExpandedLeading: View {
    let ctx: ActivityContext

    var body: some View {
        ActivityPhaseRing(
            progress: ctx.progress,
            color: activityPhaseColor(ctx.phase),
            trackColor: Color.white.opacity(0.16),
            lineWidth: 5,
            size: 64
        ) {
            VStack(spacing: 1) {
                Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(lockText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text("of \(ctx.targetHours)h")
                    .font(.system(size: 8, weight: .medium))
                    .foregroundColor(lockFaint)
                    .lineLimit(1)
            }
        }
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

        let phaseColor = activityPhaseColor(ctx.phase)
        let percent = Int((ctx.progress * 100).rounded())

        // Ring is the visual focal element: bigger (88pt) with the live
        // timer centered inside it, so the eye lands on progress + time
        // together instead of a tiny "0%" puck next to a floating number.
        HStack(alignment: .center, spacing: 14) {
            ActivityPhaseRing(
                progress: ctx.progress,
                color: phaseColor,
                trackColor: Color.white.opacity(0.16),
                lineWidth: 6,
                size: 88
            ) {
                VStack(spacing: 1) {
                    Text(timerInterval: ctx.start...ctx.end, countsDown: false)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(lockText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                    Text("\(percent)%")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(lockFaint)
                        .lineLimit(1)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(ctx.phaseName.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.3)
                    .foregroundColor(phaseColor)
                    .lineLimit(1)

                Text("\(ctx.protocolLabel) fast · of \(ctx.targetHours)h")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(lockText)
                    .lineLimit(1)

                Text("\(desc) · ends \(endLabel)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(lockMuted)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
