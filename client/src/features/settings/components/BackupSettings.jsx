import { Cloud, Download, Upload, Trash2, TriangleAlert } from 'lucide-react';

export function BackupSettings({
    activeSettingsScreen,
    lang,
    handleExportDatabase,
    handleImportDatabase,
    setWipeModalOpen,
}) {
    return (
        <div className="settings-guided-screen" hidden={activeSettingsScreen !== 'backup'}>
            <section
                id="settings-backup-section"
                className="settings-card settings-backup-card settings-command-backup-card"
            >
                <div className="settings-card-title settings-card-title-row">
                    <div>
                        <h2>
                            <Cloud size={21} /> {lang === 'en' ? 'Backup & Restore' : '备份与恢复'}
                        </h2>
                        <p>
                            {lang === 'en'
                                ? 'Protect character data and settings with regular backups.'
                                : '定期备份可保护你的角色数据与设置，建议每周至少备份一次。'}
                        </p>
                    </div>
                </div>
                <div className="settings-backup-actions">
                    <button
                        type="button"
                        className="settings-backup-action settings-backup-action--primary"
                        onClick={handleExportDatabase}
                    >
                        <span className="settings-backup-icon">
                            <Download size={20} />
                        </span>
                        <span>
                            <strong>{lang === 'en' ? 'Backup Data' : '备份数据'}</strong>
                            <small>{lang === 'en' ? 'Export current data locally' : '导出当前数据到本地文件'}</small>
                        </span>
                    </button>
                    <label className="settings-backup-action settings-backup-upload">
                        <span className="settings-backup-icon">
                            <Upload size={20} />
                        </span>
                        <span>
                            <strong>{lang === 'en' ? 'Restore Data' : '恢复数据'}</strong>
                            <small>{lang === 'en' ? 'Restore data from local file' : '从本地文件恢复数据'}</small>
                        </span>
                        <input
                            type="file"
                            accept=".zip,.db,application/zip,application/x-sqlite3,application/octet-stream"
                            style={{ display: 'none' }}
                            onChange={handleImportDatabase}
                        />
                    </label>
                    <button
                        type="button"
                        className="settings-backup-action settings-backup-action--danger"
                        onClick={() => setWipeModalOpen(true)}
                    >
                        <span className="settings-backup-icon">
                            <Trash2 size={20} />
                        </span>
                        <span>
                            <strong>{lang === 'en' ? 'Factory Reset' : '恢复出厂设置'}</strong>
                            <small>{lang === 'en' ? 'Clear all data permanently' : '清除所有数据，无法恢复'}</small>
                        </span>
                    </button>
                </div>
                <section className="settings-danger-zone">
                    <div>
                        <span>
                            <TriangleAlert size={20} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Wipe all data for this account' : '清空当前账号全部数据'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'This permanently deletes characters, chats, memories, uploads, and generated files. Type DELETE ALL before continuing.'
                                    : '这会永久删除角色、聊天、记忆、上传和生成文件。继续前必须输入 DELETE ALL。'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setWipeModalOpen(true)}>
                        {lang === 'en' ? 'Wipe all data' : '清空全部数据'}
                    </button>
                </section>
            </section>
        </div>
    );
}
