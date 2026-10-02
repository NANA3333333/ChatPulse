import { TriangleAlert } from 'lucide-react';

export function WipeDataDialog({ lang, wipeConfirmText, setWipeConfirmText, setWipeModalOpen, handleSystemWipe }) {
    return (
        <div className="settings-wipe-modal">
            <div>
                <span>
                    <TriangleAlert size={24} />
                </span>
                <h2>{lang === 'en' ? 'Confirm full wipe?' : '确认清空全部数据？'}</h2>
                <p>
                    {lang === 'en'
                        ? 'This deletes characters, private chats, group chats, memories, uploads, and generated files. Type DELETE ALL to continue.'
                        : '这会删除角色、私聊、群聊、记忆、上传和生成文件。请输入 DELETE ALL 继续。'}
                </p>
                <input
                    value={wipeConfirmText}
                    onChange={(event) => setWipeConfirmText(event.target.value)}
                    placeholder="DELETE ALL"
                />
                <section>
                    <button
                        type="button"
                        onClick={() => {
                            setWipeModalOpen(false);
                            setWipeConfirmText('');
                        }}
                    >
                        {lang === 'en' ? 'Cancel' : '取消'}
                    </button>
                    <button
                        type="button"
                        className="danger"
                        disabled={wipeConfirmText !== 'DELETE ALL'}
                        onClick={() => {
                            setWipeModalOpen(false);
                            setWipeConfirmText('');
                            handleSystemWipe(true);
                        }}
                    >
                        {lang === 'en' ? 'Wipe permanently' : '永久清空'}
                    </button>
                </section>
            </div>
        </div>
    );
}
