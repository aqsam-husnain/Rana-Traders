/**
 * Input sanitizer helpers for number fields.
 * - Blocks characters like -, +, =, e, E from being typed
 * - Prevents mouse wheel from changing values
 */

/** Block invalid characters on number inputs (attach to onKeyDown) */
export const blockInvalidChars = (e) => {
  if (['-', '+', '=', 'e', 'E'].includes(e.key)) {
    e.preventDefault();
  }
};

/** Prevent scroll wheel from changing number input value (attach to onWheel).
 *
 * Strategy: temporarily set the input as `readonly` while the user is scrolling.
 * Chrome/Electron will NOT change a readonly input's value on wheel scroll,
 * but the wheel event still propagates normally so the modal/page scrolls.
 * No blur() → no focus-jumps. No preventDefault() → no scroll blocking.
 *
 * Uses a WeakMap so each input gets its own independent 200 ms debounce timer.
 * (A shared timer had a bug: scrolling input A then input B would cancel A's
 *  cleanup, leaving A permanently readonly.)
 */
const _scrollTimers = new WeakMap();
export const preventScrollChange = (e) => {
  const input = e.target;
  input.setAttribute('readonly', '');
  clearTimeout(_scrollTimers.get(input));
  _scrollTimers.set(input, setTimeout(() => {
    input.removeAttribute('readonly');
    _scrollTimers.delete(input);
  }, 200));
};

/**
 * Spread these props onto any <input type="number"> to sanitize it.
 * Usage: <input type="number" {...amountInputProps} />
 * Combine with your own onChange, onKeyDown, etc. by calling both handlers.
 */
export const amountInputProps = {
  onKeyDown: blockInvalidChars,
  onWheel: preventScrollChange,
};
