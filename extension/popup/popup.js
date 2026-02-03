// Request Record - Popup Script

class RequestRecordApp {
  constructor() {
    this.isRecording = false;
    this.requests = [];
    this.filters = [];
    this.searchQuery = '';
    this.methodFilter = '';
    this.statusFilter = '';
    this.currentRequestId = null; // 当前查看的请求ID
    this.copyDataStore = new Map(); // 用于存储复制数据，避免HTML转义问题
    
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.setupMessageListener();
    await this.loadState();
    this.render();
  }

  bindElements() {
    this.recordBtn = document.getElementById('recordBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.exportMenu = document.getElementById('exportMenu');
    this.exportJsonBtn = document.getElementById('exportJsonBtn');
    this.exportHarBtn = document.getElementById('exportHarBtn');
    this.filterBtn = document.getElementById('filterBtn');
    this.filterIndicator = document.getElementById('filterIndicator');
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.methodFilterSelect = document.getElementById('methodFilter');
    this.statusFilterSelect = document.getElementById('statusFilter');
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
    this.deleteRequestBtn = document.getElementById('deleteRequestBtn');
  }

  bindEvents() {
    // 录制控制
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    
    // 清除记录
    this.clearBtn.addEventListener('click', () => this.clearRequests());
    
    // 导出下拉菜单
    this.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleExportMenu();
    });
    this.exportJsonBtn.addEventListener('click', () => this.exportRequests('json'));
    this.exportHarBtn.addEventListener('click', () => this.exportRequests('har'));
    
