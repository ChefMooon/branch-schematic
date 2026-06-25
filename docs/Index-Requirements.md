# Functional Requirements: Dashboard Landing Page (`/`)

## 1. Overview & Objective

The Dashboard (`index.tsx`) serves as the central control deck for **Branch Schematic**. It transitions the application from a baseline setup template to an actionable desktop Git workspace layout. The layout balances structural scannability with responsive components that let a user monitor and interact with their tracked repositories without leaving the primary entry view.

## 2. Core Functional Requirements

### 2.1 Top Command & Filter Bar

* **Repository Onboarding:** Prominent quick-action interactions allowing users to explicitly onboarding a directory:
* **Add Local Repository:** Prompts an native OS directory picker using Tauri's dialog API.
* **Clone Remote Repository:** Displays a modal requesting a remote Git URL and a local target destination.


* **Global Ecosystem Filter:** A responsive layout text field acting as an immediate live search against the full repository set. Toggling options must let users isolate repositories based on classification types (`Local-Only`, `Created`, `Forked`).
* **Sort Controls:** Dropdown selection enabling workspace sorting by **Last Viewed**, **Alphabetical**, or **Most Uncommitted Changes**.

### 2.2 History Layer: "Recent Repositories"

* Display a strict horizontal layout showing up to **the last 3 distinct viewed/accessed repositories**.
* Access metadata is read from database interaction tracking timestamps, minimizing startup searching friction.
* Each item acts as a high-speed routing link to swap the active canvas workspace straight to that specific project framework.

### 2.3 Repository Core Grid Ecosystem

* **Grid Topology:** A responsive grid that scales based on runtime window size:
* Small Viewports: 1 column width.
* Medium Viewports: 2 columns across.
* Large Viewports: A **maximum layout limit of 3 columns across**.


* **Classification Designators:** Each repository card must display structured visual variations or clear badging indicating project provenance:
* `Local-only`: Repository lacks configured upstream configurations (e.g., uses a desktop icon).
* `Created / Owner`: Origin matches user profile contexts, or is an explicit tracking target.
* `Forked`: Configured tracking points to explicit cross-reference origins.



### 2.4 Action State Systems (Inline Control Blocks)

* **Direct Branch Selector:** Each card features a clean, embedded dropdown showing the active `HEAD` branch. Changing selection invokes a command down to the Tauri backend wrapper executing a deterministic `git checkout`.
* **Synchronized Git Operations:** Clean interactive target nodes present for structural tasks: **Fetch**, **Pull**, and **Push**.

### 2.5 Operation Progress Lifecycle (Visual State Indicators)

To guarantee the desktop user interface remains predictive and readable when standard background Git operations execute asynchronously:

* **Asynchronous Spinners:** Clicking **Fetch**, **Pull**, or **Push** immediately forces that specific button or structural icon cluster into a disabled loading state featuring a visible indeterminate spinning animation.
* **Context Protection:** While an operational lifecycle runs on a specific repository, mutations affecting that exact target node are contextually frozen to prevent concurrent runtime anomalies.
* **Completion Feedback:** Upon receiving successful exit codes from Tauri's background command invocations, the spinner context naturally drops to reveal updated state changes (such as modifications to ahead/behind counters). If an operation fails, an inline message context or brief alert error style must pop to notify the user.