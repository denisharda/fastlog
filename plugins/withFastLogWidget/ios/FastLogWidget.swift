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
            Text(derived.phase.name.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(1.2)
                .foregroundColor(phaseColor)
                .lineLimit(1)

            Spacer(minLength: 0)

            ZStack {
                Gauge(
                    value: derived.progress,
                    in: 0...1
                ) {
                    EmptyView()
                } currentValueLabel: {
                    VStack(spacing: 0) {
                        Text(timerInterval: start...end, countsDown: false)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(palette.text)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Text("of \(derived.targetHours)h")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(palette.textMuted)
                    }
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(phaseColor)
                .scaleEffect(1.35)
            }
            .frame(maxWidth: .infinity)

            Spacer(minLength: 0)

            Text("\(derived.percent)%  ·  \(derived.protocolLabel)")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(palette.textFaint)
                .lineLimit(1)
        }
        .padding(.vertical, 4)
    }

    private var inactiveView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("READY")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.4)
                .foregroundColor(palette.accent)

            Spacer(minLength: 0)

            ZStack {
                Circle()
                    .strokeBorder(
                        palette.primary.opacity(0.55),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [4, 6])
                    )
                    .frame(width: 84, height: 84)

                VStack(spacing: 0) {
                    Text("\(derived.targetHours)h")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(palette.primary)
                    Text(derived.protocolLabel)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(palette.textMuted)
                }
            }
            .frame(maxWidth: .infinity)

            Spacer(minLength: 0)

            Text("Tap to start")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(palette.accent))
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(.vertical, 4)
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
        return HStack(alignment: .center, spacing: 14) {
            Gauge(value: derived.progress, in: 0...1) {
                EmptyView()
            } currentValueLabel: {
                VStack(spacing: 0) {
                    Text(timerInterval: start...end, countsDown: false)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(palette.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("of \(derived.targetHours)h")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(palette.textMuted)
                }
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(phaseColor)
            .scaleEffect(1.55)
            .frame(width: 110, height: 110)

            VStack(alignment: .leading, spacing: 6) {
                Text(derived.phase.name.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.4)
                    .foregroundColor(palette.accent)
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
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                Circle()
                    .strokeBorder(
                        palette.primary.opacity(0.55),
                        style: StrokeStyle(lineWidth: 5, lineCap: .round, dash: [4, 6])
                    )
                    .frame(width: 110, height: 110)

                VStack(spacing: 0) {
                    Text("\(derived.targetHours)h")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
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
                    .foregroundColor(palette.accent)
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
                    .background(Capsule().fill(palette.accent))
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
