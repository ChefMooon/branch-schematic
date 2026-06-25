## 1. Canvas Card UI & Commit Management (The "Branch" Nodes)
Each card represents a distinct Git branch, acting as a window into its commit timeline.

### 1.1 Card Structural Layout
- **Predictable Boundaries:** Cards maintain a stable, uniform structural width. Instead of expanding infinitely across the canvas space, long commit histories are handled via an **internal virtualized scroll viewport** within the card container.
- **Commit Density Control:** Each card features an independent layout configuration menu allowing users to toggle the number of visible commits in the stream (Options: `3`, `5`, `10`, `15`, or `All` with internal scrolling).
- **View Modes:** * **Compact Mode:** Displays a minimal, high-density overview of the branch head and minimal metadata.
    - **Expanded Mode:** Opens the full layout revealing the internal commit stream timeline.
- **Visual Color Coding:** Users can assign a custom theme color to individual cards. This color dynamically styles the card header, accent lines, and its connection edges.
### 1.2 Zoom-Driven Level of Detail (LoD)
To optimize rendering performance on large maps, the canvas dynamically manages visual complexity based on the zoom percentage:
- **Bird's-Eye (10% – 49%):** Discards all individual commit text, author names, hashes, and detailed shapes. Displays only the Card Title, Sync Status badge, and its assigned custom color.
- **Mid-Range (50% – 99%):** Renders commit streams as simplified, abstract graphical nodes (dots/lines) without text strings.
- **Close-Up (100% – 200%):** Renders complete card details, including full text, timestamps, author metadata, hashes, and signing states.
### 1.3 Branch Sync State Indicators
Each card features a prominent, split "Sync Pill Badge" summarizing its relationship to its upstream tracking remote (e.g., `origin/main`):
- **State Metrics:** Explicitly tracks directional deltas: Ahead (`⇡ X`) and Behind (`⇣ Y`).
- **Visual Alerts:** * If **Ahead > 0**: Applies a distinct visual priority tint signaling unpushed local commits.
    - If **Behind > 0**: Applies a distinct warning tint signaling remote updates are available.
    - If both are **0**: Displays a clean "In Sync" state.
## 2. Relational Pipelines (The "Branches")
Connections map the genealogical lineage of how branches sprouted from one another.
- **Conditional Edge Mapping:** Edge lines are only rendered between cards if an explicit parent-child branching relationship exists.
- **Dynamic Connection Anchor Routing:**
    - **Expanded-to-Expanded Routing:** The connection line precisely targets the _exact originating commit node_ inside the parent branch card and maps it directly to the _root commit node_ of the child branch card.
    - **Compact Fallback Routing:** If either card is in Compact Mode (or if the originating commit is scrolled out of the active internal viewport), the connection edge automatically reroutes to bridge the structural bounding boxes of the parent and child cards directly.
## 3. Canvas "Views" Management
"Views" allow users to isolate, arrange, and save specific environments within the same workspace canvas.
- **Decoupled Spatial Data:** Layout data ($X,Y$ coordinates) is completely isolated from the core Git branch entities. A single branch can exist across multiple views simultaneously with completely independent positions, scaling, and visibility toggles.
- **Saved Environment States:** Each unique canvas view persists:
    - The collection of specific projects and branches explicitly added to that workspace.
    - The exact canvas zoom coefficient and panning center coordinates.
    - Individual card UI parameters (Active Theme Colors, View Modes, and Commit Density configurations).