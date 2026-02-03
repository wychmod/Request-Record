// Request Record - Popup Script

class RequestRecordApp {
  constructor() {
    this.isRecording = false;
    this.requests = [];
    this.filters = [];
    this.searchQuery = '';
    this.copyDataStore = new Map(); // 用于存储复制数据，避免HTML转义问题
    
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    await this.loadState();
    this.render();
  }

  bindElements() {
    this.recordBtn = document.getElementById('recordBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.filterBtn = document.getElementById('filterBtn');
    this.searchInput = document.getElementById('searchInput');
    this.requestList = document.getElementById('requestList');
    this.requestCount = document.getElementById('requestCount');
    this.filterPanel = document.getElementById('filterPanel');
    this.filterInput = document.getElementById('filterInput');
    this.addFilterBtn = document.getElementById('addFilterBtn');
    this.filterTags = document.getElementById('filterTags');
    this.clearFiltersBtn = document.getElementById('clearFiltersBtn');
    this.closeFilterBtn = document.getElementById('closeFilterBtn');
    this.detailDrawer = document.getElementById('detailDrawer');
    this.detailContent = document.getElementById('detailContent');
    this.closeDrawerBtn = document.getElementById('closeDrawerBtn');
  }

  bindEvents() {
    // 录制控制
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    
    // 清除记录
    this.clearBtn.addEventListener('click', () => this.clearRequests());
    
    // 导出
    this.exportBtn.addEventListener('click', () => this.exportRequests());
    
    // 过滤器
    this.filterBtn.addEventListener('click', () => this.toggleFilterPanel());
    this.closeFilterBtn.addEventListener('click', () => this.toggleFilterPanel());
    this.addFilterBtn.addEventListener('click', () => this.addFilter());
    this.filterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addFilter();
    });
    this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    
    // 搜索
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderRequestList();
    });
    
    // 抽屉
    this.closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    this.detailDrawer.querySelector('.drawer-overlay').addEventListener('click', () => this.closeDrawer());
  }

  async loadState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
        if (response) {
          this.isRecording = response.isRecording;
          this.requests = response.requests || [];
          this.filters = response.filters || [];
        }
        resolve();
      });
    });
  }

  render() {
    this.updateRecordButton();
    this.updateRequestCount();
    this.renderRequestList();
    this.renderFilterTags();
  }

  updateRecordButton() {
    if (this.isRecording) {
      this.recordBtn.classList.add('recording');
      this.recordBtn.querySelector('.btn-text').textContent = '停止记录';
    } else {
      this.recordBtn.classList.remove('recording');
      this.recordBtn.querySelector('.btn-text').textContent = '开始记录';
    }
  }

  updateRequestCount() {
    this.requestCount.textContent = this.requests.length;
  }

  async toggleRecording() {
    const action = this.isRecording ? 'stopRecording' : 'startRecording';
    
    chrome.runtime.sendMessage({ action }, (response) => {
      if (response && response.success) {
        this.isRecording = !this.isRecording;
        this.updateRecordButton();
      }
    });
  }

  async clearRequests() {
    if (this.requests.length === 0) return;
    
    if (confirm('确定要清除所有记录吗？')) {
      chrome.runtime.sendMessage({ action: 'clearRequests' }, (response) => {
        if (response && response.success) {
          this.requests = [];
          this.updateRequestCount();
          this.renderRequestList();
        }
      });
    }
  }

  exportRequests() {
    if (this.requests.length === 0) {
      alert('没有可导出的请求记录');
      return;
    }

    const filteredRequests = this.getFilteredRequests();
    const exportData = {
      exportTime: new Date().toISOString(),
      totalRequests: filteredRequests.length,
      requests: filteredRequests.map(req => ({
        url: req.url,
        method: req.method,
        timestamp: req.timestamp,
        statusCode: req.statusCode,
        requestHeaders: req.requestHeaders,
        responseHeaders: req.responseHeaders,
        requestBody: req.requestBody
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-record-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleFilterPanel() {
    this.filterPanel.classList.toggle('hidden');
  }

  addFilter() {
    const filter = this.filterInput.value.trim();
    if (filter && !this.filters.includes(filter)) {
      this.filters.push(filter);
      chrome.runtime.sendMessage({ action: 'setFilters', filters: this.filters }, () => {
        this.renderFilterTags();
        this.filterInput.value = '';
      });
    }
  }

  removeFilter(filter) {
    this.filters = this.filters.filter(f => f !== filter);
    chrome.runtime.sendMessage({ action: 'setFilters', filters: this.filters }, () => {
      this.renderFilterTags();
    });
  }

  clearFilters() {
    this.filters = [];
    chrome.runtime.sendMessage({ action: 'clearFilters' }, () => {
      this.renderFilterTags();
    });
  }

  renderFilterTags() {
    this.filterTags.innerHTML = this.filters.map(filter => `
      <span class="filter-tag">
        ${this.escapeHtml(filter)}
        <span class="remove" data-filter="${this.escapeHtml(filter)}">&times;</span>
      </span>
    `).join('');

    this.filterTags.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeFilter(e.target.dataset.filter);
      });
    });
  }

  getFilteredRequests() {
    let filtered = [...this.requests];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.url.toLowerCase().includes(query) ||
        req.method.toLowerCase().includes(query)
      );
    }

    return filtered.reverse(); // 最新的在前面
  }

  renderRequestList() {
    const filtered = this.getFilteredRequests();

    if (filtered.length === 0) {
      this.requestList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <p>${this.searchQuery ? '没有匹配的请求' : '点击"开始记录"捕获HTTP请求'}</p>
        </div>
      `;
      return;
    }

    this.requestList.innerHTML = filtered.map(req => {
      const urlParts = this.getDisplayUrl(req.url);
      return `
        <div class="request-item" data-id="${req.id}">
          <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
          <div class="request-info">
            <div class="request-url-wrapper">
              <div class="request-pathname">${this.escapeHtml(urlParts.pathname)}</div>
              ${urlParts.queryParams ? `<div class="request-query">${this.escapeHtml(urlParts.queryParams)}</div>` : ''}
            </div>
            <div class="request-meta">
              <span>${this.formatTime(req.timestamp)}</span>
              ${req.statusCode ? `<span class="status-badge ${this.getStatusClass(req.statusCode)}">${req.statusCode}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.requestList.querySelectorAll('.request-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const request = this.requests.find(r => r.id === id);
        if (request) {
          this.showDetail(request);
        }
      });
    });
  }

  // 解析URL，分离pathname和查询参数
  getDisplayUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        pathname: url || '(无URL)',
        queryParams: ''
      };
    }
    
    try {
      const urlObj = new URL(url);
      // 显示 host + pathname 以便更清晰识别请求
      const pathname = urlObj.host + urlObj.pathname;
      const search = urlObj.search;
      
      // 如果有查询参数，格式化显示
      let queryParams = '';
      if (search && search.length > 1) {
        // 移除开头的 ? 并格式化参数
        queryParams = search.substring(1);
      }
      
      return {
        pathname: pathname,
        queryParams: queryParams
      };
    } catch (e) {
      // URL解析失败，直接显示原始URL
      return {
        pathname: url,
        queryParams: ''
      };
    }
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  getStatusClass(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode >= 300 && statusCode < 400) return 'redirect';
    return 'error';
  }

  // 生成唯一的复制数据ID
  generateCopyId() {
    return 'copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 存储复制数据并返回ID
  storeCopyData(data) {
    const id = this.generateCopyId();
    this.copyDataStore.set(id, data);
    return id;
  }

  showDetail(request) {
    // 清空之前的复制数据存储
    this.copyDataStore.clear();
    
    this.detailContent.innerHTML = this.renderDetailContent(request);
    this.detailDrawer.classList.remove('hidden');
    
    // 绑定复制按钮事件
    this.bindCopyEvents();
  }

  // 绑定所有复制按钮事件
  bindCopyEvents() {
    this.detailContent.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(btn);
      });
    });
  }

  renderDetailContent(request) {
    // 存储URL复制数据
    const urlCopyId = this.storeCopyData(request.url);
    
    // 存储请求头复制数据（格式化为 key: value 形式）
    const headersText = request.requestHeaders && request.requestHeaders.length > 0 
      ? request.requestHeaders.map(h => `${h.name}: ${h.value}`).join('\n')
      : '';
    const headersCopyId = this.storeCopyData(headersText);
    
    // 存储响应头复制数据
    const responseHeadersText = request.responseHeaders && request.responseHeaders.length > 0
      ? request.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\n')
      : '';
    const responseHeadersCopyId = this.storeCopyData(responseHeadersText);
    
    // 测试数据
    const testData = this.getTestData(request);
    const testDataJson = JSON.stringify(testData, null, 2);
    const testDataCopyId = this.storeCopyData(testDataJson);

    return `
      <!-- 基本信息 -->
      <div class="detail-section">
        <div class="detail-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <path d="M13 2v7h7"/>
          </svg>
          基本信息
        </div>
        <div class="detail-item">
          <span class="detail-label">请求方法</span>
          <span class="detail-value"><span class="method-badge ${request.method.toLowerCase()}">${request.method}</span></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">状态码</span>
          <span class="detail-value">${request.statusCode || 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">时间</span>
          <span class="detail-value">${new Date(request.timestamp).toLocaleString('zh-CN')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">完整URL</span>
          <span class="detail-value url">${this.escapeHtml(request.url)}</span>
        </div>
        <button class="copy-btn" data-copy-id="${urlCopyId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          复制URL
        </button>
      </div>

      <!-- 请求头 -->
      <div class="detail-section">
        <div class="detail-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          请求头 (Request Headers)
          ${request.requestHeaders && request.requestHeaders.length > 0 ? `<span class="header-count">${request.requestHeaders.length}项</span>` : ''}
        </div>
        ${this.renderHeadersList(request.requestHeaders, 'request')}
        ${request.requestHeaders && request.requestHeaders.length > 0 ? `
          <div class="copy-all-wrapper">
            <button class="copy-btn copy-all-btn" data-copy-id="${headersCopyId}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              复制全部请求头
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 请求体 -->
      <div class="detail-section">
        <div class="detail-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <path d="M14 2v6h6"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          请求体 (Request Body)
        </div>
        ${this.renderRequestBody(request.requestBody)}
      </div>

      <!-- 响应头 -->
      <div class="detail-section">
        <div class="detail-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <path d="M22 4L12 14.01l-3-3"/>
          </svg>
          响应头 (Response Headers)
          ${request.responseHeaders && request.responseHeaders.length > 0 ? `<span class="header-count">${request.responseHeaders.length}项</span>` : ''}
        </div>
        ${this.renderHeadersList(request.responseHeaders, 'response')}
        ${request.responseHeaders && request.responseHeaders.length > 0 ? `
          <div class="copy-all-wrapper">
            <button class="copy-btn copy-all-btn" data-copy-id="${responseHeadersCopyId}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              复制全部响应头
            </button>
          </div>
        ` : ''}
      </div>

      <!-- 自动化测试数据 -->
      <div class="detail-section">
        <div class="detail-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          自动化测试数据 (JSON)
        </div>
        <div class="code-block">${this.escapeHtml(testDataJson)}</div>
        <button class="copy-btn" data-copy-id="${testDataCopyId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          复制测试数据
        </button>
      </div>
    `;
  }

  // 渲染请求头列表 - 每个头单独一行，支持单独复制
  renderHeadersList(headers, type) {
    if (!headers || headers.length === 0) {
      return '<p class="no-results">无请求头信息</p>';
    }

    // 关键请求头高亮显示
    const importantHeaders = ['cookie', 'authorization', 'content-type', 'user-agent', 'accept', 'origin', 'referer', 'x-requested-with', 'set-cookie'];

    return `
      <div class="headers-list">
        ${headers.map(h => {
          const isImportant = importantHeaders.includes(h.name.toLowerCase());
          const copyId = this.storeCopyData(`${h.name}: ${h.value}`);
          const valueCopyId = this.storeCopyData(h.value);
          
          return `
            <div class="header-list-item ${isImportant ? 'important' : ''}">
              <div class="header-content">
                <span class="header-name">${this.escapeHtml(h.name)}</span>
                <span class="header-value">${this.escapeHtml(h.value)}</span>
              </div>
              <div class="header-actions">
                <button class="copy-btn-mini" data-copy-id="${valueCopyId}" title="复制值">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderRequestBody(body) {
    if (!body) {
      return '<p class="no-results">无请求体</p>';
    }

    let content = '';
    let displayContent = '';
    
    if (body.type === 'formData') {
      content = JSON.stringify(body.data, null, 2);
      displayContent = content;
    } else if (body.type === 'raw') {
      try {
        const parsed = JSON.parse(body.data);
        content = JSON.stringify(parsed, null, 2);
        displayContent = content;
      } catch {
        content = body.data;
        displayContent = body.data;
      }
    }

    const bodyCopyId = this.storeCopyData(content);

    return `
      <div class="code-block">${this.escapeHtml(displayContent)}</div>
      <button class="copy-btn" data-copy-id="${bodyCopyId}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        复制请求体
      </button>
    `;
  }

  getTestData(request) {
    let urlObj;
    try {
      urlObj = new URL(request.url);
    } catch {
      return { url: request.url, method: request.method };
    }
    
    const queryParams = {};
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const result = {
      method: request.method,
      url: request.url,
      path: urlObj.pathname,
      host: urlObj.host
    };

    if (Object.keys(queryParams).length > 0) {
      result.queryParams = queryParams;
    }

    if (request.requestHeaders && request.requestHeaders.length > 0) {
      result.headers = request.requestHeaders.reduce((acc, h) => {
        acc[h.name] = h.value;
        return acc;
      }, {});
    }

    if (request.requestBody) {
      if (request.requestBody.type === 'formData') {
        result.body = request.requestBody.data;
      } else if (request.requestBody.type === 'raw') {
        try {
          result.body = JSON.parse(request.requestBody.data);
        } catch {
          result.body = request.requestBody.data;
        }
      }
    }

    return result;
  }

  closeDrawer() {
    this.detailDrawer.classList.add('hidden');
  }

  // 改进的复制功能 - 从存储中获取原始数据
  copyToClipboard(btn) {
    const copyId = btn.dataset.copyId;
    const text = this.copyDataStore.get(copyId);
    
    if (!text) {
      console.error('复制数据未找到:', copyId);
      return;
    }

    // 使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => this.showCopySuccess(btn))
        .catch(err => {
          console.error('Clipboard API 失败:', err);
          this.fallbackCopy(text, btn);
        });
    } else {
      this.fallbackCopy(text, btn);
    }
  }

  // 备用复制方法 - 使用 execCommand
  fallbackCopy(text, btn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showCopySuccess(btn);
      } else {
        console.error('execCommand 复制失败');
      }
    } catch (err) {
      console.error('execCommand 错误:', err);
    }
    
    document.body.removeChild(textarea);
  }

  // 显示复制成功状态
  showCopySuccess(btn) {
    const originalHtml = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      已复制
    `;
    
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHtml;
    }, 2000);
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new RequestRecordApp();
  window.app = app;
});

// 定期刷新请求列表状态（保持过滤器不变）
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response && window.app) {
      window.app.requests = response.requests || [];
      // 只更新请求计数和列表，不重新渲染过滤器（避免用户输入被打断）
      window.app.updateRequestCount();
      window.app.renderRequestList();
    }
  });
}, 2000);
