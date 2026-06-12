import { useEffect } from 'react';

const FAVICON_HREF = '/favicon.svg?v=3';

/**
 * Forces the tab icon to use favicon.svg.
 * Browsers cache favicons aggressively; replacing the link on load bypasses stale cache.
 */
export function useFavicon() {
  useEffect(() => {
    document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = FAVICON_HREF;
    document.head.appendChild(link);
  }, []);
}
