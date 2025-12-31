/**
 * 存储管理模块
 * 支持多窗口独立登录（使用sessionStorage）
 * 其他设置使用localStorage（跨窗口共享）
 */

const Storage = {
    /**
     * 获取认证Token（使用sessionStorage，每个标签页独立）
     */
    getAuthToken() {
        return sessionStorage.getItem('auth_token');
    },

    /**
     * 设置认证Token
     */
    setAuthToken(token) {
        sessionStorage.setItem('auth_token', token);
    },

    /**
     * 移除认证Token
     */
    removeAuthToken() {
        sessionStorage.removeItem('auth_token');
    },

    /**
     * 获取用户信息（使用sessionStorage，每个标签页独立）
     */
    getUserInfo() {
        const userInfoStr = sessionStorage.getItem('user_info');
        if (userInfoStr) {
            try {
                return JSON.parse(userInfoStr);
            } catch (e) {
                console.error('解析用户信息失败:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * 设置用户信息
     */
    setUserInfo(userInfo) {
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
    },

    /**
     * 移除用户信息
     */
    removeUserInfo() {
        sessionStorage.removeItem('user_info');
    },

    /**
     * 清除所有认证信息
     */
    clearAuth() {
        this.removeAuthToken();
        this.removeUserInfo();
    },

    /**
     * 获取左侧面板宽度（使用localStorage，跨窗口共享）
     */
    getLeftPanelWidth() {
        return localStorage.getItem('leftPanelWidth');
    },

    /**
     * 设置左侧面板宽度
     */
    setLeftPanelWidth(width) {
        localStorage.setItem('leftPanelWidth', width);
    }
};

