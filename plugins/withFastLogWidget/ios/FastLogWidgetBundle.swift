//
//  FastLogWidgetBundle.swift
//  FastLog widget extension entry point.
//

import WidgetKit
import SwiftUI

@main
struct FastLogWidgetBundle: WidgetBundle {
    var body: some Widget {
        FastLogWidget()
        FastLogLiveActivity()
    }
}
