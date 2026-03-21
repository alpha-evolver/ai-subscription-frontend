/**
 * Alpha AI - Main Application
 */

class AlphaAI {
    constructor() {
        this.API_BASE = 'http://113.44.153.144:3000';  // 华为云服务器
        this.currentUser = null;
        this.currentToken = localStorage.getItem('alpha_token');    // Session token (网页登录用)
        this.currentApiToken = localStorage.getItem('alpha_api_token');  // API Token (开发者用)
        this.messages = [];
        this.selectedModel = 'deepseek/deepseek-chat-v3-0324';
        this.isLoading = false;
        this.dailyQuota = 5;
        this.authMode = 'login';
        this.conversations = this.loadConversations();
        
        this.models = [
            { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3' },
            { id: 'anthropic/claude-3-haiku', name: 'Claude Haiku' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'x-ai/grok-4', name: 'Grok 4' },
            { id: 'x-ai/grok-3', name: 'Grok 3' },
            { id: 'meta-llama/llama-4-maverick', name: 'Llama 4' },
            { id: 'mistralai/mistral-large', name: 'Mistral Large' },
            { id: 'qwen/qwen3-32b', name: 'Qwen3 32B' },
        ];
        
        this.elements = {};
        this.init();
    }
    
    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.checkAuth();
        if (this.currentToken) await this.refreshQuota();
        this.renderConversations();
    }
    
    cacheElements() {
        this.elements = {
            sidebar: document.getElementById('sidebar'),
            chatList: document.getElementById('chatList'),
            userAvatar: document.getElementById('userAvatar'),
            userName: document.getElementById('userName'),
            userPlan: document.getElementById('userPlan'),
            headerTitle: document.getElementById('headerTitle'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            chatContainer: document.getElementById('chatContainer'),
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatInput: document.getElementById('chatInput'),
            sendBtn: document.getElementById('sendBtn'),
            modelSelect: document.getElementById('modelSelect'),
            quotaInfo: document.getElementById('quotaInfo'),
            loginModal: document.getElementById('loginModal'),
            settingsModal: document.getElementById('settingsModal'),
            apiModal: document.getElementById('apiModal'),
            emailInput: document.getElementById('emailInput'),
            passwordInput: document.getElementById('passwordInput'),
            loginTitle: document.getElementById('loginTitle'),
            loginSubtitle: document.getElementById('loginSubtitle'),
            loginBtn: document.getElementById('loginBtn'),
            rememberMe: document.getElementById('rememberMe'),
            passwordHint: document.getElementById('passwordHint'),
            toggleLink: document.getElementById('toggleLink'),
            authModeText: document.getElementById('authModeText'),
            loggedInContent: document.getElementById('loggedInContent'),
            notLoggedInContent: document.getElementById('notLoggedInContent'),
            settingsEmail: document.getElementById('settingsEmail'),
            tokenDisplay: document.getElementById('tokenDisplay'),
            toast: document.getElementById('toast')
        };
        
        // Load remembered email
        const rememberedEmail = localStorage.getItem('remembered_email');
        if (rememberedEmail && this.elements.emailInput) {
            this.elements.emailInput.value = rememberedEmail;
            if (this.elements.rememberMe) this.elements.rememberMe.checked = true;
        }
        
        // Set initial password hint state
        if (this.elements.passwordHint) {
            this.elements.passwordHint.style.display = 'none';
        }
        
        this.renderModelOptions();
    }
    
    bindEvents() {
        document.querySelector('.new-chat-btn').addEventListener('click', () => this.newChat());
        if (this.elements.mobileMenuBtn) {
            this.elements.mobileMenuBtn.addEventListener('click', () => this.toggleSidebar());
        }
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.chatInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.elements.chatInput.addEventListener('input', () => this.autoResize());
        this.elements.modelSelect.addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
        });
        
        // Password strength
        this.elements.passwordInput.addEventListener('input', (e) => {
            this.updatePasswordStrength(e.target.value);
        });
        
