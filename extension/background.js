// Request Record - Background Service Worker
// Chrome Extension V3

let isRecording = false;
let recordedRequests = [];
let domainFilters = [];

// 静态资源文件扩展名列表
const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.otf', '.map', '.webp', '.mp3', '.mp4', '.avi', '.mov', '.webm',
  '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz'
];

// 静态资源MIME类型
const STATIC_MIME_TYPES = [
  'text/css', 'text/javascript', 'application/javascript', 'application/x-javascript',
  'image/', 'font/', 'audio/', 'video/'
];

// 初始化时加载保存的数据
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['isRecording', 'recordedRequests', 'domainFilters'], (result) => {
    isRecording = result.isRecording || false;
    recordedRequests = result.recordedRequests || [];
    domainFilters = result.domainFilters || [];
  });
});

// 启动时加载数据
chrome.storage.local.get(['isRecording', 'recordedRequests', 'domainFilters'], (result) => {
  isRecording = result.isRecording || false;
  recordedRequests = result.recordedRequests || [];
  domainFilters = result.domainFilters || [];
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

// 监听网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return; // 忽略非标签页请求
    if (isStaticResource(details.url)) return;
    if (!matchesDomainFilter(details.url)) return;

    const request = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      url: details.url,
      method: details.method,
      type: details.type,
      timestamp: new Date().toISOString(),
      tabId: details.tabId,
      requestBody: null,
      requestHeaders: [],
      responseHeaders: [],
      statusCode: null
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
      r.url === details.url && 
      r.tabId === details.tabId &&
      !r.requestHeaders.length
    );
    
    if (request && details.requestHeaders) {
      request.requestHeaders = details.requestHeaders;
      saveRequests();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// 监听响应头
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!isRecording) return;
    if (details.tabId < 0) return;
    if (isStaticResource(details.url)) return;

    const request = recordedRequests.find(r => 
      r.url === details.url && 
      r.tabId === details.tabId &&
      !r.responseHeaders.length
    );
    
    if (request) {
      request.responseHeaders = details.responseHeaders || [];
      request.statusCode = details.statusCode;
      saveRequests();
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// 保存请求到存储
function saveRequests() {
  chrome.storage.local.set({ recordedRequests: recordedRequests });
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
      sendResponse({
        isRecording: isRecording,
        requests: recordedRequests,
        filters: domainFilters
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
      chrome.storage.local.set({ recordedRequests: [] });
      sendResponse({ success: true });
      break;

    case 'setFilters':
      domainFilters = message.filters;
      chrome.storage.local.set({ domainFilters: domainFilters });
      sendResponse({ success: true });
      break;

    case 'clearFilters':
      domainFilters = [];
      chrome.storage.local.set({ domainFilters: [] });
      sendResponse({ success: true });
      break;

    case 'exportRequests':
      sendResponse({ requests: recordedRequests });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true; // 保持消息通道打开
});
