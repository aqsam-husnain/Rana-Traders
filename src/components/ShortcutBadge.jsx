import React from 'react';
import { useShortcuts, formatCombo } from '../context/ShortcutContext';

/**
 * Small inline badge showing the shortcut key for a given action.
 * Place next to buttons to hint at their keyboard shortcut.
 *
 * Usage: <ShortcutBadge actionId="page.new" />
 */
export default function ShortcutBadge({ actionId, style }) {
  const { getBinding } = useShortcuts();
  const combo = getBinding(actionId);
  if (!combo) return null;

  return (
    <kbd className="shortcut-badge" style={style} title={`Shortcut: ${formatCombo(combo)}`}>
      {formatCombo(combo)}
    </kbd>
  );
}
