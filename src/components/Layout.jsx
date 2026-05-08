import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  const pageContentRef = useRef(null);

  // Global focus recovery: when focus is lost to <body> (after modal close,
  // native confirm() dialogs, or portal unmount), restore it to page content.
  // This prevents the "keyboard stops working" bug.
  useEffect(() => {
    const handleFocusIn = () => {
      // If focus lands on body and no modal is open, recover it
      if (
        document.activeElement === document.body &&
        !document.querySelector('.modal-overlay') &&
        pageContentRef.current
      ) {
        // Use requestAnimationFrame to avoid interfering with ongoing focus operations
        requestAnimationFrame(() => {
          if (document.activeElement === document.body && pageContentRef.current) {
            pageContentRef.current.focus({ preventScroll: true });
          }
        });
      }
    };

    // Listen for focusout which fires when focus is about to be lost
    document.addEventListener('focusout', handleFocusIn);

    // Also handle clicks on the page content area that don't target a focusable element
    const handleClick = (e) => {
      const target = e.target;
      const isFocusable = target.matches(
        'input, select, textarea, button, a, [tabindex], [contenteditable]'
      );
      if (!isFocusable && pageContentRef.current) {
        // Ensure the page content is focusable so keyboard events work
        pageContentRef.current.focus({ preventScroll: true });
      }
    };

    const pageContent = pageContentRef.current;
    if (pageContent) {
      pageContent.addEventListener('click', handleClick);
    }

    return () => {
      document.removeEventListener('focusout', handleFocusIn);
      if (pageContent) {
        pageContent.removeEventListener('click', handleClick);
      }
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="page-content" ref={pageContentRef} tabIndex={-1} style={{ outline: 'none' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
