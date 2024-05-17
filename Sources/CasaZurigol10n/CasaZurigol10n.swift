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
            /* Bundle should be present here when the package is linked into an App. */
            Bundle.main.resourceURL,
            /* Bundle should be present here when the package is linked into a framework. */
            Bundle(for: BundleFinder.self).resourceURL,
            /* For command-line tools. */
            Bundle.main.bundleURL,
            /* Bundle should be present here when running previews from a different package (this is the path to "…/Debug-iphonesimulator/"). */
            Bundle(for: BundleFinder.self).resourceURL?.deletingLastPathComponent().deletingLastPathComponent()
                .deletingLastPathComponent(),
            Bundle(for: BundleFinder.self).resourceURL?.deletingLastPathComponent().deletingLastPathComponent(),
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

public enum CasaZurigol10n {}

extension CasaZurigol10n {
	private enum Language {
		case de
		case en
		case fr

		init(code: String, region: String) {
			switch code.lowercased() {
			case "de":
				self = .de
			case "fr":
				self = .fr
			default:
				self = .en
			}
		}
	}

	public enum SupportedLanguage: String {
		case de
		case fr
		case en
		case it
		
		public var rawValue: String {
			switch self {
			case .de:
				return "de"
			case .fr:
				return "fr"
			case .en:
				return "en"
			case .it:
				return "it"
			}
		}
	}

	public static var appLanguage: SupportedLanguage {
		guard let language = Bundle.main.preferredLocalizations.first else {
			return .en
		}

		let code = language.prefix(2).lowercased()
		let region = language.suffix(2).lowercased()

		switch Language(code: code, region: region) {
		case .de:
			return .de
		case .en:
			return .en
		case .fr:
			return .fr
		}
	}
}
