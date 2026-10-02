import { useAuth } from '../account/AuthContext.jsx';
import React, { useState, useEffect } from 'react';
import { getLocalFallbackProfile } from './profileDefaults.js';
import { normalizeAvatarFrameId } from '../../shared/media/avatarFrames.js';
import { requestJson } from '../../shared/http/requestJson.js';

export function useSettingsProfile({ apiUrl, lang, setSaveError, onProfileUpdate }) {
    const { login, updateUser } = useAuth();

    const [profile, setProfile] = useState(() => getLocalFallbackProfile());
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editAvatarFrame, setEditAvatarFrame] = useState('none');
    const [editBanner, setEditBanner] = useState('');
    const [editBio, setEditBio] = useState('');
    const [accountUsername, setAccountUsername] = useState('');
    const [accountCurrentPassword, setAccountCurrentPassword] = useState('');
    const [accountNewPassword, setAccountNewPassword] = useState('');
    const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
    const [accountSaving, setAccountSaving] = useState(false);
    const [accountMessage, setAccountMessage] = useState('');
    const [accountError, setAccountError] = useState('');
    const [profileLoadError, setProfileLoadError] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const profileSaveLock = React.useRef(false);
    const profileDraftRef = React.useRef(null);

    profileDraftRef.current = JSON.stringify([editName, editAvatar, editAvatarFrame, editBanner, editBio]);

    useEffect(() => {
        // Fetch user profile
        const headers = { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` };
        const fallbackProfile = getLocalFallbackProfile();
        setProfile((prev) => prev || fallbackProfile);
        setEditName((prev) => prev || fallbackProfile.name || '');
        setEditAvatar((prev) => prev || fallbackProfile.avatar || '');
        setEditAvatarFrame((prev) => normalizeAvatarFrameId(prev || fallbackProfile.avatar_frame));
        setEditBanner((prev) => prev || fallbackProfile.banner || '');
        setEditBio((prev) => prev || fallbackProfile.bio || '');
        setAccountUsername((prev) => prev || fallbackProfile.username || '');

        const controller = new AbortController();
        let didTimeout = false;
        const timeoutId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, 5000);

        fetch(`${apiUrl}/user`, { headers, signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                clearTimeout(timeoutId);
                setProfileLoadError('');
                setProfile(data);
                setEditName(data.name || '');
                setEditAvatar(data.avatar || '');
                setEditAvatarFrame(normalizeAvatarFrameId(data.avatar_frame));
                setEditBanner(data.banner || '');
                setEditBio(data.bio || '');
                setAccountUsername(data.username || '');
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                if (err?.name === 'AbortError' && !didTimeout) {
                    return;
                }
                console.error(err);
                setProfileLoadError(
                    err?.name === 'AbortError'
                        ? 'Profile request timed out.'
                        : err?.message || 'Failed to load profile.',
                );
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [apiUrl, lang]);

    const handleSaveProfile = async () => {
        if (profileSaveLock.current) return false;
        profileSaveLock.current = true;
        setSavingProfile(true);
        setSaveError('');
        const draftSnapshot = profileDraftRef.current;
        const updated = {
            ...profile,
            name: editName,
            avatar: editAvatar,
            avatar_frame: normalizeAvatarFrameId(editAvatarFrame),
            banner: editBanner,
            bio: editBio,
        };
        try {
            const data = await requestJson(apiUrl + '/user', { method: 'POST', body: JSON.stringify(updated) });
            if (!data.profile) throw new Error(lang === 'en' ? 'Invalid profile response' : '服务器未返回个人资料');
            setProfile(data.profile);
            if (onProfileUpdate) onProfileUpdate(data.profile);
            if (profileDraftRef.current === draftSnapshot) setIsEditing(false);
            return true;
        } catch (e) {
            setSaveError((lang === 'en' ? 'Profile save failed: ' : '个人资料保存失败：') + e.message);
            return false;
        } finally {
            profileSaveLock.current = false;
            setSavingProfile(false);
        }
    };

    const handleSaveAccount = async () => {
        setAccountError('');
        setAccountMessage('');

        if (!accountCurrentPassword) {
            setAccountError(lang === 'en' ? 'Current password is required.' : '请输入当前密码。');
            return;
        }
        if (accountNewPassword && accountNewPassword !== accountConfirmPassword) {
            setAccountError(lang === 'en' ? 'New passwords do not match.' : '两次输入的新密码不一致。');
            return;
        }

        setAccountSaving(true);
        try {
            const res = await fetch(`${apiUrl}/auth/account`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                },
                body: JSON.stringify({
                    username: accountUsername,
                    currentPassword: accountCurrentPassword,
                    newPassword: accountNewPassword,
                }),
            });
            const raw = await res.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                const preview = raw.trim().slice(0, 120);
                throw new Error(
                    lang === 'en'
                        ? `Account update endpoint returned non-JSON (HTTP ${res.status}). ${preview}`
                        : `账号更新接口返回的不是 JSON（HTTP ${res.status}）。${preview}`,
                );
            }
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update account');
            }

            login(data.token, data.user);
            updateUser(data.user);
            setProfile((prev) => (prev ? { ...prev, username: data.user.username } : prev));
            if (onProfileUpdate) onProfileUpdate({ ...(profile || {}), username: data.user.username });
            setAccountCurrentPassword('');
            setAccountNewPassword('');
            setAccountConfirmPassword('');
            setAccountMessage(lang === 'en' ? 'Account updated successfully.' : '账号信息已更新。');
        } catch (e) {
            setAccountError(e.message || (lang === 'en' ? 'Failed to update account.' : '账号更新失败。'));
        } finally {
            setAccountSaving(false);
        }
    };

    return {
        profile,
        isEditing,
        handleSaveProfile,
        savingProfile,
        profileLoadError,
        setIsEditing,
        editName,
        setEditName,
        editAvatar,
        setEditAvatar,
        editAvatarFrame,
        setEditAvatarFrame,
        editBanner,
        setEditBanner,
        editBio,
        setEditBio,
        accountUsername,
        setAccountUsername,
        accountCurrentPassword,
        setAccountCurrentPassword,
        accountNewPassword,
        setAccountNewPassword,
        accountConfirmPassword,
        setAccountConfirmPassword,
        handleSaveAccount,
        accountSaving,
        accountError,
        accountMessage,
    };
}
