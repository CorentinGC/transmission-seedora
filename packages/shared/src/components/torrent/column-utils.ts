/** Column helpers for the torrent table: order changes and auto-size measurement. */

/**
 * New column order after moving `colId` one visible column left (-1) or right (1). Hidden columns
 * keep their place. Returns the same order when there is no visible neighbour in that direction.
 */
export function moveColumnOrder(order: string[], visibleIds: string[], colId: string, direction: 1 | -1): string[] {
  const target = visibleIds[visibleIds.indexOf(colId) + direction];
  if (!target || !order.includes(colId)) return order;
  const next = [...order];
  next.splice(next.indexOf(colId), 1);
  next.splice(next.indexOf(target) + (direction > 0 ? 1 : 0), 0, colId);
  return next;
}

/** Width that fits `contentWidth` plus a 2px buffer against sub-pixel rounding, never below `minSize`. */
export function fitColumnWidth(contentWidth: number, minSize: number): number {
  return Math.max(contentWidth + 2, minSize);
}

/**
 * Natural width of the widest of `sources` (a header and body cells), measured off-screen. The
 * content is cloned node by node, never re-parsed from a string.
 */
export function measureContentWidth(sources: HTMLElement[]): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;white-space:nowrap;visibility:hidden;width:auto;';
  document.body.appendChild(probe);
  let max = 0;
  for (const source of sources) {
    probe.className = source.className;
    probe.replaceChildren(...Array.from(source.childNodes, (node) => node.cloneNode(true)));
    max = Math.max(max, probe.offsetWidth);
  }
  probe.remove();
  return max;
}
