use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri::Emitter;

#[tauri::command]
pub async fn push_scraper_task(
    app: AppHandle,
    source_id: String,
    url: String,
    inject_script: String,
    intercept_api: String,
    secret_key: String,
) -> Result<(), String> {
    let final_script = format!(
        r#"
        (function() {{
            // Resource blocker
            const blockExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf'];
            
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {{
                const reqUrl = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
                
                // Block static resources
                if (blockExtensions.some(ext => reqUrl.toLowerCase().includes(ext))) {{
                    return new Response('', {{ status: 200, statusText: 'Blocked' }});
                }}
                
                // Intercept Target API
                if (reqUrl.includes('{}')) {{
                    const response = await originalFetch.apply(this, args);
                    if (response.status === 401 || response.status === 403) {{
                        window.__TAURI_INTERNALS__.invoke('handle_scraper_auth', {{ sourceId: '{}', targetUrl: reqUrl }});
                    }} else {{
                        const cloneRes = response.clone();
                        cloneRes.json().then(data => {{
                            window.__TAURI_INTERNALS__.invoke('handle_scraped_data', {{ 
                                sourceId: '{}', 
                                secretKey: '{}',
                                data: data 
                            }});
                        }}).catch(e => console.error('Failed to capture JSON:', e));
                    }}
                    return response;
                }}
                
                return originalFetch.apply(this, args);
            }};
            
            // XHR overrides (Optional, if target uses XHR instead of Fetch)
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, xUrl, ...rest) {{
                this._url = xUrl;
                return originalXhrOpen.call(this, method, xUrl, ...rest);
            }};
            
            const originalXhrSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(body) {{
                this.addEventListener('load', function() {{
                    if (this._url && this._url.includes('{}')) {{
                         if (this.status === 401 || this.status === 403) {{
                             window.__TAURI_INTERNALS__.invoke('handle_scraper_auth', {{ sourceId: '{}', targetUrl: this._url }});
                         }} else {{
                             try {{
                                 const data = JSON.parse(this.responseText);
                                 window.__TAURI_INTERNALS__.invoke('handle_scraped_data', {{ 
                                     sourceId: '{}', 
                                     secretKey: '{}',
                                     data: data 
                                 }});
                             }} catch(e) {{}}
                         }}
                    }}
                }});
                return originalXhrSend.call(this, body);
            }};

            // DOM Blocker for Images
            const observer = new MutationObserver(mutations => {{
                for (const mutation of mutations) {{
                    for (const node of mutation.addedNodes) {{
                        if (node.tagName === 'IMG') {{
                            node.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // 1x1 transparent
                        }} else if (node.querySelectorAll) {{
                            const imgs = node.querySelectorAll('img');
                            imgs.forEach(img => img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=');
                        }}
                    }}
                }}
            }});
            
            // Start observing as soon as possible
            if (document.documentElement) {{
                observer.observe(document.documentElement, {{ childList: true, subtree: true }});
            }} else {{
                document.addEventListener('DOMContentLoaded', () => {{
                    observer.observe(document.documentElement, {{ childList: true, subtree: true }});
                }});
            }}
            
            // User Injected Script
            try {{
                {}
            }} catch(e) {{ console.error('Inject script error:', e); }}
        }})();
        "#,
        intercept_api, source_id, source_id, secret_key, 
        intercept_api, source_id, source_id, secret_key,
        inject_script
    );

    // If a scraper window already exists, close it to avoid state pollution and cleanly re-inject
    if let Some(win) = app.get_webview_window("scraper_worker") {
        let _ = win.close();
    }

    let _webview = tauri::WebviewWindowBuilder::new(
        &app,
        "scraper_worker",
        tauri::WebviewUrl::External(url.parse().unwrap())
    )
    .title("Background Worker")
    .visible(false)
    .initialization_script(&final_script)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn handle_scraped_data(
    app: AppHandle,
    source_id: String,
    secret_key: String,
    data: serde_json::Value,
) -> Result<(), String> {
    app.emit("scraper_result", serde_json::json!({
        "sourceId": source_id,
        "secretKey": secret_key,
        "data": data
    })).map_err(|e| e.to_string())?;
    
    // Close the scraper window since task is done
    if let Some(win) = app.get_webview_window("scraper_worker") {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn handle_scraper_auth(
    app: AppHandle,
    source_id: String,
    target_url: String,
) -> Result<(), String> {
    app.emit("scraper_auth_required", serde_json::json!({
        "sourceId": source_id,
        "targetUrl": target_url
    })).map_err(|e| e.to_string())?;
    
    // Show the window to allow user to log in
    if let Some(win) = app.get_webview_window("scraper_worker") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}
