import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Use createRoot instead of hydrateRoot — kills hydration mismatch errors.
// SSR still runs loaders/actions, we just don't try to match server markup.
createRoot(document).render(
  <StrictMode>
    <HydratedRouter />
  </StrictMode>
);
