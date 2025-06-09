// content_script.js
console.log("缺陷记录规范检测: Content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanJiraPage") {
        console.log("Content script received scanJiraPage request.");
        try {
            const isJira = checkIsJiraPage();
            if (!isJira) {
                sendResponse({ status: "success", isJiraPage: false, data: "This does not appear to be a Jira issue page." });
                return true;
            }
            const defectDataText = extractDefectDataAsText();
            sendResponse({ status: "success", isJiraPage: true, data: defectDataText });
        } catch (error) {
            console.error("Error in content script scanJiraPage:", error);
            sendResponse({ status: "error", message: error.message });
        }
    }
    return true; // Indicates that the response will be sent asynchronously
});

function checkIsJiraPage() {
    // Basic Jira page checks - can be expanded
    const url = window.location.href;
    const title = document.title.toLowerCase();

    // Check for URL patterns typical of Jira
    if (url.includes("atlassian.net/jira") || url.includes("/jira/browse/") || url.includes("/browse/")) {
        return true;
    }
    // Check for presence of Jira-specific elements (example, might need adjustment)
    if (document.querySelector('#jira-issue-header') || document.querySelector('[data-testid*="jira-issue"]') || document.querySelector('meta[name="application-name"][content="JIRA"]')) {
        return true;
    }
    // Check for "jira" in title (less reliable but a fallback)
    if (title.includes("jira")) {
        return true;
    }
    console.log("Jira page check failed for URL:", url, "and title:", title);
    return false;
}

function extractDefectDataAsText() {
    // Placeholder for Jira DOM extraction logic.
    // This function will need to be implemented based on Jira's specific HTML structure
    // to scrape and combine various fields into a single text block.
    // For now, it returns a more detailed block of mock text.

    console.log("Attempting to extract data from page as combined text...");

    // More realistic combined mock text
    const mockDataText = `缺陷标题: [Mock] 用户无法登录系统
缺陷描述: [Mock] 用户尝试使用正确的用户名和密码登录，但系统提示“无效凭据”。此问题在所有浏览器上均可复现。
严重级别: [Mock] High
优先级: [Mock] Highest
环境: [Mock] Production, Windows 10, Chrome 120
复现步骤:
1. [Mock] 打开登录页面。
2. [Mock] 输入有效用户名。
3. [Mock] 输入有效密码。
4. [Mock] 点击登录按钮。
期望结果: [Mock] 用户应成功登录并跳转到仪表板。
实际结果: [Mock] 系统显示“无效凭据”错误，用户无法登录。
报告人: [Mock] 张三 (zhangsan)
经办人: [Mock] 李四 (lisi)
发现难度: [Mock] 容易
模块: [Mock] 登录模块
`;
    // In a real scenario, you would query various DOM elements and assemble this string.
    // For example:
    // const summary = document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]')?.innerText || "";
    // const description = document.querySelector('.jira-issue-view-description')?.innerText || "";
    // ... and so on for other fields, then combine them with labels.

    console.log("Mock combined text data extracted.");
    return mockDataText;
}
