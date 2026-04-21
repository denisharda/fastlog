//
//  FastLogWidget.swift
//  FastLog widget extension — Phase Ring Forward
//
//  Hand-written SwiftUI + WidgetKit replacement for the broken
//  expo-widgets JS-serialized path.
//

import WidgetKit
import SwiftUI
import os.log

private let widgetLog = Logger(subsystem: "com.fastlog.app.widgets", category: "FastLogWidget")

// MARK: - Timeline entry

struct FastLogEntry: TimelineEntry {
    let date: Date
    let state: FastLogFastingState
}

// MARK: - Provider

struct FastLogProvider: TimelineProvider {
    func placeholder(in context: Context) -> FastLogEntry {
        FastLogEntry(date: Date(), state: .previewActive)
    }

    func getSnapshot(in context: Context, completion: @escaping (FastLogEntry) -> Void) {
        let state = context.isPreview ? FastLogFastingState.previewActive : FastLogAppGroup.load()
        completion(FastLogEntry(date: Date(), state: state))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FastLogEntry>) -> Void) {
        let state = FastLogAppGroup.load()
        let now = Date()

        // Build a handful of future entries so the ring/percent keeps
        // stepping forward even without further JS activity.
        var entries: [FastLogEntry] = [FastLogEntry(date: now, state: state)]

        if state.isActive, let start = state.startedAt {
            // Next 6 quarter-hour steps, bounded by target.
            let targetSeconds = Double(max(1, state.targetHours)) * 3600
            for step in 1...6 {
                let t = now.addingTimeInterval(Double(step) * 15 * 60)
                if t.timeIntervalSince(start) > targetSeconds + 3600 { break }
                entries.append(FastLogEntry(date: t, state: state))
            }
        }

        let nextRefresh = now.addingTimeInterval(15 * 60)
        widgetLog.log("getTimeline: isActive=\(state.isActive, privacy: .public) entries=\(entries.count, privacy: .public)")
        completion(Timeline(entries: entries, policy: .after(nextRefresh)))
    }
}

// MARK: - Views

struct FastLogWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    let entry: FastLogEntry

    var body: some View {
        let palette = FastLogPalette.resolved(for: colorScheme)
        let derived = FastLogDerivedState(from: entry.state, now: entry.date)

        let content = Group {
            switch family {
            case .systemMedium:
                FastLogMediumView(derived: derived, palette: palette)
            default:
                FastLogSmallView(derived: derived, palette: palette)
            }
        }
        .widgetURL(URL(string: derived.isActive ? "fastlog://timer" : "fastlog://start"))
        .onAppear {
            widgetLog.log("view render family=\(String(describing: family), privacy: .public) active=\(derived.isActive, privacy: .public) phase=\(derived.phase.name, privacy: .public)")
        }

        if #available(iOS 17.0, *) {
            content.containerBackground(palette.bg, for: .widget)
        } else {
            ZStack {
                palette.bg.ignoresSafeArea()
                content.padding()
            }
        }
    }
}

// MARK: - Shared phase ring

struct PhaseRing<Label: View>: View {
    let progress: Double
    let color: Color
    let trackColor: Color
    let lineWidth: CGFloat
    let size: CGFloat
    @ViewBuilder let label: () -> Label

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
                .frame(width: size, height: size)
            Circle()
                .trim(from: 0, to: max(0.001, min(progress, 1)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: size, height: size)
            // Constrain the label to the ring's interior so text that is
            // wider than the ring's inner diameter scales down instead of
            // bleeding outside the circle. Keeping the label's frame equal
            // to the ring's frame guarantees perfect geometric centering
            // inside the ZStack.
            label()
                .multilineTextAlignment(.center)
                .frame(width: size - lineWidth * 2, height: size - lineWidth * 2)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Small

struct FastLogSmallView: View {
    let derived: FastLogDerivedState
    let palette: FastLogPalette

    var body: some View {
        if derived.isActive, let start = derived.startedAt, let end = derived.endAt {
            activeView(start: start, end: end)
        } else {
            inactiveView
        }
    }

    private func activeView(start: Date, end: Date) -> some View {
        let phaseColor = palette.phaseColor(derived.phase)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(derived.phase.name.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.2)
                    .foregroundColor(palette.primary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(derived.protocolLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(palette.textMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            PhaseRing(
                progress: derived.progress,
                color: phaseColor,
                trackColor: phaseColor.opacity(0.18),
                lineWidth: 6,
                size: 88
            ) {
                Text(timerInterval: start...end, countsDown: false)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(palette.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity, alignment: .center)

            Spacer(minLength: 0)

            Text("\(derived.percent)%  ·  of \(derived.targetHours)h")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(palette.textFaint)
                .lineLimit(1)
        }
    }

    private var inactiveView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("READY")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.4)
                .foregroundColor(palette.primary)

            Spacer(minLength: 0)

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(derived.targetHours)")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(palette.primary)
                Text("h")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundColor(palette.primary.opacity(0.7))
            }

            Text("\(derived.protocolLabel) fasting window")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(palette.textMuted)
                .lineLimit(1)

            Spacer(minLength: 0)

            Text("Tap to start")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(palette.primary))
        }
    }
}

// MARK: - Medium

struct FastLogMediumView: View {
    let derived: FastLogDerivedState
    let palette: FastLogPalette

    var body: some View {
        if derived.isActive, let start = derived.startedAt, let end = derived.endAt {
            activeView(start: start, end: end)
        } else {
            inactiveView
        }
    }

    private func activeView(start: Date, end: Date) -> some View {
        let phaseColor = palette.phaseColor(derived.phase)
        return HStack(alignment: .center, spacing: 16) {
            PhaseRing(
                progress: derived.progress,
                color: phaseColor,
                trackColor: phaseColor.opacity(0.18),
                lineWidth: 8,
                size: 118
            ) {
                VStack(spacing: 2) {
                    Text(timerInterval: start...end, countsDown: false)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(palette.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("of \(derived.targetHours)h")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(palette.textMuted)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(derived.phase.name.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.4)
                    .foregroundColor(palette.primary)
                    .lineLimit(1)
                Text(derived.phase.description)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(palette.text)
                    .lineLimit(2)
                Text("\(derived.percent)%  ·  \(derived.protocolLabel) protocol")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(palette.textMuted)
                    .lineLimit(1)

                Spacer(minLength: 2)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("ENDS AT")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.2)
                        .foregroundColor(palette.textFaint)
                    Text(end, style: .time)
                        .font(.system(size: 14, weight: .bold))
                        .monospacedDigit()
                        .foregroundColor(palette.text)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var inactiveView: some View {
        HStack(alignment: .center, spacing: 16) {
            ZStack {
                Circle()
                    .strokeBorder(
                        palette.primary.opacity(0.55),
                        style: StrokeStyle(lineWidth: 5, lineCap: .round, dash: [4, 6])
                    )
                    .frame(width: 118, height: 118)

                VStack(spacing: 0) {
                    Text("\(derived.targetHours)h")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(palette.primary)
                    Text(derived.protocolLabel)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(palette.textMuted)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("FASTLOG")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.6)
                    .foregroundColor(palette.primary)
                Text("Ready when you are")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(palette.text)
                    .lineLimit(2)
                Text("\(derived.protocolLabel) · tap to start")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(palette.textMuted)

                Spacer(minLength: 2)

                Text("Tap to start")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(palette.primary))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Widget configuration

struct FastLogWidget: Widget {
    let kind: String = "FastingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FastLogProvider()) { entry in
            FastLogWidgetView(entry: entry)
        }
        .configurationDisplayName("Fasting Timer")
        .description("Track your fasting progress")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
