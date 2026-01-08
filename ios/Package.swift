// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "CasaZurigol10n",
  defaultLocalization: "en",
  platforms: [
    .iOS(.v17)
  ],
  products: [
    .library(
      name: "CasaZurigol10n",
      targets: ["CasaZurigol10n"]
    )
  ],
  targets: [
    .target(
      name: "CasaZurigol10n",
      resources: [
        .process("Resources/de.lproj"),
        .process("Resources/en.lproj"),
        .process("Resources/es.lproj"),
        .process("Resources/fr.lproj"),
        .process("Resources/it.lproj"),
        .process("Resources/pt-PT.lproj"),
        .process("Resources/tr.lproj"),
      ]
    )
  ]
)
