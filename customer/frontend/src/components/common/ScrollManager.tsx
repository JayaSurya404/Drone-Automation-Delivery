import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Intelligent Scroll Manager:
 * 1. Scrolls to top on normal navigation to all new pages.
 * 2. Remembers and restores the exact scroll position when returning to the Home page ('/').
 */
export const ScrollManager: React.FC = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType(); // 'POP' (back/forward), 'PUSH' (new link), 'REPLACE'
  const scrollPositions = useRef<Record<string, number>>({});
  const lastPathname = useRef<string>(pathname);

  // Continuously record scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current[pathname] = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  // Handle route transitions
  useEffect(() => {
    const previousPath = lastPathname.current;
    lastPathname.current = pathname;

    if (pathname === '/') {
      // Returning to Home page -> restore saved scroll position if any
      const savedPosition = scrollPositions.current['/'] ?? 0;
      // Delay slightly for any asynchronous dynamic content render
      requestAnimationFrame(() => {
        window.scrollTo({
          top: savedPosition,
          left: 0,
          behavior: 'instant' as ScrollBehavior,
        });
      });
    } else {
      // Navigating to any other page -> scroll cleanly to the top of the page
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [pathname, navigationType]);

  return null;
};
