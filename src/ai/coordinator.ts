import { ProviderError } from './contracts';

/** One shared owner protects installed model files, including across asynchronous mutations. */
export class ModelResourceCoordinator {
  private paths = new Set<string>();
  private mutating = false;
  acquire(path: string): { release(): void } {
    if (this.mutating || this.paths.size)
      throw new ProviderError('SESSION_POISONED', 'Model resource is busy.');
    this.paths.add(path);
    let released = false;
    return {
      release: () => {
        if (!released) {
          released = true;
          this.paths.delete(path);
        }
      },
    };
  }
  isLeased(path: string): boolean {
    return this.paths.has(path);
  }
  assertMutable(path?: string): void {
    if (this.mutating || (path ? this.paths.has(path) : this.paths.size > 0))
      throw new ProviderError('SESSION_POISONED', 'Native engine still owns model resources.');
  }
  async withModelMutation<T>(work: () => Promise<T>): Promise<T> {
    this.assertMutable();
    this.mutating = true;
    try {
      return await work();
    } finally {
      this.mutating = false;
    }
  }
}
export const modelResourceCoordinator = new ModelResourceCoordinator();