    // 点击其他地方关闭导出菜单
    document.addEventListener('click', () => this.closeExportMenu());
    
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
      this.updateClearSearchBtn();
      this.renderRequestList();
    });
    
    // 清除搜索
    this.clearSearchBtn.addEventListener('click', () => {
      this.searchQuery = '';
      this.searchInput.value = '';
      this.updateClearSearchBtn();
      this.renderRequestList();
    });
    
    // 方法筛选
    this.methodFilterSelect.addEventListener('change', (e) => {
      this.methodFilter = e.target.value;
      this.updateFilterIndicator();
      this.renderRequestList();
    });
    
    // 状态码筛选
    this.statusFilterSelect.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.updateFilterIndicator();
      this.renderRequestList();
    });
    
    // 抽屉
    this.closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    this.detailDrawer.querySelector('.drawer-overlay').addEventListener('click', () => this.closeDrawer());
    
    // 删除单条请求
    this.deleteRequestBtn.addEventListener('click', () => this.deleteCurrentRequest());
  }

  // 设置事件驱动的消息监听
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'stateUpdated') {
        this.refreshRequests();
      }
    });
  }

  // 刷新请求列表（不重新加载整个状态）
  refreshRequests() {
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
      if (response) {
        this.requests = response.requests || [];
        this.updateRequestCount();
        this.renderRequestList();
      }
    });
  }

  // 更新清除搜索按钮显示状态
  updateClearSearchBtn() {
    if (this.searchQuery) {
      this.clearSearchBtn.classList.remove('hidden');
    } else {
      this.clearSearchBtn.classList.add('hidden');
    }
  }

  // 更新过滤器指示器
  updateFilterIndicator() {
    const hasActiveFilters = this.methodFilter || this.statusFilter || this.filters.length > 0;
    if (hasActiveFilters) {
      this.filterIndicator.classList.remove('hidden');
    } else {
      this.filterIndicator.classList.add('hidden');
    }
  }

  // 切换导出菜单
  toggleExportMenu() {
    this.exportMenu.classList.toggle('hidden');
  }

  // 关闭导出菜单
  closeExportMenu() {
    this.exportMenu.classList.add('hidden');
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
    this.updateFilterIndicator();
    this.updateClearSearchBtn();
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

  exportRequests(format = 'json') {
    this.closeExportMenu();
    
    if (this.requests.length === 0) {
      alert('没有可导出的请求记录');
      return;
    }

    const filteredRequests = this.getFilteredRequests();
    
    if (format === 'har') {
      this.exportAsHar(filteredRequests);
    } else {
      this.exportAsJson(filteredRequests);
    }
  }

  // 导出为JSON格式
  exportAsJson(requests) {
    const exportData = {
      exportTime: new Date().toISOString(),
      totalRequests: requests.length,
      requests: requests.map(req => ({
        url: req.url,
        method: req.method,
        timestamp: req.timestamp,
        statusCode: req.statusCode,
        duration: req.duration,
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

  // 导出为HAR格式
  exportAsHar(requests) {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Request Record',
          version: '1.0'
        },
        entries: requests.map(req => this.convertToHarEntry(req))
      }
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-record-${new Date().toISOString().slice(0, 10)}.har`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 将请求转换为HAR条目格式
  convertToHarEntry(req) {
    const startedDateTime = req.timestamp || new Date().toISOString();
    const time = req.duration || 0;

    // 解析URL获取查询参数
    let queryString = [];
    try {
      const urlObj = new URL(req.url);
      urlObj.searchParams.forEach((value, name) => {
        queryString.push({ name, value });
      });
    } catch (e) {}

    // 构建请求体
    let postData = null;
    if (req.requestBody) {
      if (req.requestBody.type === 'formData') {
        postData = {
          mimeType: 'application/x-www-form-urlencoded',
          params: Object.entries(req.requestBody.data || {}).map(([name, value]) => ({
            name,
            value: Array.isArray(value) ? value[0] : value
          }))
        };
      } else if (req.requestBody.type === 'raw') {
        postData = {
          mimeType: this.getContentType(req.requestHeaders) || 'application/json',
          text: req.requestBody.data
        };
      }
    }

    return {
      startedDateTime,
      time,
      request: {
        method: req.method,
        url: req.url,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: (req.requestHeaders || []).map(h => ({ name: h.name, value: h.value })),
        queryString,
        postData,
        headersSize: -1,
        bodySize: postData ? (postData.text || '').length : 0
      },
      response: {
        status: req.statusCode || 0,
        statusText: this.getStatusText(req.statusCode),
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: (req.responseHeaders || []).map(h => ({ name: h.name, value: h.value })),
        content: {
          size: 0,
          mimeType: this.getResponseContentType(req.responseHeaders) || 'text/plain'
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1
      },
      cache: {},
      timings: {
        send: 0,
        wait: time,
        receive: 0
      }
    };
  }

  // 获取请求Content-Type
  getContentType(headers) {
    if (!headers) return null;
    const ct = headers.find(h => h.name.toLowerCase() === 'content-type');
    return ct ? ct.value : null;
  }

  // 获取响应Content-Type
  getResponseContentType(headers) {
    return this.getContentType(headers);
  }

  // 获取状态码文本
  getStatusText(code) {
    const statusTexts = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
      500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
    };
    return statusTexts[code] || '';
  }

  // 生成cURL命令
  generateCurl(request) {
    let curl = `curl '${request.url}'`;
    
    // 添加请求方法（GET以外的需要指定）
    if (request.method !== 'GET') {
      curl += ` \\\n  -X ${request.method}`;
    }
    
    // 添加请求头
    if (request.requestHeaders && request.requestHeaders.length > 0) {
      request.requestHeaders.forEach(header => {
        // 跳过一些自动生成的头
        const skipHeaders = ['host', 'content-length', 'connection'];
        if (!skipHeaders.includes(header.name.toLowerCase())) {
          curl += ` \\\n  -H '${header.name}: ${header.value.replace(/'/g, "\\'")}'`;
        }
      });
    }
    
    // 添加请求体
    if (request.requestBody) {
      if (request.requestBody.type === 'formData') {
        const formData = request.requestBody.data;
        Object.entries(formData).forEach(([key, value]) => {
          const val = Array.isArray(value) ? value[0] : value;
          curl += ` \\\n  --data-urlencode '${key}=${val}'`;
        });
      } else if (request.requestBody.type === 'raw') {
        const data = request.requestBody.data.replace(/'/g, "\\'");
        curl += ` \\\n  --data-raw '${data}'`;
      }
    }
    
    return curl;
  }

  // 删除当前查看的请求
  deleteCurrentRequest() {
    if (!this.currentRequestId) return;
    
    if (confirm('确定要删除此请求吗？')) {
      chrome.runtime.sendMessage({ 
        action: 'deleteRequest', 
        requestId: this.currentRequestId 
      }, (response) => {
        if (response && response.success) {
          this.requests = this.requests.filter(r => r.id !== this.currentRequestId);
          this.closeDrawer();
          this.updateRequestCount();
          this.renderRequestList();
        }
      });
    }
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

    // 搜索过滤
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.url.toLowerCase().includes(query) ||
        req.method.toLowerCase().includes(query)
      );
    }

    // 方法过滤
    if (this.methodFilter) {
      filtered = filtered.filter(req => req.method === this.methodFilter);
    }

    // 状态码过滤
    if (this.statusFilter) {
      filtered = filtered.filter(req => {
        if (!req.statusCode) return false;
        const code = req.statusCode;
        switch (this.statusFilter) {
          case '2xx': return code >= 200 && code < 300;
          case '3xx': return code >= 300 && code < 400;
          case '4xx': return code >= 400 && code < 500;
          case '5xx': return code >= 500 && code < 600;
          default: return true;
        }
      });
    }

    return filtered.reverse(); // 最新的在前面
  }

  // 格式化耗时显示
  formatDuration(duration) {
    if (duration === null || duration === undefined) return null;
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  }

  // 获取耗时等级样式
  getDurationClass(duration) {
    if (duration === null || duration === undefined) return '';
    if (duration < 300) return 'fast';
    if (duration < 1000) return 'medium';
    return 'slow';
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
          <p>${this.searchQuery || this.methodFilter || this.statusFilter ? '没有匹配的请求' : '点击"开始记录"捕获HTTP请求'}</p>
        </div>
      `;
      return;
    }

    this.requestList.innerHTML = filtered.map(req => {
      const urlParts = this.getDisplayUrl(req.url);
      const durationText = this.formatDuration(req.duration);
      const durationClass = this.getDurationClass(req.duration);
      
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
              ${durationText ? `<span class="duration-badge ${durationClass}">${durationText}</span>` : ''}
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
    
    // 存储当前请求ID用于删除操作
    this.currentRequestId = request.id;
    
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
    
    // 生成并存储cURL命令
    const curlCommand = this.generateCurl(request);
    const curlCopyId = this.storeCopyData(curlCommand);
    
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
    
    // 格式化耗时显示
    const durationText = this.formatDuration(request.duration);
    const durationClass = this.getDurationClass(request.duration);

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
          <span class="detail-value">${request.statusCode || 'N/A'}${request.error ? ` <span class="error-text">(${request.error})</span>` : ''}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">时间</span>
          <span class="detail-value">${new Date(request.timestamp).toLocaleString('zh-CN')}</span>
        </div>
        ${durationText ? `
        <div class="detail-item">
          <span class="detail-label">耗时</span>
          <span class="detail-value"><span class="duration-badge ${durationClass}">${durationText}</span></span>
        </div>
        ` : ''}
        <div class="detail-item">
          <span class="detail-label">完整URL</span>
          <span class="detail-value url">${this.escapeHtml(request.url)}</span>
        </div>
        <div class="detail-actions">
          <button class="copy-btn" data-copy-id="${urlCopyId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            复制URL
          </button>
          <button class="copy-btn copy-curl-btn" data-copy-id="${curlCopyId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 9l3 3-3 3"/>
              <path d="M13 15h3"/>
              <rect x="3" y="4" width="18" height="16" rx="2"/>
            </svg>
            复制cURL
          </button>
        </div>
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
    this.currentRequestId = null;
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

// 使用事件驱动更新，不再需要轮询
// background.js 会在请求状态变化时发送 stateUpdated 消息
