const btnResetWholeGame = document.getElementById('btnToolResetWholeGame');
const btnResetLeaderboardProgress = document.getElementById('btnToolResetLeaderboardProgress');
const toolStatus = document.getElementById('toolStatus');

function setToolStatus(text, isError = false) {
    if (!toolStatus) return;
    toolStatus.textContent = text || '';
    toolStatus.style.color = isError ? '#9d2b22' : '#466f27';
}

async function resetWholeGameState() {
    if (!btnResetWholeGame) return;
    const confirmed = window.confirm(
        '确认重置整局游戏状态？将影响所有玩家：金币、皮肤解锁、关卡进度。'
    );
    if (!confirmed) {
        return;
    }
    btnResetWholeGame.disabled = true;
    const prevText = btnResetWholeGame.textContent;
    btnResetWholeGame.textContent = '重置中...';
    try {
        const response = await fetch('/api/admin/reset-game-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'admin-tool' })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error || `HTTP ${response.status}`);
        }
        const count = Math.max(0, Math.floor(Number(payload?.resetUsers) || 0));
        setToolStatus(`已重置整局游戏状态，影响用户数：${count}。`);
    } catch (error) {
        setToolStatus(`重置失败：${error?.message || 'unknown error'}`, true);
    } finally {
        btnResetWholeGame.disabled = false;
        btnResetWholeGame.textContent = prevText;
    }
}

async function resetLeaderboardProgress() {
    if (!btnResetLeaderboardProgress) return;
    const confirmed = window.confirm(
        '确认重置排行榜进度？将把所有玩家的“已通关最大关卡”重置为 0。'
    );
    if (!confirmed) {
        return;
    }
    btnResetLeaderboardProgress.disabled = true;
    const prevText = btnResetLeaderboardProgress.textContent;
    btnResetLeaderboardProgress.textContent = '重置中...';
    try {
        const response = await fetch('/api/admin/reset-leaderboard-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'admin-tool' })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error || `HTTP ${response.status}`);
        }
        const count = Math.max(0, Math.floor(Number(payload?.resetUsers) || 0));
        setToolStatus(`已重置排行榜进度，影响用户数：${count}。`);
    } catch (error) {
        setToolStatus(`重置失败：${error?.message || 'unknown error'}`, true);
    } finally {
        btnResetLeaderboardProgress.disabled = false;
        btnResetLeaderboardProgress.textContent = prevText;
    }
}

btnResetWholeGame?.addEventListener('click', () => {
    void resetWholeGameState();
});

btnResetLeaderboardProgress?.addEventListener('click', () => {
    void resetLeaderboardProgress();
});
