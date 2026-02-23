# Reverse Engineering Integrations (cURL Auth)

The Dashboard application supports configuring advanced reverse-engineered data sources via the `use: curl` flow configuration.

By capturing an authentic request directly from your browser's Developer Tools (copying as cURL) and pasting it into the Dashboard, the backend extracts the headers (e.g., `Cookie`, `Authorization`, `x-access-token`) and seamlessly replays them to keep the session alive.

## ⚠️ Important Disclaimer & TOS Risks

> [!CAUTION]
> **Use at your own risk!** Integrating against unpublished, internal APIs using reverse engineering techniques (like intercepting request headers and cookies) may **violate the Terms of Service (TOS)** of the target platform.
>
> Many platforms strictly prohibit automated access or scraping of their private APIs. Engaging in this activity could result in restrictive measures, including **permanent account bans**.
>
> We strongly advise users to only execute these kinds of requests against platforms where they either have explicit permission or have fully comprehended the risks associated with TOS violations.
> 
> A warning is explicitly displayed on the connection dialog when adding a source that relies on this technique.
