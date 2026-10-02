const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { clearMemoryCache } = require("../memory/index.js");
const { userDbCache, markUserDbDeleting, unmarkUserDbDeleting } = require("../../platform/db/userDatabase.js");
const { closeSchedulerDb } = require("../scheduler/db.js");
const qdrant = require("../../platform/vectors/qdrant.js");
const { getUserDbPath, getUploadsDir, getTtsDir, getVectorRootDir, getPublicRootDir } = require("../../paths");

const pendingUserDeletionJobs = new Map();

module.exports = function initAdminDashboard(app, context) {
    const { authMiddleware, authDb, wss, getWsClients } = context;

    const { wait, removeFileIfExists, disconnectUserSessions, getDirectorySize, removeDirectoryIfExists, removeUserVectorArtifacts, cleanupUserStorage, scheduleDeferredUserDeletion, toScopedMediaUploadRelativePath, toUploadRelativePath, resolveUploadReferencePath, getUserVectorStorageSize, collectUploadReferences, getUserStats, adminMiddleware, getMutableAdminTarget, sendAdminUserMutationNotFound, getQdrantMode } = require("./runtime/callbacks.js").createModule({
        get Database() { return Database; },
        get authDb() { return authDb; },
        get clearMemoryCache() { return clearMemoryCache; },
        get closeSchedulerDb() { return closeSchedulerDb; },
        get fs() { return fs; },
        get getPublicRootDir() { return getPublicRootDir; },
        get getTtsDir() { return getTtsDir; },
        get getUploadsDir() { return getUploadsDir; },
        get getUserDbPath() { return getUserDbPath; },
        get getVectorRootDir() { return getVectorRootDir; },
        get getWsClients() { return getWsClients; },
        get path() { return path; },
        get pendingUserDeletionJobs() { return pendingUserDeletionJobs; },
        get qdrant() { return qdrant; },
        get unmarkUserDbDeleting() { return unmarkUserDbDeleting; },
        get userDbCache() { return userDbCache; }
    });

    require("./http/get-admin-qdrant-status.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getQdrantMode() { return getQdrantMode; }, get qdrant() { return qdrant; } });

    require("./http/post-admin-invites.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

    require("./http/get-admin-users.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get getUserStats() { return getUserStats; } });

    require("./http/get-admin-invites-all.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

    require("./http/delete-admin-invites-code.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

    require("./http/put-admin-invites-code.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

    require("./http/post-admin-invites-code-renew.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

    require("./http/delete-admin-users-id.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get cleanupUserStorage() { return cleanupUserStorage; }, get disconnectUserSessions() { return disconnectUserSessions; }, get getMutableAdminTarget() { return getMutableAdminTarget; }, get markUserDbDeleting() { return markUserDbDeleting; }, get scheduleDeferredUserDeletion() { return scheduleDeferredUserDeletion; }, get sendAdminUserMutationNotFound() { return sendAdminUserMutationNotFound; }, get unmarkUserDbDeleting() { return unmarkUserDbDeleting; } });

    require("./http/post-admin-users-id-ban.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get disconnectUserSessions() { return disconnectUserSessions; }, get getMutableAdminTarget() { return getMutableAdminTarget; }, get sendAdminUserMutationNotFound() { return sendAdminUserMutationNotFound; } });

    require("./http/post-admin-users-id-role.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get disconnectUserSessions() { return disconnectUserSessions; }, get getMutableAdminTarget() { return getMutableAdminTarget; }, get sendAdminUserMutationNotFound() { return sendAdminUserMutationNotFound; } });

    require("./http/post-admin-users-id-reset-password.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get disconnectUserSessions() { return disconnectUserSessions; }, get getMutableAdminTarget() { return getMutableAdminTarget; }, get sendAdminUserMutationNotFound() { return sendAdminUserMutationNotFound; } });

    require("./http/post-admin-users-id-force-logout.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get disconnectUserSessions() { return disconnectUserSessions; }, get getMutableAdminTarget() { return getMutableAdminTarget; }, get sendAdminUserMutationNotFound() { return sendAdminUserMutationNotFound; } });

    require("./http/post-admin-announcement.js").register({ get adminMiddleware() { return adminMiddleware; }, get app() { return app; }, get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get wss() { return wss; } });
};
