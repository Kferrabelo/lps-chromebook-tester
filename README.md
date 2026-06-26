# LPS Chromebook Tester v10

Static browser-based Chromebook testing dashboard.

Changes in v9:
- Renamed the site to LPS Chromebook Tester.
- Expanded the keyboard rendering so it fills the keyboard card instead of sitting small inside it.
- Removed installed memory reporting because normal websites cannot reliably read total installed RAM.
- Added browser-exposed local storage quota and remaining available quota through the StorageManager API when supported.
- Network status remains simplified to Online/Offline with a colored dot.

Open index.html from a web server, HTTPS host, or localhost for best camera and microphone behavior.


Version 10 updates: longer speaker test tone and Memory Info restored using navigator.deviceMemory when the browser exposes it.


## Version 11 update

System & Browser Info is informational only and no longer counts toward the pass/fail totals.


## Speed Test

This version includes an embedded OpenSpeedTest widget for download, upload, ping, and jitter testing. The embedded widget uses OpenSpeedTest servers unless you modify the iframe URL or self-host OpenSpeedTest.


## v13 Update

Embedded the OpenSpeedTest widget using the provided OST iframe code.


## v15 update

- Moved System & Browser Info next to the Speed Test card on wide screens.
- System info remains informational only and does not affect Pass/Fail totals.
