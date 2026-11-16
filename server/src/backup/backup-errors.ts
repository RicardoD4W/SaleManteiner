export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export class BackupNotFoundError extends Error {
  constructor(name: string) {
    super(`La copia "${name}" no existe`);
    this.name = 'BackupNotFoundError';
  }
}
