import { File } from 'node:buffer';

function notFound(name: string): DOMException {
  return new DOMException(`entry ${name} not found`, 'NotFoundError');
}

function typeMismatch(name: string): DOMException {
  return new DOMException(`entry ${name} is not the requested kind`, 'TypeMismatchError');
}

function mimeOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  switch (ext) {
    case 'md':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'txt':
      return 'text/plain';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    default:
      return '';
  }
}

export class FakeWritable {
  constructor(private readonly handle: FakeFileHandle) {}

  async write(data: BufferSource): Promise<void> {
    this.handle.bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  async close(): Promise<void> {}
}

export class FakeFileHandle {
  readonly kind = 'file' as const;
  constructor(
    public name: string,
    public bytes: Uint8Array,
    public modifiedAt = 0,
  ) {}

  async getFile(): Promise<File> {
    return new File([this.bytes], this.name, {
      lastModified: this.modifiedAt,
      type: mimeOf(this.name),
    });
  }

  async createWritable(): Promise<FakeWritable> {
    return new FakeWritable(this);
  }

  async move(newNameOrDir: string | FakeDirHandle): Promise<void> {
    if (typeof newNameOrDir === 'string') {
      if (this.parent) {
        this.parent.rename(this, newNameOrDir);
      } else {
        this.name = newNameOrDir;
      }
      return;
    }
    throw new Error('Cross-directory move must be simulated as copy+delete; pass a name');
  }

  parent: FakeDirHandle | null = null;
}

export class FakeDirHandle {
  readonly kind = 'directory' as const;
  readonly children = new Map<string, FakeFileHandle | FakeDirHandle>();
  constructor(
    public name: string,
    public parent: FakeDirHandle | null = null,
  ) {}

  private put(child: FakeFileHandle | FakeDirHandle): void {
    child.parent = this;
    this.children.set(child.name, child);
  }

  rename(entry: FakeFileHandle | FakeDirHandle, newName: string): void {
    if (this.children.has(newName) && this.children.get(newName) !== entry) {
      throw new DOMException('destination exists', 'NoModificationAllowedError');
    }
    this.children.delete(entry.name);
    entry.name = newName;
    this.put(entry);
  }

  async getDirectoryHandle(
    name: string,
    options: FileSystemGetDirectoryOptions = {},
  ): Promise<FakeDirHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'directory') throw typeMismatch(name);
      return existing as FakeDirHandle;
    }
    if (!options.create) throw notFound(name);
    const dir = new FakeDirHandle(name, this);
    this.put(dir);
    return dir;
  }

  async getFileHandle(
    name: string,
    options: FileSystemGetFileOptions = {},
  ): Promise<FakeFileHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== 'file') throw typeMismatch(name);
      return existing as FakeFileHandle;
    }
    if (!options.create) throw notFound(name);
    const file = new FakeFileHandle(name, new Uint8Array());
    this.put(file);
    return file;
  }

  async removeEntry(name: string, options: FileSystemRemoveOptions = {}): Promise<void> {
    const existing = this.children.get(name);
    if (!existing) throw notFound(name);
    if (existing.kind === 'directory' && existing.children.size > 0 && !options.recursive) {
      throw new DOMException('directory is not empty', 'InvalidModificationError');
    }
    this.children.delete(name);
  }

  async *entries(): AsyncIterableIterator<[string, FakeFileHandle | FakeDirHandle]> {
    for (const [name, child] of this.children) {
      yield [name, child];
    }
  }

  get size(): number {
    return this.children.size;
  }
}

export type FakeHandle = FakeFileHandle | FakeDirHandle;

/** Create a fresh in-memory OPFS root for tests. */
export function createFakeOpfsRoot(parent: FakeDirHandle | null = null): FakeDirHandle {
  return new FakeDirHandle('root', parent);
}