        // Enter key on login form
        this.elements.emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.elements.passwordInput.focus();
        });
        this.elements.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAuth();
        });
        
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            }
        });
    }
    
    async checkAuth() {
        try {
            const puterUser = await puter.auth.getUser();
            if (puterUser && puterUser.id) this.currentUser = puterUser;
        } catch (e) {}
        this.updateUserUI();
    }
    
    async handleAuth() {
        const email = this.elements.emailInput.value.trim();
        const password = this.elements.passwordInput.value;
        
        // Validation
        if (!email) {
            this.showLoginError('请输入邮箱地址');
            return;
        }
        if (!this.isValidEmail(email)) {
            this.showLoginError('请输入有效的邮箱地址');
            return;
        }
        if (!password) {
            this.showLoginError('请输入密码');
            return;
        }
        if (this.authMode === 'register' && password.length < 6) {
            this.showLoginError('密码至少需要6位字符');
            return;
        }
        
        // Set loading state
        this.setLoginLoading(true);
        this.hideLoginError();
        
        try {
            const endpoint = this.authMode === 'login' ? '/api/login' : '/api/register';
            const response = await fetch(this.API_BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                this.currentToken = data.token;
                this.currentApiToken = data.apiToken;
                this.currentUser = { email };
                localStorage.setItem('alpha_token', this.currentToken);
                localStorage.setItem('alpha_api_token', this.currentApiToken);
                
                // Remember email if checked
                if (this.elements.rememberMe?.checked) {
                    localStorage.setItem('remembered_email', email);
                }
                
                this.updateUserUI();
                this.closeModal('loginModal');
                
                // Show success with API token if registration
                if (this.authMode === 'register') {
                    this.showToast('注册成功！您的API Token已生成', 'success');
                    // Open API modal to show token
                    setTimeout(() => this.openAPI(), 500);
                } else {
                    this.showToast('登录成功', 'success');
                }
                
                await this.refreshQuota();
            } else {
                this.showLoginError(data.error || '操作失败，请重试');
            }
        } catch (e) {
            this.showLoginError('网络错误，请检查网络连接后重试');
        } finally {
            this.setLoginLoading(false);
        }
    }
    
    logout() {
        this.currentUser = null;
        this.currentToken = null;
        this.currentApiToken = null;
        localStorage.removeItem('alpha_token');
        localStorage.removeItem('alpha_api_token');
        this.updateUserUI();
        this.closeModal('settingsModal');
        this.showToast('已退出登录', 'success');
    }
    
    toggleAuthMode() {
        this.authMode = this.authMode === 'login' ? 'register' : 'login';
        
        // Update UI
        const isRegister = this.authMode === 'register';
        this.elements.loginTitle.textContent = isRegister ? '创建账户' : '欢迎回来';
        this.elements.loginSubtitle.textContent = isRegister ? '注册以开始使用AI服务' : '登录您的账户以继续';
        this.elements.loginBtn.querySelector('.btn-text').textContent = isRegister ? '注册' : '登录';
        this.elements.toggleLink.textContent = isRegister ? '立即注册' : '立即登录';
        this.elements.toggleLink.parentElement.innerHTML = isRegister 
            ? '还没有账户? <a onclick="alphaAI.toggleAuthMode()">立即注册</a>'
            : '已有账户? <a onclick="alphaAI.toggleAuthMode()">立即登录</a>';
        
        // Update hints
        if (isRegister) {
            this.elements.passwordHint.style.display = 'inline';
        } else {
            this.elements.passwordHint.style.display = 'none';
        }
        
        this.hideLoginError();
    }
    
    // Password visibility toggle
    togglePassword() {
        const input = this.elements.passwordInput;
        const eyeOpen = document.querySelector('.eye-open');
        const eyeClosed = document.querySelector('.eye-closed');
        
        if (input.type === 'password') {
            input.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    }
    
    // Password strength indicator
    updatePasswordStrength(password) {
        const strengthDiv = document.getElementById('passwordStrength');
        const fill = document.getElementById('strengthFill');
        const text = document.getElementById('strengthText');
        
        if (!password || this.authMode === 'login') {
            strengthDiv.style.display = 'none';
            return;
        }
        
        strengthDiv.style.display = 'flex';
        
        let strength = 'weak';
        let strengthLabel = '弱';
        
        if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
            strength = 'strong';
            strengthLabel = '强';
        } else if (password.length >= 6) {
            strength = 'medium';
            strengthLabel = '中';
        }
        
        fill.className = 'strength-fill ' + strength;
        text.className = 'strength-text ' + strength;
        text.textContent = strengthLabel;
    }
    
    // Helper methods
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    showLoginError(message) {
        const errorEl = document.getElementById('loginError');
        const textEl = document.getElementById('loginErrorText');
        textEl.textContent = message;
        errorEl.style.display = 'flex';
    }
    
    hideLoginError() {
        document.getElementById('loginError').style.display = 'none';
    }
    
    setLoginLoading(loading) {
        const btn = this.elements.loginBtn;
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        
        btn.disabled = loading;
        if (loading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
        }
    }
    
    updateUserUI() {
        if (this.currentUser) {
            this.elements.userAvatar.textContent = this.currentUser.email[0].toUpperCase();
            this.elements.userName.textContent = this.currentUser.email.split('@')[0];
            this.elements.userPlan.textContent = '免费版';
            if (this.elements.loggedInContent) { this.elements.loggedInContent.style.display = 'block'; this.elements.notLoggedInContent.style.display = 'none'; this.elements.settingsEmail.textContent = this.currentUser.email; }
        } else {
            this.elements.userAvatar.textContent = '?';
            this.elements.userName.textContent = '未登录';
            this.elements.userPlan.textContent = '点击登录';
            if (this.elements.loggedInContent) { this.elements.loggedInContent.style.display = 'none'; this.elements.notLoggedInContent.style.display = 'block'; }
        }
    }
    
    newChat() {
        this.messages = [];
        this.elements.chatContainer.innerHTML = '';
        this.elements.chatContainer.innerHTML = this.getWelcomeHTML();
        this.elements.headerTitle.textContent = '新对话';
        this.closeSidebar();
    }
    
    getWelcomeHTML() {
        return `
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-icon">🤖</div>
                <h1 class="welcome-title">欢迎使用 Alpha AI</h1>
                <p class="welcome-subtitle">智能对话，触手可及</p>
                <div class="capabilities">
                    <div class="capability-card" onclick="alphaAI.sendSuggestion('帮我写一篇关于AI的文章')">
                        <div class="capability-icon">✍️</div>
                        <div class="capability-title">写作助手</div>
                        <div class="capability-desc">文章、邮件、报告各种写作</div>
                    </div>
                    <div class="capability-card" onclick="alphaAI.sendSuggestion('解释一下什么是机器学习')">
                        <div class="capability-icon">📚</div>
                        <div class="capability-title">学习辅导</div>
                        <div class="capability-desc">解答问题，讲解知识</div>
                    </div>
                    <div class="capability-card" onclick="alphaAI.sendSuggestion('用Python写一个快速排序')">
                        <div class="capability-icon">💻</div>
                        <div class="capability-title">代码助手</div>
                        <div class="capability-desc">编程问题，代码调试</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    sendSuggestion(text) {
        this.elements.chatInput.value = text;
        this.sendMessage();
    }
    
    async sendMessage() {
        const message = this.elements.chatInput.value.trim();
        if (!message || this.isLoading) return;
        if (this.dailyQuota <= 0) { this.showToast('今日次数已用完', 'error'); return; }
        
        this.elements.chatInput.value = '';
        this.autoResize();
        
        const welcome = document.getElementById('welcomeScreen');
        if (welcome) welcome.remove();
        
        this.addMessage(message, 'user');
        this.messages.push({ role: 'user', content: message });
        
        this.isLoading = true;
        this.elements.sendBtn.disabled = true;
        
        // 流式响应：创建可更新的消息元素
        const streamMsgEl = this.addMessage('', 'assistant', true);
        let fullContent = '';
        
        try {
            const response = await fetch(this.API_BASE + '/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': 'Bearer ' + (this.currentToken || 'guest') 
                },
                body: JSON.stringify({ 
                    model: this.selectedModel, 
                    messages: this.messages,
                    stream: true 
                })
            });
            
            if (response.headers.get('content-type')?.includes('text/event-stream')) {
                // 流式响应处理
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    // 解析SSE数据
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                
                                if (parsed.delta) {
                                    // 流式增量更新
                                    fullContent += parsed.delta;
                                    this.updateStreamingMessage(streamMsgEl, fullContent);
                                } else if (parsed.content) {
                                    // 完整内容（最后一条）
                                    fullContent = parsed.content;
                                } else if (parsed.error) {
                                    throw new Error(parsed.error);
                                }
                                
                                if (parsed.remaining !== undefined) {
                                    this.dailyQuota = parsed.remaining;
                                    this.updateQuotaDisplay();
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
                
                // 完成：移除loading状态，更新为最终内容
                this.updateStreamingMessage(streamMsgEl, fullContent);
                this.messages.push({ role: 'assistant', content: fullContent });
                this.saveConversation(message.slice(0, 50));
                
            } else {
                // 非流式响应（兼容）
                const data = await response.json();
                
                if (response.ok) {
                    this.addMessage(data.content, 'assistant');
                    this.messages.push({ role: 'assistant', content: data.content });
                    if (data.remaining !== undefined) { this.dailyQuota = data.remaining; this.updateQuotaDisplay(); }
                    this.saveConversation(message.slice(0, 50));
                } else {
                    this.addMessage('错误: ' + (data.error || '请求失败'), 'error');
                }
            }
        } catch (e) { 
            this.updateStreamingMessage(streamMsgEl, '网络错误，请检查连接'); 
        }
        finally { this.isLoading = false; this.elements.sendBtn.disabled = false; }
    }
    
    updateStreamingMessage(el, content) {
        if (!el) return;
        const contentEl = el.querySelector('.message-content');
        if (contentEl) {
            contentEl.innerHTML = this.formatContent(content);
        }
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }
    
    addMessage(content, role, isLoading = false) {
        const container = this.elements.chatContainer;
        const div = document.createElement('div');
        div.className = `message ${role}${isLoading ? ' loading' : ''}`;
        
        if (isLoading) {
            div.innerHTML = `<div class="message-avatar ${role}">${role === 'user' ? '👤' : '🤖'}</div><div class="message-content"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>`;
        } else {
            div.innerHTML = `<div class="message-avatar ${role}">${role === 'user' ? '👤' : '🤖'}</div><div class="message-content">${this.formatContent(content)}</div>`;
        }
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }
    
    addLoadingMessage() { this.addMessage('', 'assistant', true); }
    removeLoadingMessage() { const loading = this.elements.chatContainer.querySelector('.message.loading'); if (loading) loading.remove(); }
    
    formatContent(content) {
        if (!content) return '';
        let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>');
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`);
        return formatted.replace(/\n/g, '<br>');
    }
    
    async refreshQuota() {
        try {
            const response = await fetch(this.API_BASE + '/api/user', { headers: { 'Authorization': 'Bearer ' + this.currentToken } });
            if (response.ok) { const data = await response.json(); this.dailyQuota = data.remaining || 0; this.updateQuotaDisplay(); }
        } catch (e) {}
    }
    
    updateQuotaDisplay() {
        const el = this.elements.quotaInfo;
        if (this.dailyQuota <= 0) { el.textContent = '❌ 今日次数已用完'; el.className = 'quota-info error'; }
        else if (this.dailyQuota <= 2) { el.textContent = `⚠️ 免费版 · 今日剩余 ${this.dailyQuota} 次`; el.className = 'quota-info warning'; }
        else { el.textContent = `免费版 · 今日剩余 ${this.dailyQuota} 次`; el.className = 'quota-info'; }
    }
    
    renderModelOptions() {
        this.elements.modelSelect.innerHTML = this.models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        this.elements.modelSelect.value = this.selectedModel;
    }
    
    loadConversations() { try { return JSON.parse(localStorage.getItem('alpha_conversations')) || []; } catch { return []; } }
    
    saveConversations() {
        if (this.messages.length < 2) return;
        const title = this.messages[0]?.content?.slice(0, 30) || '新对话';
        this.conversations.unshift({ id: Date.now(), title, messages: [...this.messages], model: this.selectedModel, createdAt: new Date().toISOString() });
        this.conversations = this.conversations.slice(0, 20);
        localStorage.setItem('alpha_conversations', JSON.stringify(this.conversations));
        this.renderConversations();
    }
    
    renderConversations() {
        const container = this.elements.chatList;
        if (this.conversations.length === 0) { container.innerHTML = ''; return; }
        container.innerHTML = `<div class="chat-section"><div class="chat-section-title">最近对话</div>${this.conversations.map(conv => `<div class="chat-item" data-id="${conv.id}"><svg class="chat-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="chat-item-title">${conv.title}</span></div>`).join('')}</div>`;
        container.querySelectorAll('.chat-item').forEach(item => { item.addEventListener('click', () => { const id = parseInt(item.dataset.id); this.loadConversation(id); }); });
    }
    
    loadConversation(id) {
        const conv = this.conversations.find(c => c.id === id);
        if (!conv) return;
        this.messages = conv.messages || [];
        this.selectedModel = conv.model || this.selectedModel;
        this.elements.modelSelect.value = this.selectedModel;
        this.elements.chatContainer.innerHTML = '';
        this.messages.forEach(msg => { this.addMessage(msg.content, msg.role); });
        this.elements.headerTitle.textContent = conv.title;
        this.closeSidebar();
    }
    
    handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } }
    autoResize() { const el = this.elements.chatInput; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }
    toggleSidebar() { this.elements.sidebar.classList.toggle('open'); }
    closeSidebar() { this.elements.sidebar.classList.remove('open'); }
    openModal(id) { document.getElementById(id).classList.add('active'); }
    closeModal(id) { document.getElementById(id).classList.remove('active'); }
    openSettings() { this.updateUserUI(); this.openModal('settingsModal'); }
    openLogin() { this.closeModal('settingsModal'); this.openModal('loginModal'); }
    openPlans() { this.showToast('订阅功能开发中', 'info'); }
    
    openAPI() { 
        const token = this.currentApiToken || localStorage.getItem('alpha_api_token');
        const notLoggedIn = document.getElementById('apiNotLoggedIn');
        const loggedIn = document.getElementById('apiLoggedIn');
        
        if (token) {
            // User is logged in
            notLoggedIn.style.display = 'none';
            loggedIn.style.display = 'block';
            document.getElementById('apiTokenValue').textContent = token;
        } else {
            // User not logged in
            notLoggedIn.style.display = 'block';
            loggedIn.style.display = 'none';
        }
        
        // Initialize example tab
        this.switchApiTab('python');
        
        this.openModal('apiModal'); 
    }
    
    toggleApiTokenVisibility() {
        const tokenValue = document.getElementById('apiTokenValue');
        const eyeIcon = document.querySelector('.eye-icon');
        const eyeOffIcon = document.querySelector('.eye-off-icon');
        
        if (tokenValue.dataset.hidden === 'true') {
            // Show token
            tokenValue.textContent = this.currentApiToken || localStorage.getItem('alpha_api_token');
            tokenValue.dataset.hidden = 'false';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        } else {
            // Hide token
            const token = this.currentApiToken || localStorage.getItem('alpha_api_token');
            const masked = token.slice(0, 4) + '••••••••••••••••' + token.slice(-4);
            tokenValue.textContent = masked;
            tokenValue.dataset.hidden = 'true';
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        }
    }
    
    copyApiToken() {
        const token = this.currentApiToken || localStorage.getItem('alpha_api_token');
        if (token) { 
            navigator.clipboard.writeText(token); 
            this.showToast('Token 已复制到剪贴板', 'success'); 
        } else {
            this.showToast('请先登录获取 Token', 'error');
        }
    }
    
    copyToken() { 
        this.copyApiToken();
    }
    
    async regenerateApiToken() {
        if (!this.currentToken) {
            this.showToast('请先登录', 'error');
            return;
        }
        
        if (!confirm('重新生成 Token 将使旧 Token 失效，确定要继续吗？')) {
            return;
        }
        
        try {
            const response = await fetch(this.API_BASE + '/api/token/regenerate', {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer ' + this.currentToken,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentApiToken = data.apiToken;
                localStorage.setItem('alpha_api_token', data.apiToken);
                document.getElementById('apiTokenValue').textContent = data.apiToken;
                this.showToast('Token 已重新生成', 'success');
            } else {
                this.showToast(data.error || '重新生成失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误，请重试', 'error');
        }
    }
    
    copyQuick(lang) {
        const token = this.currentApiToken || localStorage.getItem('alpha_api_token') || 'YOUR_TOKEN';
        let code = '';
        
        switch(lang) {
            case 'python':
                code = `import requests

response = requests.post(
    "${this.API_BASE}/v1/chat/completions",
    headers={"Authorization": f"Bearer ${token}"},
    json={
        "model": "deepseek/deepseek-chat-v3-0324",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)
print(response.json())`;
                break;
            case 'javascript':
                code = `const response = await fetch('${this.API_BASE}/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ${token}',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [{role: 'user', content: 'Hello!'}]
    })
});
const data = await response.json();
console.log(data.choices[0].message.content);`;
                break;
            case 'curl':
                code = `curl ${this.API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek/deepseek-chat-v3-0324","messages":[{"role":"user","content":"Hello"}]}'`;
                break;
        }
        
        navigator.clipboard.writeText(code);
        this.showToast(`${lang} 代码已复制`, 'success');
    }
    
    switchApiTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase() === tab);
        });
        
        const token = this.currentApiToken || localStorage.getItem('alpha_api_token') || 'YOUR_TOKEN';
        let code = '';
        
        switch(tab) {
            case 'python':
                code = `import requests

response = requests.post(
    "${this.API_BASE}/v1/chat/completions",
    headers={"Authorization": f"Bearer ${token}"},
    json={
        "model": "deepseek/deepseek-chat-v3-0324",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"}
        ]
    }
)
print(response.json()["choices"][0]["message"]["content"])`;
                break;
            case 'javascript':
                code = `// Using fetch API
const response = await fetch(
    '${this.API_BASE}/v1/chat/completions',
    {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ${token}',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat-v3-0324',
            messages: [
                {role: 'system', content: 'You are a helpful assistant.'},
                {role: 'user', content: 'Hello!'}
            ]
        })
    }
);
const data = await response.json();
console.log(data.choices[0].message.content);`;
                break;
            case 'curl':
                code = `curl ${this.API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-chat-v3-0324",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'`;
                break;
        }
        
        document.getElementById('apiExampleContent').innerHTML = `<pre>${code}</pre>`;
    }
    
    showToast(message, type = 'success') { 
        const toast = this.elements.toast; 
        toast.textContent = message; 
        toast.className = `toast ${type} show`; 
        setTimeout(() => { toast.classList.remove('show'); }, 3000); 
    }
}

document.addEventListener('DOMContentLoaded', () => { window.alphaAI = new AlphaAI(); });
