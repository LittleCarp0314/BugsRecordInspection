// content_script.js
console.log("缺陷记录规范检测: Content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanJiraPage") {
        console.log("Content script received scanJiraPage request.");
        try {
            const defectData = extractDefectDataFromPage();
            sendResponse({ status: "success", data: defectData });
        } catch (error) {
            console.error("Error extracting data from Jira page:", error);
            sendResponse({ status: "error", message: error.message });
        }
    }
    return true; // Indicates that the response will be sent asynchronously
});

function extractDefectDataFromPage() {
    // Placeholder for Jira DOM extraction logic
    // This function will need to be implemented based on Jira's specific HTML structure.
    // For now, it will return mock data.

    console.log("Attempting to extract data from page...");

    // Example: Try to get the issue summary (Jira specific selectors will be needed)
    // const summaryElement = document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]'); // Example selector
    // const summary = summaryElement ? summaryElement.innerText : "Summary not found";

    // const descriptionElement = document.querySelector('.jira-issue-view-description'); // Example selector
    // const description = descriptionElement ? descriptionElement.innerText : "Description not found";

    // For now, let's return more comprehensive mock data
    // In a real scenario, you would use DOM selectors to find these elements
    const mockData = {
        summary: "[Mock] 用户无法登录系统", // Defect Title/Summary
        description: "[Mock] 用户尝试使用正确的用户名和密码登录，但系统提示“无效凭据”。此问题在所有浏览器上均可复现。", // Defect Description
        severity: "[Mock] High", // Defect Severity Level
        priority: "[Mock] Highest", // Defect Priority
        environment: "[Mock] Production, Windows 10, Chrome 120", // Environment
        stepsToReproduce: "[Mock] 1. 打开登录页面。
2. 输入有效用户名。
3. 输入有效密码。
4. 点击登录按钮。", // Steps to Reproduce
        expectedResult: "[Mock] 用户应成功登录并跳转到仪表板。", // Expected Result
        actualResult: "[Mock] 系统显示“无效凭据”错误，用户无法登录。", // Actual Result
        reporter: "[Mock] 张三 (zhangsan)", // Reporter
        assignee: "[Mock] 李四 (lisi)", // Assignee
        // Add other fields as necessary, e.g., "发现难度" (Difficulty to Find) if available
    };

    console.log("Mock data extracted:", mockData);
    return mockData;
}
