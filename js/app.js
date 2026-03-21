/**
 * Alpha AI - Main Application
 */

class AlphaAI {
    constructor() {
        this.API_BASE = 'https://www.lensx.com.cn';
        this.currentUser = null;
        this.currentToken = localStorage.getItem('alpha_token');
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
            loginBtn: document.getElementById('loginBtn'),
            authModeText: document.getElementById('authModeText'),
            loggedInContent: document.getElementById('loggedInContent'),
            notLoggedInContent: document.getElementById('notLoggedInContent'),
            settingsEmail: document.getElementById('settingsEmail'),
            tokenDisplay: document.getElementById('tokenDisplay'),
            toast: document.getElementById('toast')
        };
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
        if (!email || !password) { this.showToast('请填写邮箱和密码', 'error'); return; }
        
        this.elements.loginBtn.disabled = true;
        this.elements.loginBtn.textContent = '处理中...';
        
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
                this.currentUser = { email };
                localStorage.setItem('alpha_token', this.currentToken);
                this.updateUserUI();
                this.closeModal('loginModal');
                this.showToast(this.authMode === 'login' ? '登录成功' : '注册成功', 'success');
                await this.refreshQuota();
            } else {
                this.showToast(data.error || '操作失败', 'error');
            }
        } catch (e) { this.showToast('网络错误，请重试', 'error'); }
        finally {
            this.elements.loginBtn.disabled = false;
            this.elements.loginBtn.textContent = this.authMode === 'login' ? '登录' : '注册';
        }
    }
    
    logout() {
        this.currentUser = null;
        this.currentToken = null;
        localStorage.removeItem('alpha_token');
        this.updateUserUI();
        this.closeModal('settingsModal');
        this.showToast('已退出登录', 'success');
    }
    
    toggleAuthMode() {
        this.authMode = this.authMode === 'login' ? 'register' : 'login';
        this.elements.loginTitle.textContent = this.authMode === 'login' ? '登录' : '注册';
        this.elements.loginBtn.textContent = this.authMode === 'login' ? '登录' : '注册';
        this.elements.authModeText.textContent = this.authMode === 'login' ? '注册' : '登录';
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
        this.addLoadingMessage();
        
        try {
            const response = await fetch(this.API_BASE + '/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (this.currentToken || 'guest') },
                body: JSON.stringify({ model: this.selectedModel, messages: this.messages })
            });
            const data = await response.json();
            this.removeLoadingMessage();
            
            if (response.ok) {
                this.addMessage(data.content, 'assistant');
                this.messages.push({ role: 'assistant', content: data.content });
                if (data.remaining !== undefined) { this.dailyQuota = data.remaining; this.updateQuotaDisplay(); }
                this.saveConversation(message.slice(0, 50));
            } else {
                this.addMessage('错误: ' + (data.error || '请求失败'), 'error');
            }
        } catch (e) { this.removeLoadingMessage(); this.addMessage('网络错误，请检查连接', 'error'); }
        finally { this.isLoading = false; this.elements.sendBtn.disabled = false; }
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
    openAPI() { this.elements.tokenDisplay.textContent = this.currentToken ? this.currentToken : '请先登录获取 Token'; this.openModal('apiModal'); }
    copyToken() { if (this.currentToken) { navigator.clipboard.writeText(this.currentToken); this.showToast('Token 已复制', 'success'); } }
    showToast(message, type = 'success') { const toast = this.elements.toast; toast.textContent = message; toast.className = `toast ${type} show`; setTimeout(() => { toast.classList.remove('show'); }, 3000); }
}

document.addEventListener('DOMContentLoaded', () => { window.alphaAI = new AlphaAI(); });
