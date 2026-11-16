import { describe, expect, it } from 'vitest';
import { fitColumnWidth, moveColumnOrder } from './column-utils';

describe('moveColumnOrder', () => {
  const order = ['name', 'hidden', 'size', 'ratio'];
  const visible = ['name', 'size', 'ratio'];

  it('moves right past the next visible column, keeping hidden ones in place', () => {
    expect(moveColumnOrder(order, visible, 'name', 1)).toEqual(['hidden', 'size', 'name', 'ratio']);
  });
  it('moves left before the previous visible column', () => {
    expect(moveColumnOrder(order, visible, 'ratio', -1)).toEqual(['name', 'hidden', 'ratio', 'size']);
  });
  it('returns the order untouched at the edges or for an unknown column', () => {
    expect(moveColumnOrder(order, visible, 'name', -1)).toBe(order);
    expect(moveColumnOrder(order, visible, 'ratio', 1)).toBe(order);
    expect(moveColumnOrder(order, visible, 'nope', 1)).toBe(order);
  });
});

describe('fitColumnWidth', () => {
  it('adds a 2px buffer and respects the minimum', () => {
    expect(fitColumnWidth(100, 40)).toBe(102);
    expect(fitColumnWidth(10, 40)).toBe(40);
  });
});
