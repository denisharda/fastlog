//
//  FastLogPhase.swift
//  FastLog widget extension
//
//  Shared phase + palette helpers. Values mirror constants/theme.ts.
//  If the Amber Sunrise palette changes in JS, update this file too.
//

import SwiftUI

enum FastLogPhase: Int, CaseIterable {
    case fed = 0
    case early = 1
    case fatBurnStart = 2
    case fatBurnPeak = 3
    case autophagy = 4
    case deepFast = 5

    var name: String {
        switch self {
        case .fed: return "Fed State"
        case .early: return "Early Fasting"
        case .fatBurnStart: return "Fat Burning Begins"
        case .fatBurnPeak: return "Fat Burning Peak"
        case .autophagy: return "Autophagy Zone"
        case .deepFast: return "Deep Fast"
        }
    }

    var description: String {
        switch self {
        case .fed: return "Body still processing last meal"
        case .early: return "Insulin dropping"
        case .fatBurnStart: return "Glycogen depleting"
        case .fatBurnPeak: return "Ketosis starting"
        case .autophagy: return "Cellular cleanup"
        case .deepFast: return "Maximum benefits"
        }
    }

    static func from(elapsedHours: Double) -> FastLogPhase {
        switch elapsedHours {
        case ..<4: return .fed
        case ..<8: return .early
        case ..<12: return .fatBurnStart
        case ..<16: return .fatBurnPeak
        case ..<18: return .autophagy
        default: return .deepFast
        }
    }

    static func from(name: String) -> FastLogPhase {
        switch name {
        case "Fed State": return .fed
        case "Early Fasting": return .early
        case "Fat Burning Begins": return .fatBurnStart
        case "Fat Burning Peak": return .fatBurnPeak
        case "Autophagy Zone": return .autophagy
        case "Deep Fast": return .deepFast
        default: return .fed
        }
    }
}

struct FastLogPalette {
    let bg: Color
    let text: Color
    let textMuted: Color
    let textFaint: Color
    let primary: Color
    let accent: Color
    let phases: [Color]

    static func resolved(for scheme: ColorScheme) -> FastLogPalette {
        switch scheme {
        case .dark:
            return FastLogPalette(
                bg: Color(hex: "#17110A"),
                text: Color(hex: "#FBF3E3"),
                textMuted: Color(hex: "#C9B590"),
                textFaint: Color(hex: "#7A6B54"),
                primary: Color(hex: "#E89B5C"),
                accent: Color(hex: "#EDBC52"),
                phases: [
                    Color(hex: "#6B5232"),
                    Color(hex: "#9C7341"),
                    Color(hex: "#C8894A"),
                    Color(hex: "#E89B5C"),
                    Color(hex: "#F0B878"),
                    Color(hex: "#F8D9A8"),
                ]
            )
        default:
            return FastLogPalette(
                bg: Color(hex: "#FBF6EE"),
                text: Color(hex: "#2A1F14"),
                textMuted: Color(hex: "#6B5A44"),
                textFaint: Color(hex: "#A8957A"),
                primary: Color(hex: "#C8621B"),
                accent: Color(hex: "#D89B2B"),
                phases: [
                    Color(hex: "#E8C89A"),
                    Color(hex: "#E6A86B"),
                    Color(hex: "#D88845"),
                    Color(hex: "#C8621B"),
                    Color(hex: "#A04418"),
                    Color(hex: "#6B2A12"),
                ]
            )
        }
    }

    func phaseColor(_ phase: FastLogPhase) -> Color {
        phases[max(0, min(phases.count - 1, phase.rawValue))]
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        var int: UInt64 = 0
        Scanner(string: s).scanHexInt64(&int)
        let r, g, b, a: Double
        switch s.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255.0
            g = Double((int >> 8) & 0xFF) / 255.0
            b = Double(int & 0xFF) / 255.0
            a = 1
        case 8:
            r = Double((int >> 24) & 0xFF) / 255.0
            g = Double((int >> 16) & 0xFF) / 255.0
            b = Double((int >> 8) & 0xFF) / 255.0
            a = Double(int & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0; a = 1
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
