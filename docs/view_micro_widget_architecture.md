# Quota Board View & Micro-Widget Architecture Specs

## Core Principles

The view layer of this project evolves towards a "low-code / configuration-driven" approach, and must strictly adhere to the following four core principles:

1. **Purely Display-Oriented**
   * **Scope Constraint:** All Micro-Widgets are **stateless information renderers**. Their sole mission is to map extracted JSON data into visual elements.
   * **Interaction Boundaries:** Lightweight interactions within the presentation layer are allowed (e.g., clicking to switch time dimensions on a trend chart, hovering to show tooltips, switching between line/bar chart styles).
   * **State Isolation:** Complex backend API states are completely stripped away. **API connectivity, loading states, and authentication anomalies (like invalid OAuth) must never be exposed as customizable properties.** The bottom-layer state must be globally managed and rendered by the "Base Source Card" shell, remaining completely transparent to the micro-widget layer.

2. **Single Responsibility & Clear Boundaries**
   * Each micro-widget must do one thing and do it well. "All-in-one" or "God" component designs are strictly forbidden.
   * For example: "Key-value text", "Quota ring chart", and "Mini trendline" are three unrelated micro-widgets; they should not be mixed. Complex and rich cards should be assembled by **mounting multiple single-purpose micro-widgets in parallel** using the same source data.
   * **Spacing/Margin Isolation:** Components must not contain external spacing/margins (e.g., no outermost `margin-top` or `mt-2`). All spacing must be handled by parent layout containers (like lists or card contents) using `gap` or `space-y` to ensure predictable alignment and reusability.

3. **Evolution Over Creation & Strict Extension Review**
   * **Reuse is King:** When facing new business display requirements, the first duty of an engineer is to review the existing component library. Prioritize evaluating whether the problem can be solved by modifying existing data, reusing existing components, or elegantly extending property parameters with backward compatibility (e.g., adding a `show_delta` toggle).
   * **Mandatory Review Flow:** Whenever there is a topological change to component design—such as **1) Adding a completely new Widget type**, or **2) Making destructive/structural Schema changes to an existing Widget**—developers must not decide in isolation. **Every topological change must be reported to the product/tech lead for review and decision**, to prevent the component library from bloating chaotically.

4. **Framework & UI Library Agnostic**
   * Component design, field extraction logic, and Schema structure **must be decoupled from the underlying frontend implementation.**
   * This design document describes "logical components and data mapping specifications", and does not care whether the frontend team uses React, Vue, or Svelte, nor whether the underlying charts are implemented using Echarts or Recharts.

---

## Architecture Model: Standard Blackbox Base + Dynamic Micro-Slots

The entire view layer is abstracted into a two-dimensional system: **`Base Source Card` + `Widgets Slots`**. 
We utilize a seamless, waterfall-like layout. The exact placement and footprint of widgets flow dynamically based on the available structural space, rather than relying on hardcoded, fixed-pixel dimensioning. Components respond automatically to parent grid configurations.

### 1. Base Source Card (Shell Specification, Non-customizable)
Every mounted cloud platform service, regardless of the unique data it returns, must be wrapped in this standard shell.
* **Fixed Elements:** Card Title (Platform Name), Logo/Icon, Data Refresh Timestamp.
* **Passive Interception (System-level):** When the integrated API reports an error, goes offline, or is network-blocked, all internal micro-widget rendering is immediately suspended. A unified "System State Shield" (e.g., Error State, Require OAuth State) for the entire project is forcibly rendered by the shell.
* **Data Sharing Domain:** The dataset fetched, parsed, and purified by this source is automatically injected into all of its internal slots.

### 2. Micro-Widgets Slots (Customization Configuration Layer)
Only when the shell detects that its own status is `Healthy`, will it load the `Widgets` array defined by YAML and sequentially assemble the different visual building blocks.

---

## Micro-Widgets Library Reference

All future display elements must be found or carefully extended within the following categories:

