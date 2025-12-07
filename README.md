# Antigravity Usage

**Precision Quota Intelligence for AntiGravity AI Models.**

[![Version](https://vsmarketplacebadge.apphb.com/version/zendevve.antigravity-usage.svg)](https://marketplace.visualstudio.com/items?itemName=zendevve.antigravity-usage)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/zendevve.antigravity-usage.svg)](https://marketplace.visualstudio.com/items?itemName=zendevve.antigravity-usage)

---

> **"Stop Guessing and Praying."**

Antigravity Usage transforms your VS Code status bar into a high-precision instrument for monitoring your AI model quotas. It moves beyond simple counters to provide predictive analytics, burn rate tracking, and health foresight, ensuring you never hit a hard stop in the middle of a critical flow.

## 🚀 Why This Exists

If you use AntiGravity for serious development—whether it's a capstone project or enterprise software—you know the pain of hitting a hidden limit. The default experience is opaque: you code until you can't.

**Antigravity Usage** solves this by intercepting the local AntiGravity metrics and projecting them onto a time-series model. We don't just tell you what you have left; we tell you *how long it will last* at your current pace.

## ✨ Features

### 📊 Real-Time Telemetry
*   **Status Bar Integration**: A quiet, always-visible indicator of your overall quota health.
    *   `$(check)` **Healthy**: > 20% remaining.
    *   `$(warning)` **Risk**: < 20% remaining.
    *   `$(error)` **Critical**: Exhausted.
*   **Active Model Detection**: Our heuristic engine analyzes usage deltas to intelligently identify *which* model you are currently driving (e.g., `Claude S3.5` vs `Gemini Pro`), so you know exactly which pool you are draining.

### 🔥 Predictive Analytics
*   **Burn Rate Analysis**: Using a sliding window of historical snapshots, we calculate your **Burn Rate (%/hour)**.
    *   **Slow**: < 2%/hour
    *   **Moderate**: 2-15%/hour
    *   **Fast**: > 15%/hour
*   **Exhaustion Prediction**: Based on your live burn rate, we project an **Estimated Time to Enpty (ETE)**.
    *   *Example: "~2h 15m remaining"*
*   **Session Stats**: Track your specific impact during the current coding session.

### 💻 Mission Control Dashboard
Click the status bar to open the **Antigravity Dashboard**.
*   **Brutalist Design**: High-contrast, data-dense visualization.
*   **Model Breakdown**: Individual cards for every available model (Gemini, Claude, GPT, etc.) with their specific reset timers and health bars.
*   **Prompt Credits**: Track your monthly prompt allowance alongside your model quotas.

## 🛠️ Technical Implementation

For the curious developers:
This extension operates by probing the local AntiGravity server (usually on port `42424` or similar ephemeral ports). It performs a non-invasive handshake to retrieve the `GetUserStatus` JSON payload.

*   **Metric smoothing**: Raw polling data is smoothed over a rolling window (`MAX_HISTORY = 20`) to prevent jitter in the burn rate calculation.
*   **Heuristic Active Detection**: Since the API doesn't explicitly state "active model", we use a derivative-based approach: the model with the highest first-derivative (rate of change) over the last `t` minutes is flagged as `Active`.

## 📦 Installation

### Marketplace
1.  Open **Antigravity**.
2.  Go to the **Extensions** view (`Ctrl+Shift+X`).
3.  Search for **"Antigravity Usage"**.
4.  Click **Install**.

### From VSIX / Source
1.  Clone this repository.
2.  Run `npm install` and `npm run compile`.
3.  Press `F5` to launch a Debug Extension Host.

## 🔧 Commands

| Command | Description |
| :--- | :--- |
| `Antigravity: Open Dashboard` | Opens the full full-screen webview dashboard. |
| `Antigravity: Quick Status` | Shows a dropdown menu with a quick summary of all models. |
| `Antigravity: Refresh Quota` | Forces an immediate poll of the AntiGravity server. |
| `Antigravity: Re-detect Port` | Restarts the port scanning algorithm if connection is lost. |

## 🤝 Contributing

We welcome contributions! Please see [AGENTS.md](AGENTS.md) for our specific MCAF (Modular Coding Agent Framework) compliance rules before submitting a PR.

## 👨‍💻 Creator

Built by **Zendevve** to solve the "Quota Anxiety" problem once and for all.

---
*MIT License | Copyright © 2025 Zendevve*
