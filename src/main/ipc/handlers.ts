import { registerConfigHandlers } from './config-handlers';
import { registerRpcHandlers } from './rpc-handlers';

export function registerIpcHandlers(): void {
  registerConfigHandlers();
  registerRpcHandlers();
}
