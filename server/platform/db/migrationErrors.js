function rethrowMigrationError(error) {
    // Legacy ALTERs are repeatable only when the requested column already exists.
    if (error?.code === 'SQLITE_ERROR' && /^duplicate column name:/i.test(error.message)) return;
    throw error;
}
module.exports = { rethrowMigrationError };
