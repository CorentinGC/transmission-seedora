# Changelog

## [1.1.0](https://github.com/CorentinGC/transmission-seedora/compare/seedora-v1.0.0...seedora-v1.1.0) (2026-03-05)


### Features

* add i18n keys for server management, speed presets, backup ([00ed24b](https://github.com/CorentinGC/transmission-seedora/commit/00ed24b20aabedc937d085e2d94c8bfd7be797e0))
* add i18n-strings skill enforcing translations in all 23 locales ([77e588a](https://github.com/CorentinGC/transmission-seedora/commit/77e588a101b6d8f7eecc7ed7f6adcec51e55c70f))
* add system tray, notifications, watch folder, native menu, i18n, GeoIP, app prefs (Phases 8-9) ([d7bb741](https://github.com/CorentinGC/transmission-seedora/commit/d7bb741b214c53f5d3b44ff86190d7771ec6ca53))
* add web PWA version with monorepo restructure ([77d4074](https://github.com/CorentinGC/transmission-seedora/commit/77d40743cadec571b9258a34e4ce2ac5b776e62b))
* auto-fit column width on double-click resize handle ([4a64de3](https://github.com/CorentinGC/transmission-seedora/commit/4a64de36055719e19d3efb8d6f5f014446be6ea7))
* column reorder, header menu, session stats, disk space dialog, select-none ([0d17efe](https://github.com/CorentinGC/transmission-seedora/commit/0d17efebc0cc3ec6839e921d0bcce740e003e2a8))
* complete i18n with 23 languages and system language detection ([37c449b](https://github.com/CorentinGC/transmission-seedora/commit/37c449b8343f7bf37f3563842e3d6ecaa788fe1a))
* configure packaging for macOS (DMG/ZIP), Windows (Squirrel), Linux (deb/rpm) ([d8a5099](https://github.com/CorentinGC/transmission-seedora/commit/d8a509957f46520617f2788cc7ddf3e63df83b3f))
* extract reusable UI kit components and migrate dialogs ([8232bd9](https://github.com/CorentinGC/transmission-seedora/commit/8232bd932a45e5091881731493e6fff3cff0d0f7))
* fix alt speed toggle, speed limit presets popover ([1b69e1a](https://github.com/CorentinGC/transmission-seedora/commit/1b69e1aa7d00549afaae6591c446ec0cdf54bcff))
* implement HTTP and SOCKS5 proxy support in RPC client ([2f9e16e](https://github.com/CorentinGC/transmission-seedora/commit/2f9e16e98c211ab595b3a54ea0fa722bee5dd8c8))
* initial implementation of Transmission Remote (Phases 1-7) ([33b2933](https://github.com/CorentinGC/transmission-seedora/commit/33b29334f1b1a4a53bc15989290bdaaed429692a))
* resizable panels, edit tracker, hierarchical file tree ([fb4daf8](https://github.com/CorentinGC/transmission-seedora/commit/fb4daf89fab5e6697d26c10415f7d2b935fd2e20))
* server edit/delete/export, config backup/restore, speed presets prefs ([497da61](https://github.com/CorentinGC/transmission-seedora/commit/497da61d81427afcd92971127c5217527604fb44))
* softer toolbar button colors, two-button remove dialog ([d3d0d94](https://github.com/CorentinGC/transmission-seedora/commit/d3d0d94858bf06bd6ae0525a804a6785307232cc))


### Bug Fixes

* add key conversion between Transmission RPC kebab-case and camelCase ([9e27fbe](https://github.com/CorentinGC/transmission-seedora/commit/9e27fbecada98b42ce2a186e499c26b25a3bdb17))
* add missing OptionsTab fields and redesign FilesTab priority UX ([289e77c](https://github.com/CorentinGC/transmission-seedora/commit/289e77ca1c78cd34e9a57299eccd2f714cd1bcd0))
* correct invalid data in GeneralTab details panel ([4899e02](https://github.com/CorentinGC/transmission-seedora/commit/4899e02a789776581be1fa5d5bd6c3802535a5be))
* dark mode backgrounds, collapsible sidebar sections, MCP config ([8642a6e](https://github.com/CorentinGC/transmission-seedora/commit/8642a6ece354fec778ada3efe8018be854a058bb))
* fetch fresh trackerList from RPC before mutations ([6cf2968](https://github.com/CorentinGC/transmission-seedora/commit/6cf2968fede082ae2f58f49b1ba2cff57ea6c393))
* geoip-lite ASAR packaging, filter logic reset, gitignore update ([d0e3914](https://github.com/CorentinGC/transmission-seedora/commit/d0e39146ae81e67886f7ceb73fd5d9ba983e8874))
* lazy-load geoip-lite to prevent crash in packaged builds ([7d8202a](https://github.com/CorentinGC/transmission-seedora/commit/7d8202af94020f0d81cf6c9dfaad8bf81f66865a))
* prevent button text overflow in remove torrent dialog ([28636f9](https://github.com/CorentinGC/transmission-seedora/commit/28636f94480093002165e74f02e22072a85f2f43))
* prevent sidebar icons from disappearing when resized narrow ([de8a23e](https://github.com/CorentinGC/transmission-seedora/commit/de8a23e859c2fbf1763ba8e7e853dd911909d671))
* redesign TrackersTab layout and fix single tracker removal ([a2660eb](https://github.com/CorentinGC/transmission-seedora/commit/a2660eb42753c0df336d1f0f0c046363f1cad642))
* show 0 B/s instead of empty string for zero download speed ([8ca6a7f](https://github.com/CorentinGC/transmission-seedora/commit/8ca6a7f060f2b336476f866a55ef32de1e16a168))
* watch folder, settings feedback, search UX and default sort ([e4e6561](https://github.com/CorentinGC/transmission-seedora/commit/e4e65618498f86bd392e6adea346c7694f4ffd80))
* wire all app preferences to work correctly ([beef13c](https://github.com/CorentinGC/transmission-seedora/commit/beef13c82bb2d342ed02cba8b954040f6e6537e7))
