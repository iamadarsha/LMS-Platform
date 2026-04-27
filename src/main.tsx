import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

if (!clerkPublishableKey) {
  // Surface this loudly so dev environments don't silently run unauthenticated.
  console.error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to .env to enable sign-in.",
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={clerkPublishableKey ?? ""}
    appearance={{
      variables: {
        colorPrimary: "hsl(var(--primary))",
        colorBackground: "hsl(var(--background))",
        colorText: "hsl(var(--foreground))",
        colorInputBackground: "hsl(var(--background))",
        colorInputText: "hsl(var(--foreground))",
        borderRadius: "0.75rem",
      },
    }}
  >
    <App />
  </ClerkProvider>,
);
