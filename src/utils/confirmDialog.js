/**
 * A wrapper around window.confirm() that restores focus to the app
 * after the native dialog closes. In Electron, the native confirm()
 * dialog steals both OS-level window focus and DOM focus from the
 * renderer process. When it closes, focus may not return — causing
 * inputs to appear frozen/stuck. This utility fixes that by:
 * 1. Calling window.focus() to regain OS-level window focus
 * 2. Focusing the page content area for DOM-level focus
 * 3. Retrying after a delay in case the first attempt is too early
 */
export function confirmAction(message) {
  const result = window.confirm(message);

  // Immediately try to regain window-level focus
  window.focus();

  // Restore DOM focus after a short delay
  const restoreFocus = () => {
    window.focus();
    const pageContent = document.querySelector('.page-content');
    if (pageContent) {
      pageContent.focus({ preventScroll: true });
    }
    // Also try clicking the document to force Chromium to recognize the window as active
    document.documentElement.focus();
  };

  // Try multiple times — the first attempt may fire before the OS hands back focus
  setTimeout(restoreFocus, 10);
  setTimeout(restoreFocus, 100);

  return result;
}
