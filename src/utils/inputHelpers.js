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
 * After 200 ms of inactivity the readonly flag is removed so typing works again.
 */
let _scrollLockTimer = null;
export const preventScrollChange = (e) => {
  const input = e.target;
  input.setAttribute('readonly', '');
  clearTimeout(_scrollLockTimer);
  _scrollLockTimer = setTimeout(() => {
    input.removeAttribute('readonly');
  }, 200);
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
