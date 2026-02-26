# Quota Board View Template Configuration Guide

This document describes how to configure the visual presentation (Views) of your integrations in Quota Board. The UI configuration enables you to compose data fetched from sources into rich, organized, and interactive dashboard cards.

## Overview

The view configuration is contained within the `templates` array of an integration's YAML file. Each template defines a specific presentation format, primarily as a `source_card` containing various `widgets`.

```yaml
templates:
  - label: "My Custom Panel"
    type: "source_card"
    ui:
      title: "Display Title"
      icon: "📊"
    widgets:
      # ... widget configurations ...
```

## Template Syntax

All fields within widget configurations that need to display dynamic data must use the template syntax. This allows for both direct data binding and string interpolation.

*   **Syntax:** Enclose the data path in curly braces `{}`. Provide the path matching the output of your integration's extraction steps.
*   **Direct Value:** If a field is exactly `"{path.to.value}"`, it will be replaced by the typed value (e.g., number, boolean) from the data.
*   **Interpolation:** If a field is a string containing templates like `"Usage: {path.to.value} units"`, it will be evaluated into a final string.
*   **Static Text:** If no braces are present, the field is treated as a static string.

### Examples

*   `amount: "{credits_data.remaining}"` (Evaluates to the numeric value of remaining credits)
*   `title: "Model: {key_item.model_name}"` (Evaluates to a string with the model name injected)

## Layout & Grids

Widgets within a card or a list are arranged using predefined layouts. This is particularly useful for maximizing space and creating structured displays.

> [!NOTE]
> **Dashboard grid:** View items (cards) support `x`, `y`, `w`, `h` for grid position and size; the dashboard can use a grid layout (e.g. drag-and-drop).  
> **Widget height:** Widgets can optionally set `row_span` (a proportional row-height weight) to share vertical space with siblings. When `row_span` is not set, widget height is content-driven. For components that could grow indefinitely (e.g. lists), use `pagination` or `limit` to control height.

### List Widget Layouts

When rendering arrays of data using a `list` widget, you can define how items are arranged using the `layout` property:

1.  **Row / Column (`layout: "row"` or `layout: "col"`)**: Arranges items sequentially horizontally or vertically.
2.  **Grid Layout (`layout: "grid"`)**: Automatically arranges list items into a grid.
    *   By default, it uses a responsive grid (1 column on mobile, 2 on tablet, 3 on desktop) which perfectly handles dynamic quantities of elements.
    *   You can also specify an exact number of columns using the `columns` property (e.g., `columns: 4`), which overrides the responsive default.

### Internal Item Grid Config (`grid_template_areas`)

You can define internal custom layouts for components rendered *inside* a list item. This allows you to position multiple micro-widgets side-by-side or stacked precisely using CSS Grid areas.

```yaml
widgets:
  - type: "list"
    data_source: "keys_list"
    item_alias: "key_item"
    layout: "col"
    layout_config:
      grid_template_areas:
        - "key_value progress" # Row 1: key_value on left, progress on right
      grid_template_columns: "1fr 3fr" # Left column takes 1 fraction, right takes 3
    render:
      - type: "quota_bar"
        area: "progress" # Matches the area name above
        title: "Usage Limit"
        usage: "{key_item.usage}"
        limit: "{key_item.limit}"
      - type: "key_value_grid"
        area: "key_value" # Matches the area name above
        items:
          "Key Name": "{key_item.name}"
```

## List Rendering & Filtering

The `list` widget allows you to iterate over an array of data from your integration.

*   `data_source`: The data path to the array (e.g., `"keys_list"`).
*   `item_alias`: The variable name used to reference a single item within the loop (e.g., `"key_item"`).
*   `render`: A single widget or a list of widgets to render for *each* item in the array. Note how the `render` block uses `item_alias` (e.g., `{key_item.usage}`) in its templates.

### Filtering, Sorting & Pagination

You can dynamically manipulate the list before rendering without changing the raw data:

*   **`filter`**: A logical expression string to hide items that don't match. Example: `"key_item.usage > 0"` or `"key_item.status === 'active'"`.
*   **`sort_by`**: The data path to sort the array by. Example: `"key_item.usage"`.
*   **`sort_order`**: `"asc"` (ascending) or `"desc"` (descending).
*   **`limit`**: An integer to restrict the maximum number of items shown.

**Pagination Config:**
Instead of a hard `limit`, you can enable interactive pagination to handle large lists gracefully:
*   **`pagination`**: Set to `true` to render pagination controls (Previous/Next) at the bottom of the list.
*   **`page_size`**: The number of items to display per page (defaults to 5). Note: If `pagination` is enabled, `limit` will be ignored.

## Available Micro-Widgets

### `hero_metric`
Highlights a single, critical numeric metric.
*   `amount`: The primary value (template syntax).
*   `currency`: Appends currency formatting (e.g., `"USD"`).
*   `prefix`: Appends a prefix text.
*   `delta`: Shows a positive/negative change arrow and value (template syntax).

### `quota_bar`
A linear progress bar showing usage against a limit.
*   `title`: The title of the bar (template or static text).
*   `usage`: The current usage value (template syntax).
*   `limit`: The maximum limit value (template syntax). If limit is 0 or undefined, degrades gracefully.
*   `color_thresholds`: Optional map of `warning_percent` and `critical_percent` (e.g., `75` and `90`) to change the bar color.

### `key_value_grid`
A condensed grid for displaying properties. Automatically flows into 1-3 columns based on item count.
*   `items`: A dictionary mapping static labels (keys) to template values. Example: `"Plan Tier": "{account.plan_type}"`.

---

## Full Example

```yaml
templates:
  - label: "My Quota Overview"
    type: "source_card"
    ui:
      title: "Platform Usage"
      icon: "🚀"
    widgets:
      - type: "hero_metric"
        amount: "{account.balance}"
        currency: "USD"
      
      # A list of active keys
      - type: "list"
        data_source: "api_keys"
        item_alias: "key"
        filter: "key.active == true"
        sort_by: "key.used"
        sort_order: "desc"
        limit: 5
        layout_config:
          grid_template_areas:
            - "stats progress"
          grid_template_columns: "1fr 2fr"
        render:
          - type: "quota_bar"
            area: "progress"
            usage: "{key.used}"
            limit: "{key.limit}"
          - type: "key_value_grid"
            area: "stats"
            items:
              "Name": "{key.name}"
              "ID": "{key.id}"
```
