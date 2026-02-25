import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export function OAuthCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Authenticating...");

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Authorization failed: ${error}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Missing code parameter");
        return;
      }

      // state is optional - some providers like OpenRouter don't return it
      // If missing, we'll use the source ID from the path (e.g., /oauth/callback/my_openrouter_keys)
      const pathParts = window.location.pathname.split("/");
      const sourceIdFromPath = pathParts.length > 3 ? pathParts[3] : undefined;
      const sourceId = state || sourceIdFromPath;

      if (!sourceId) {
        setStatus("error");
        setMessage("Missing source ID. Cannot complete authorization.");
        return;
      }

      try {
        // Determine redirect_uri (current URL without query)
        const redirectUri = window.location.origin + window.location.pathname;

        await api.interact(sourceId, {
          type: "oauth_code_exchange",
          code,
          redirect_uri: redirectUri,
        });

        setStatus("success");
        setMessage("Authorization successful! You can close this window.");

        // Notify parent window via BroadcastChannel
        const channel = new BroadcastChannel("oauth_channel");
        channel.postMessage({ type: "success", sourceId });
        channel.close();

        // Also try window.opener for legacy popup support
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-success", sourceId }, "*");
        }

        // Auto close after 2 seconds
        setTimeout(() => {
          window.close();
        }, 2000);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Failed to exchange token");
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "loading" && (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
            {status === "success" && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
            {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
            OAuth Authorization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{message}</p>
          {status !== "loading" && (
            <Button
              className="w-full"
              onClick={() => window.close()}
              variant={status === "error" ? "destructive" : "default"}
            >
              Close Window
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
