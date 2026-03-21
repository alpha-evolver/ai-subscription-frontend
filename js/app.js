/**
 * LensX AI - Main Application
 */
class AlphaAI {
    constructor() {
        this.API_BASE = 'http://113.44.153.144:3000';
        this.currentUser = null;
        this.currentToken = localStorage.getItem('alpha_session_token');
        this.apiToken = localStorage.getItem('alpha_api_token');
        this.messages = [];
        this.selectedModel = localStorage.getItem('lensx_model') || 'deepseek/deepseek-chat-v3-0324';
        this.isLoading = false;
        this.dailyQuota = 5;
        this.authMode = 'login';
        this.elements = {};
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkAuth();
        this.renderModelOptions();
        this.newChat();
    }
    
    cacheElements() {
        const ids = ['sidebar', 'chatList', 'userAvatar', 'userName', 'userPlan', 'headerTitle', 
            'mobileMenuBtn', 'chatContainer', 'chatInput', 'sendBtn', 'modelSelect', 'quotaInfo',
            'loginModal', 'settingsModal', 'apiModal', 'emailInput', 'passwordInput', 
            'loginTitle', 'loginSubtitle', 'loginBtn', 'tokenDisplay', 'toast'];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }
    
    bindEvents() {
        document.querySelector('.new-chat-btn')?.addEventListener('click', () => this.newChat());
        this.elements.sendBtn?.addEventListener('click', () => this.sendMessage());
        this.elements.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
        this.elements.modelSelect?.addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            localStorage.setItem('lensx_model', this.selectedModel);
        });
        this.elements.passwordInput?.addEventListener('input', (e) => this.updatePasswordStrength(e.target.value));
        document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', (e) => {
            if (e.target === o) o.classList.remove('active');
        }));
    }
    
    async checkAuth() {
        if (this.currentToken) {
            try {
                const res = await fetch(this.API_BASE + '/api/user', {
                    headers: { 'Authorization': 'Bearer ' + this.currentToken }
                });
                if (res.ok) {
                    const data = await res.json();
                    this.currentUser = data;
                    this.updateUserUI();
                }
            } catch(e) { log('Auth check failed'); }
        }
        this.updateUserUI();
    }
    
    async handleAuth() {
        const email = this.elements.emailInput?.value.trim();
        const password = this.elements.passwordInput?.value;
        
        if (!email || !password) { this.showToast('请填写邮箱和密码', 'error'); return; }
        if (!this.isValidEmail(email)) { this.showToast('邮箱格式不正确', 'error'); return; }
        if (password.length < 6) { this.showToast('密码至少6位', 'error'); return; }
        
        const btn = this.elements.loginBtn;
        btn.disabled = true;
        
        try {
            const endpoint = this.authMode === 'login' ? '/api/login' : '/api/register';
            const res = await fetch(this.API_BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                this.currentToken = data.token;
                this.apiToken = data.apiToken;
                this.currentUser = { email };
                localStorage.setItem('alpha_session_token', data.token);
                localStorage.setItem('alpha_api_token', data.apiToken);
                this.closeModal('loginModal');
                this.showToast(this.authMode === 'login' ? '登录成功' : '注册成功！您的API Token已生成', 'success');
                this.openAPI();
                this.updateUserUI();
            } else {
                this.showToast(data.error || '操作失败', 'error');
            }
        } catch(e) {
            log('Network error: ' + e.message);
            this.showToast('网络错误，请检查网络连接后重试', 'error');
        } finally {
            btn.disabled = false;
        }
    }
    
    async sendMessage() {
        const msg = this.elements.chatInput?.value.trim();
        if (!msg || this.isLoading) return;
        if (!this.currentToken) { this.openLogin(); return; }
        
        this.isLoading = true;
        this.elements.chatInput.value = '';
        this.addMessage('user', msg);
        this.addLoadingMessage();
        
        try {
            const res = await fetch(this.API_BASE + '/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.currentToken
                },
                body: JSON.stringify({ model: this.selectedModel, messages: this.messages })
            });
            
            this.removeLoadingMessage();
            
            if (res.ok) {
                const data = await res.json();
                this.addMessage('assistant', data.content);
            } else {
                const data = await res.json();
                this.addMessage('assistant', '错误: ' + (data.error || '请求失败'));
            }
        } catch(e) {
            this.removeLoadingMessage();
            this.addMessage('assistant', '网络错误，请重试');
        }
        
        this.isLoading = false;
    }
    
    addMessage(role, content) {
        this.messages.push({ role, content });
        const div = document.createElement('div');
        div.className = 'message ' + role;
        div.innerHTML = '<div class="message-content">' + content + '</div>';
        this.elements.chatContainer?.appendChild(div);
        this.elements.chatContainer?.scrollTop = this.elements.chatContainer.scrollHeight;
    }
    
    addLoadingMessage() {
        const div = document.createElement('div');
        div.className = 'message assistant loading';
        div.id = 'loadingMsg';
        div.innerHTML = '<div class="message-content"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
        this.elements.chatContainer?.appendChild(div);
    }
    
    removeLoadingMessage() { document.getElementById('loadingMsg')?.remove(); }
    
    newChat() {
        this.messages = [];
        this.elements.chatContainer.innerHTML = this.getWelcomeHTML();
    }
    
    getWelcomeHTML() {
        return '<div class="welcome-screen"><div class="welcome-icon">🤖</div><h1 class="welcome-title">欢迎使用 Alpha AI</h1><p class="welcome-subtitle">智能对话，触手可及</p></div>';
    }
    
    openLogin() { this.closeAllModals(); this.openModal('loginModal'); }
    openSettings() { this.updateUserUI(); this.openModal('settingsModal'); }
    openAPI() { this.elements.tokenDisplay && (this.elements.tokenDisplay.textContent = this.apiToken || '请先登录'); this.openModal('apiModal'); }
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
    closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
    openModal(id) { document.getElementById(id)?.classList.add('active'); }
    
    logout() {
        this.currentUser = null;
        this.currentToken = null;
        this.apiToken = null;
        localStorage.removeItem('alpha_session_token');
        localStorage.removeItem('alpha_api_token');
        this.updateUserUI();
        this.closeModal('settingsModal');
        this.showToast('已退出登录');
    }
    
    updateUserUI() {
        const loggedIn = !!this.currentUser;
        document.getElementById('loggedInContent')?.style && (document.getElementById('loggedInContent').style.display = loggedIn ? 'block' : 'none');
        document.getElementById('notLoggedInContent')?.style && (document.getElementById('notLoggedInContent').style.display = loggedIn ? 'none' : 'block');
    }
    
    renderModelOptions() {
        const models = [
            { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'x-ai/grok-3', name: 'Grok 3' }
        ];
        const select = this.elements.modelSelect;
        if (!select) return;
        select.innerHTML = models.map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('');
        select.value = this.selectedModel;
    }
    
    toggleAuthMode() {
        this.authMode = this.authMode === 'login' ? 'register' : 'login';
        const isReg = this.authMode === 'register';
        if (this.elements.loginTitle) this.elements.loginTitle.textContent = isReg ? '创建账户' : '欢迎回来';
        if (this.elements.loginSubtitle) this.elements.loginSubtitle.textContent = isReg ? '注册以开始使用AI服务' : '登录您的账户以继续';
        if (this.elements.loginBtn) this.elements.loginBtn.querySelector('.btn-text').textContent = isReg ? '注册' : '登录';
    }
    
    updatePasswordStrength(pw) {
        const el = document.getElementById('passwordStrength');
        if (!el || this.authMode === 'login') { if (el) el.style.display = 'none'; return; }
        el.style.display = 'flex';
        const fill = document.getElementById('strengthFill');
        const text = document.getElementById('strengthText');
        let strength = 'weak', label = '弱';
        if (pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)) { strength = 'strong'; label = '强'; }
        else if (pw.length >= 6) { strength = 'medium'; label = '中'; }
        fill.className = 'strength-fill ' + strength;
        text.className = 'strength-text ' + strength;
        text.textContent = label;
    }
    
    isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
    
    showToast(msg, type = 'info') {
        const toast = this.elements.toast;
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.alphaAI = new AlphaAI(); });
