import { describe, expect, it, vi } from 'vitest';
import { LaunchQueue } from './launch-queue';
import type { LaunchTarget } from './launch-targets';

const magnet = (n: number): LaunchTarget => ({ kind: 'magnet', uri: `magnet:?xt=urn:btih:${n}` });

describe('LaunchQueue', () => {
  it('holds targets until the renderer pulls, then pushes', () => {
    const push = vi.fn(() => true);
    const queue = new LaunchQueue(push);
    queue.enqueue(magnet(1));
    expect(push).not.toHaveBeenCalled();
    expect(queue.take()).toEqual([magnet(1)]);
    expect(queue.take()).toEqual([]);
    queue.enqueue(magnet(2));
    expect(push).toHaveBeenCalledWith(magnet(2));
  });

  it('queues again after reset until the next pull', () => {
    const push = vi.fn(() => true);
    const queue = new LaunchQueue(push);
    queue.take();
    queue.reset();
    queue.enqueue(magnet(1));
    expect(push).not.toHaveBeenCalled();
    expect(queue.take()).toEqual([magnet(1)]);
  });

  it('keeps a target whose push could not be delivered', () => {
    const push = vi.fn(() => false);
    const queue = new LaunchQueue(push);
    queue.take();
    queue.enqueue(magnet(1));
    queue.enqueue(magnet(2));
    expect(push).toHaveBeenCalledTimes(1); // second one waits without trying a dead window
    expect(queue.take()).toEqual([magnet(1), magnet(2)]);
  });

  it('caps the waiting list and drops the oldest', () => {
    const queue = new LaunchQueue(() => true);
    for (let i = 0; i < 25; i++) queue.enqueue(magnet(i));
    const waiting = queue.take();
    expect(waiting).toHaveLength(20);
    expect(waiting[0]).toEqual(magnet(5));
  });
});
