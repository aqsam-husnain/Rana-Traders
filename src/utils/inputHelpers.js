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

/** Prevent scroll wheel from changing number input value (attach to onWheel) */
export const preventScrollChange = (e) => {
  e.target.blur();
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
