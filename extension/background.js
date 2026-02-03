// Request Record - Background Service Worker
// Chrome Extension V3

let isRecording = false;
let recordedRequests = [];
let domainFilters = [];
let isInitialized = false;
let pendingRequests = new Map(); // 用于跟踪请求开始时间

// 静态资源文件扩展名列表
const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.otf', '.map', '.webp', '.mp3', '.mp4', '.avi', '.mov', '.webm',
  '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz'
];

// 初始化函数 - 从存储加载数据
async function initializeState() {
  if (isInitialized) return;
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['isRecording', 'recordedRequests', 'domainFilters'], (result) => {
      isRecording = result.isRecording || false;
      recordedRequests = result.recordedRequests || [];
      domainFilters = result.domainFilters || [];
      isInitialized = true;
      console.log('State initialized:', { isRecording, requestsCount: recordedRequests.length, filtersCount: domainFilters.length });
      resolve();
    });
  });
}

// 立即初始化
initializeState();

// 安装时也初始化
chrome.runtime.onInstalled.addListener(() => {
  initializeState();
});

// 检查URL是否为静态资源
function isStaticResource(url) {
  const urlLower = url.toLowerCase();
  return STATIC_EXTENSIONS.some(ext => urlLower.includes(ext));
}

// 检查域名是否匹配过滤条件
function matchesDomainFilter(url) {
  if (domainFilters.length === 0) return true;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    return domainFilters.some(filter => hostname.includes(filter));
  } catch {
    return true;
  }
}

// 通知popup更新
function notifyPopup() {
  chrome.runtime.sendMessage({ action: 'stateUpdated' }).catch(() => {
    // popup可能未打开，忽略错误
  });
}

// 监听网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return;
    if (isStaticResource(details.url)) return;
    if (!matchesDomainFilter(details.url)) return;

    const requestId = details.requestId;
    const startTime = Date.now();
    
    // 记录请求开始时间
    pendingRequests.set(requestId, startTime);

    const request = {
      id: requestId + '_' + startTime,
      requestId: requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      timestamp: new Date().toISOString(),
      startTime: startTime,
      endTime: null,
      duration: null,
      tabId: details.tabId,
      requestBody: null,
      requestHeaders: [],
      responseHeaders: [],
      statusCode: null,
      error: null
    };

    // 捕获POST请求体
    if (details.requestBody) {
      if (details.requestBody.formData) {
        request.requestBody = { type: 'formData', data: details.requestBody.formData };
      } else if (details.requestBody.raw) {
        try {
          const decoder = new TextDecoder('utf-8');
          const rawData = details.requestBody.raw.map(item => {
            if (item.bytes) {
              return decoder.decode(item.bytes);
            }
            return '';
          }).join('');
          request.requestBody = { type: 'raw', data: rawData };
        } catch (e) {
          request.requestBody = { type: 'raw', data: '[Binary Data]' };
        }
      }
    }

    recordedRequests.push(request);
    saveRequests();
    notifyPopup();
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// 监听请求头
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return;
    if (isStaticResource(details.url)) return;

    const request = recordedRequests.find(r => 
      r.requestId === details.requestId &&
      !r.requestHeaders.length
    );
    
    if (request && details.requestHeaders) {
      request.requestHeaders = details.requestHeaders;
      saveRequests();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// 监听响应头
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return;
    if (isStaticResource(details.url)) return;

    const request = recordedRequests.find(r => 
      r.requestId === details.requestId &&
      !r.responseHeaders.length
    );
    
    if (request) {
      request.responseHeaders = details.responseHeaders || [];
      request.statusCode = details.statusCode;
      saveRequests();
      notifyPopup();
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// 监听请求完成，记录耗时
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return;
    if (isStaticResource(details.url)) return;

    const request = recordedRequests.find(r => r.requestId === details.requestId);
    
    if (request && !request.endTime) {
      request.endTime = Date.now();
      request.duration = request.endTime - request.startTime;
      pendingRequests.delete(details.requestId);
      saveRequests();
      notifyPopup();
    }
  },
  { urls: ["<all_urls>"] }
);

// 监听请求错误
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!isRecording) return;
    
    const request = recordedRequests.find(r => r.requestId === details.requestId);
    
    if (request && !request.endTime) {
      request.endTime = Date.now();
      request.duration = request.endTime - request.startTime;
      request.error = details.error;
      pendingRequests.delete(details.requestId);
      saveRequests();
      notifyPopup();
    }
  },
  { urls: ["<all_urls>"] }
);

// 保存请求到存储
function saveRequests() {
  // 限制最大存储数量，防止内存溢出
  if (recordedRequests.length > 500) {
    recordedRequests = recordedRequests.slice(-500);
  }
  chrome.storage.local.set({ recordedRequests: recordedRequests });
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isInitialized) {
    initializeState().then(() => {
      handleMessage(message, sendResponse);
    });
    return true;
  }
  
  handleMessage(message, sendResponse);
  return true;
});

// 处理消息的实际逻辑
function handleMessage(message, sendResponse) {
  switch (message.action) {
    case 'getState':
      chrome.storage.local.get(['domainFilters'], (result) => {
        domainFilters = result.domainFilters || [];
        sendResponse({
          isRecording: isRecording,
          requests: recordedRequests,
          filters: domainFilters
        });
      });
      break;

    case 'startRecording':
      isRecording = true;
      chrome.storage.local.set({ isRecording: true });
      sendResponse({ success: true });
      break;

    case 'stopRecording':
      isRecording = false;
      chrome.storage.local.set({ isRecording: false });
      sendResponse({ success: true });
      break;

    case 'clearRequests':
      recordedRequests = [];
      pendingRequests.clear();
      chrome.storage.local.set({ recordedRequests: [] });
      sendResponse({ success: true });
      notifyPopup();
      break;

    case 'deleteRequest':
      const requestId = message.requestId;
      recordedRequests = recordedRequests.filter(r => r.id !== requestId);
      chrome.storage.local.set({ recordedRequests: recordedRequests });
      sendResponse({ success: true });
      notifyPopup();
      break;

    case 'setFilters':
      domainFilters = message.filters || [];
      chrome.storage.local.set({ domainFilters: domainFilters }, () => {
        sendResponse({ success: true });
      });
      break;

    case 'clearFilters':
      domainFilters = [];
      chrome.storage.local.set({ domainFilters: [] }, () => {
        sendResponse({ success: true });
      });
      break;

    case 'exportRequests':
      sendResponse({ requests: recordedRequests });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
}
