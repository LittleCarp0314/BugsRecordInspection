// popup.js
document.addEventListener('DOMContentLoaded', function () {
    console.log("Popup DOM fully loaded and parsed");

    // Get references to UI elements
    const excelFileUpload = document.getElementById('excelFileUpload');
    const ragflowUrlInput = document.getElementById('ragflowUrl');
    const scanJiraButton = document.getElementById('scanJiraButton');
    const manualDefectInput = document.getElementById('manualDefectInput');
    const llmTypeSelect = document.getElementById('llmType');
    const modelUrlInput = document.getElementById('modelUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const testConnectionButton = document.getElementById('testConnectionButton');
    const startDetectionButton = document.getElementById('startDetectionButton');
    const resultArea = document.getElementById('resultArea');

    // Store for defect standards and data
    let defectStandards = null;
    let currentDefectData = null;
    let llmConfig = {
        type: llmTypeSelect.value,
        url: modelUrlInput.value,
        apiKey: apiKeyInput.value
    };

    // Helper to update result area and log
    function showStatus(message, isError = false) {
        console.log(isError ? "Error:" : "Status:", message);
        resultArea.textContent = message;
        resultArea.className = isError ? 'error' : 'success'; // For potential styling
    }

    // Helper to disable/enable buttons
    function setButtonsDisabled(disabled) {
        scanJiraButton.disabled = disabled;
        testConnectionButton.disabled = disabled;
        startDetectionButton.disabled = disabled;
        excelFileUpload.disabled = disabled;
        ragflowUrlInput.disabled = disabled;
    }

    // --- Event Listeners ---

    excelFileUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showStatus(`处理文件 "${file.name}"...`);
            setButtonsDisabled(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // SIMULATE EXCEL PARSING
                    // In a real scenario, use SheetJS/XLSX library here:
                    // const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    // const firstSheetName = workbook.SheetNames[0];
                    // const worksheet = workbook.Sheets[firstSheetName];
                    // const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    // For now, we'll use a simplified mock structure based on file content.
                    if (file.name.toLowerCase().includes("empty")) {
                         throw new Error("模拟错误：Excel文件内容为空或格式不正确。");
                    }
                    defectStandards = {
                        source: 'excel',
                        fileName: file.name,
                        rules: [
                            `规则来自 ${file.name} (模拟): 标题清晰。`,
                            `规则来自 ${file.name} (模拟): 描述包含步骤。`
                        ]
                    };
                    console.log("Mock defect standards from Excel:", defectStandards);
                    showStatus(`"${file.name}" 中的规范已加载（模拟）。`);
                } catch (parseError) {
                    console.error("Error parsing Excel (mock):", parseError);
                    showStatus(`解析Excel文件 "${file.name}" 出错: ${parseError.message}`, true);
                    defectStandards = null;
                } finally {
                    setButtonsDisabled(false);
                    excelFileUpload.value = ""; // Reset file input
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading file:", e);
                showStatus(`读取文件 "${file.name}" 时出错。`, true);
                defectStandards = null;
                setButtonsDisabled(false);
                excelFileUpload.value = ""; // Reset file input
            };
            // For real Excel, use reader.readAsArrayBuffer(file) or reader.readAsBinaryString(file);
            reader.readAsText(file); // Reading as text for simplified mock parsing
        }
    });

    ragflowUrlInput.addEventListener('blur', (event) => {
        const url = event.target.value.trim();
        if (url) {
            defectStandards = { source: 'ragflow', url: url, rules: [] };
            showStatus(`RAGflow URL 已设置。规范将从此链接获取。`);
        } else if (defectStandards && defectStandards.source === 'ragflow') {
            defectStandards = null; // Clear if URL is removed
            showStatus("RAGflow URL 已清除。");
        }
    });

    scanJiraButton.addEventListener('click', () => {
        showStatus("正在扫描Jira页面...");
        setButtonsDisabled(true);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                showStatus("错误：未找到活动标签页。", true);
                setButtonsDisabled(false);
                return;
            }
            const activeTab = tabs[0];
            if (!activeTab.id) {
                showStatus("错误：活动标签页没有ID。", true);
                setButtonsDisabled(false);
                return;
            }

            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content_script.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    showStatus(`注入内容脚本错误: ${chrome.runtime.lastError.message}.`, true);
                    setButtonsDisabled(false);
                    return;
                }
                chrome.tabs.sendMessage(activeTab.id, { action: "scanJiraPage" }, (response) => {
                    setButtonsDisabled(false);
                    if (chrome.runtime.lastError) {
                        showStatus(`扫描Jira页面错误: ${chrome.runtime.lastError.message}. 请确保Jira页面已打开并刷新。`, true);
                        currentDefectData = null;
                        return;
                    }
                    if (response && response.status === "success") {
                        currentDefectData = response.data;
                        let formattedData = "";
                        for (const key in response.data) {
                            formattedData += `${key}: ${response.data[key]}\n`;
                        }
                        manualDefectInput.value = formattedData.trim();
                        showStatus("Jira页面数据已成功扫描并填充。");
                    } else {
                        showStatus(`扫描Jira页面失败: ${response ? response.message : "无响应或脚本未加载。请刷新Jira页面。"}`, true);
                        currentDefectData = null;
                    }
                });
            });
        });
    });

    manualDefectInput.addEventListener('blur', (event) => {
        const text = event.target.value.trim();
        if (text) {
            currentDefectData = { description: text, source: "manual" };
            console.log("Manual defect data updated:", currentDefectData);
        } else if (currentDefectData && currentDefectData.source === "manual") {
            currentDefectData = null;
        }
    });

    llmTypeSelect.addEventListener('change', (e) => llmConfig.type = e.target.value);
    modelUrlInput.addEventListener('input', (e) => llmConfig.url = e.target.value.trim());
    apiKeyInput.addEventListener('input', (e) => llmConfig.apiKey = e.target.value); // API keys can have spaces

    testConnectionButton.addEventListener('click', async () => {
        if (!llmConfig.url) {
            showStatus("错误：模型URL不能为空。", true);
            return;
        }
        // API key might be optional for some public models, but usually required.
        // For this example, let's make it required for testing.
        if (!llmConfig.apiKey) {
            showStatus("错误：API Key不能为空。", true);
            return;
        }
        showStatus(`正在测试连接到 ${llmConfig.url}...`);
        setButtonsDisabled(true);

        try {
            // MOCK API CALL
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
            if (llmConfig.url.includes("success")) { // Simulate success
                showStatus("模拟连接成功！");
            } else if (llmConfig.url.includes("fail")) { // Simulate server error
                throw new Error("模拟连接失败 (服务器响应错误)");
            } else if (!llmConfig.url.startsWith("http")) { // Simulate client-side validation
                 throw new Error("无效的URL格式 (必须以 http 或 https 开头)");
            } else { // Default mock success
                showStatus("模拟连接成功！ (默认)");
            }
        } catch (error) {
            console.error("Test connection failed:", error);
            showStatus(`连接失败: ${error.message}`, true);
        } finally {
            setButtonsDisabled(false);
        }
    });

    startDetectionButton.addEventListener('click', async () => {
        if (!defectStandards) {
            showStatus("错误：请先上传或链接缺陷记录规范。", true);
            return;
        }
        if (!currentDefectData) {
            const manualText = manualDefectInput.value.trim();
            if (manualText) {
                currentDefectData = { description: manualText, source: "manual_at_detection" };
            } else {
                showStatus("错误：请输入或扫描缺陷描述。", true);
                return;
            }
        }
        if (!llmConfig.url || !llmConfig.apiKey) {
            showStatus("错误：请配置有效的模型URL和API Key。", true);
            return;
        }

        showStatus("开始检测...");
        setButtonsDisabled(true);

        try {
            let rulesToUse = defectStandards.rules;
            if (defectStandards.source === 'ragflow') {
                showStatus("正在从RAGflow获取规范（模拟）...");
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate RAGflow fetch
                if (defectStandards.url.includes("error")) {
                    throw new Error("模拟RAGflow获取规范失败。");
                }
                rulesToUse = [
                    `RAGflow规则 (来自 ${defectStandards.url}): 标题应包含模块名。`,
                    `RAGflow规则: 必须附带截图或日志。`
                ];
                console.log("Mock RAGflow rules fetched:", rulesToUse);
                showStatus("RAGflow规范（模拟）已获取。");
            }

            showStatus("正在发送到大模型进行分析（模拟）...");
            const prompt = `根据以下规范: ${rulesToUse.join('; ')}. 分析此缺陷: ${JSON.stringify(currentDefectData)}`;
            console.log("Constructed prompt:", prompt);

            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM call

            if (currentDefectData.description && currentDefectData.description.toLowerCase().includes("llmerror")) {
                throw new Error("模拟LLM处理时发生内部错误。");
            }

            const mockLLMResponse = {
                isStandard: Math.random() > 0.4,
                analysis: `分析 (${new Date().toLocaleTimeString()}):
- 标题符合要求。
- 描述完整性: ${Math.random() > 0.5 ? '良好' : '有待改进'}。
- 严重性: ${Math.random() > 0.5 ? '已指定' : '未指定 (不规范)'}。`
            };

            resultArea.innerHTML = `
                <strong>检测结论:</strong> ${mockLLMResponse.isStandard ? '规范' : '<span style="color:red;">不规范</span>'}
                <br>
                <strong>分析理由:</strong> <pre>${mockLLMResponse.analysis}</pre>
            `;
            // No 'success' class for innerHTML, rely on content.
            resultArea.className = ''; // Clear previous status classes
            console.log("Mock LLM Response:", mockLLMResponse);

        } catch (error) {
            console.error("Detection failed:", error);
            showStatus(`检测失败: ${error.message}`, true);
        } finally {
            setButtonsDisabled(false);
        }
    });

    // Initial state update
    showStatus("插件已加载。请配置规范和缺陷信息。");
    console.log("Event listeners and refined LLM interaction logic attached.");
});

// Add to styles.css for error/success messages if not already present
/*
.error { color: red; font-weight: bold; }
.success { color: green; }
#resultArea pre { white-space: pre-wrap; word-wrap: break-word; }
*/
