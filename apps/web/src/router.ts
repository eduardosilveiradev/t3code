import { createRouter, RouterHistory } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter(history: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: {},
    defaultPreload: "intent",
    // Desktop page changes animate as a view transition (styles under t3-page in index.css).
    // Not on mobile, which runs its own composer transition, not with reduced motion, and not
    // on a replace: a draft promoted to its thread, or a redirect, isn't a page the user opened.
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged || typeof window === "undefined") return false;
        // A page change while the last transition still runs would make the browser skip that one and
        // reject its promises, which nothing awaits. Let the running one finish; this change just swaps.
        if ((document as Document & { activeViewTransition?: unknown }).activeViewTransition)
          return false;
        if (window.matchMedia("(max-width: 639px), (prefers-reduced-motion: reduce)").matches)
          return false;
        if (fromLocation.state.__TSR_index === toLocation.state.__TSR_index) return false;
        return ["t3-page"];
      },
    },
  });
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
