//
//  CasaZurigol10n.swift
//
//
//  Created by Luca Archidiacono on 21.02.23.
//

import Foundation

public let casaZurigol10n = Bundle.casaZurigol10n

extension Foundation.Bundle {
    private class BundleFinder {}

    static var casaZurigol10n: Bundle = {
        /* The name of your local package, prepended by "LocalPackages_" for iOS and "PackageName_" for macOS. You may have same PackageName and TargetName*/
        let bundleName = "CasaZurigol10n_CasaZurigol10n"
        let candidates = [
            Bundle.module.resourceURL,
            Bundle.module.bundleURL,
            /* Bundle should be present here when the package is linked into an App. */
            Bundle.main.resourceURL,
            /* Bundle should be present here when the package is linked into a framework. */
            Bundle(for: BundleFinder.self).resourceURL,
            /* For command-line tools. */
            Bundle.main.bundleURL,
            /* Bundle should be present here when running previews from a different package (this is the path to "…/Debug-iphonesimulator/"). */
            Bundle(for: BundleFinder.self).resourceURL?.deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent(),
            Bundle(for: BundleFinder.self).resourceURL?.deletingLastPathComponent()
                .deletingLastPathComponent(),
        ]

        for candidate in candidates {
            let bundlePath = candidate?.appendingPathComponent(bundleName + ".bundle")
            if let bundle = bundlePath.flatMap(Bundle.init(url:)) {
                return bundle
            }
        }
        fatalError("Can't find Localization custom bundle.")
    }()
}

public enum SupportedLanguage: String, CaseIterable, Sendable {
    case de
    case en
    case es
    case fr
    case he
    case it
    case ko
    case pl
    case ptPT = "pt-pt"
    case ru
    case tr
    case uk
    case zhHans = "zh-hans"
    case zhHant = "zh-hant"

    public static var current: SupportedLanguage {
        Bundle.casaZurigol10n.preferredLocalizations.first
            .flatMap { SupportedLanguage(rawValue: $0.lowercased()) } ?? .en
    }

    public var name: String? {
        Locale(identifier: rawValue).localizedString(forLanguageCode: rawValue)
    }
}

public func tr(_ key: String, _ args: CVarArg...) -> String {
    let format = Bundle.casaZurigol10n.localizedString(forKey: key, value: key, table: "Localizable")
    return String(format: format, locale: Locale.current, arguments: args)
}

public func tr(_ key: StaticString, _ args: CVarArg...) -> LocalizedStringResource {
    return LocalizedStringResource(
        key,
        defaultValue: "\(String(describing: key))",
        table: "Localizable",
        locale: Locale.current,
        bundle: .casaZurigol10n,
        comment: nil
    )
}

// swiftlint:disable convenience_type
private final class BundleToken {
    static let bundle: Bundle = {
        #if SWIFT_PACKAGE
            return Bundle.module
        #else
            return Bundle(for: BundleToken.self)
        #endif
    }()
}
// swiftlint:enable convenience_type