### Category A: Numeric & Cost Analytics
*Primarily used to highlight cash flow or the most critical single quantitative metrics.*
* **`hero_metric` (Core Highlighted Value)**
  * **Role:** Highlights a single core metric in a large font.
  * **Core Config:** `amount` (template string), `prefix`/`currency` (e.g., USD), `delta` (change amount, automatically handles red/green trend arrows).
* **`trend_sparkline` (Minimalist Trend Background Line)**
  * **Role:** A pure trend helper line without any XY axes, typically used to illustrate stability or sudden spikes.
  * **Core Config:** `history_array` (must accept a 1D numeric array). Allows users to visually toggle between line and vertical bar charts.

### Category B: Quota & Consumption Limits
*Primarily used to reflect the trade-off game between restriction conditions and consumption progress.*
* **`quota_bar` (Linear Progress Bar)**
  * **Role:** Stretches horizontally, suitable for quota comparisons with long text descriptions.
  * **Core Config:** `usage`, `limit`, `color_thresholds` (color-changing logic for high-risk warnings).
* **`gauge_ring` (Circular Dial/Ring)**
  * **Role:** Expresses percentages in compact vertical spaces.
  * **Core Config:** Same as above, plus `size` preferences (thin ring / thick solid ring UI settings).

### Category C: Details & Structural Helpers
*Used to handle irregular sporadic data and scattered information.*
* **`key_value_grid` (Attribute Field Grid)**
  * **Role:** Flattens and displays information that doesn't "qualify" for a standalone chart but must be shown.
  * **Core Config:** `items` mapping dictionary (String Label -> Template Value String), supporting adaptive squishing of up to 2~3 columns.
* **`divider` (Visual Isolation Band)**
  * **Role:** Extremely lightweight pure visual dashed divider, used to segment layouts when card height is large.

*(Note: Based on Principle 1, the previously envisioned API health status dot widget is deprecated and removed; this responsibility is absorbed by the underlying shell.)*

---

## YAML Configuration Example & Developer Implementation Protocol

All developers implementing the frontend parser must use the following structure as a blueprint for integration and data decomposition:

```yaml
# The simplest protocol structure output for external use at the design level
source_id: openai_prod_env_1
# (Non-display fields like 'api_status' will definitely not appear in the config below)
widgets:
  # Assembly 1: Cost Overview
  - type: hero_metric
    amount: "{data.financial.current_cost}"
    currency: "USD"

  # Assembly 2: Quota Occupancy Comparison
  - type: quota_bar
    title: "{data.account.name} Limit (TPM)"
    usage: "{data.limits.tpm_used}"
    limit: "{data.limits.tpm_max}"
    color_thresholds:  # Explicitly stripped of business code calculations, provided entirely by display config
      warning_percent: 80
      critical_percent: 95

  # Assembly 3: Auxiliary Attributes
  - type: key_value_grid
    items:
      "Plan Tier": "{data.account.plan_type}"
      "Billing Cycle Ends": "{data.account.billing_end}"
```

## Template String Syntax

The view layer utilizes an evaluation protocol whereby any dynamic property strings enclosed in curly braces (e.g., `"{path}"` or `"Item: {path}"`) are evaluated at render time based on the active dataset context. The source layout definition acts as a pure structural map, entirely oblivious to the logic running behind the variables.

## Developer Code of Conduct

If you are a developer participating in the implementation of the view architecture, you must strictly perform the following self-reviews:

1. **Graceful Fallback Mechanism:** Configuration documents are not always perfect. If the YAML tells the micro-widget to read `data.limits.tpm_used`, but the actual API returns an empty value or `null`, **the component must degrade gracefully (e.g., displaying "--" or automatically folding away).** It is absolutely forbidden to trigger a frontend `TypeError` that causes the entire card to white screen!
2. **Pure Functional Extraction:** Micro-widget internals **strictly forbid housing any asynchronous (async/await) data-fetching code** or data-calculation interception logic. It should act like a static `dump` pure function: render exactly the values it is given.
