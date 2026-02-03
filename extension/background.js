// Request Record - Background Service Worker
// Chrome Extension V3

let isRecording = false;
let recordedRequests = [];
let domainFilters = [];
let isInitialized = false;

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

// 监听请求头 - 添加 extraHeaders 以捕获 Cookie、Authorization 等敏感头
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
  ["requestHeaders", "extraHeaders"]
);

// 监听响应头 - 添加 extraHeaders 以捕获 Set-Cookie 等敏感头
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
  ["responseHeaders", "extraHeaders"]
);

// 保存请求到存储
function saveRequests() {
  chrome.storage.local.set({ recordedRequests: recordedRequests });
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 确保状态已初始化
  if (!isInitialized) {
    initializeState().then(() => {
      handleMessage(message, sendResponse);
    });
    return true; // 异步响应
  }
  
  handleMessage(message, sendResponse);
  return true; // 保持消息通道打开
});

// 处理消息的实际逻辑
function handleMessage(message, sendResponse) {
  switch (message.action) {
    case 'getState':
      // 每次获取状态时，先从storage刷新过滤器数据确保最新
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
      chrome.storage.local.set({ recordedRequests: [] });
      sendResponse({ success: true });
      break;

    case 'setFilters':
      domainFilters = message.filters || [];
      chrome.storage.local.set({ domainFilters: domainFilters }, () => {
        console.log('Filters saved:', domainFilters);
        sendResponse({ success: true });
      });
      break;

    case 'clearFilters':
      domainFilters = [];
      chrome.storage.local.set({ domainFilters: [] }, () => {
        console.log('Filters cleared');
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
