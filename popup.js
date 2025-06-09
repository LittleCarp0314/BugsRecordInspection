// popup.js
document.addEventListener('DOMContentLoaded', function () {
    console.log("Popup DOM fully loaded and parsed");

    // --- Get references to UI elements ---
    // Main UI
    const excelFileUpload = document.getElementById('excelFileUpload');
    const scanJiraButton = document.getElementById('scanJiraButton');
    const manualDefectInput = document.getElementById('manualDefectInput');
    const startDetectionButton = document.getElementById('startDetectionButton');
    const resultArea = document.getElementById('resultArea');

    // Settings Icons
    const ragflowSettingsButton = document.getElementById('ragflowSettingsButton');
    const llmSettingsButton = document.getElementById('llmSettingsButton');

    // RAGflow Modal Elements
    const ragflowSettingsModal = document.getElementById('ragflowSettingsModal');
    const closeRagflowSettings = document.getElementById('closeRagflowSettings');
    const ragflowUrlInput = document.getElementById('ragflowUrl');
    const ragflowApiKeyInput = document.getElementById('ragflowApiKey');
    const ragflowKbIdInput = document.getElementById('ragflowKbId');
    const saveRagflowSettingsButton = document.getElementById('saveRagflowSettingsButton');

    // LLM Modal Elements
    const llmSettingsModal = document.getElementById('llmSettingsModal');
    const closeLlmSettings = document.getElementById('closeLlmSettings');
    const llmTypeSelect = document.getElementById('llmType');
    const modelUrlInput = document.getElementById('modelUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const testConnectionButton = document.getElementById('testConnectionButton');
    const saveLlmSettingsButton = document.getElementById('saveLlmSettingsButton');

    // --- Configuration Storage ---
    let defectStandards = null;
    let currentDefectData = null;
    let ragflowConfig = { url: "", apiKey: "", kbId: "" };
    let llmConfig = { type: "custom", url: "", apiKey: "" };

    function loadSettings() {
        chrome.storage.local.get(['ragflowConfig', 'llmConfig'], function(items) {
            if (items.ragflowConfig) {
                ragflowConfig = items.ragflowConfig;
                ragflowUrlInput.value = ragflowConfig.url || "";
                ragflowApiKeyInput.value = ragflowConfig.apiKey || "";
                ragflowKbIdInput.value = ragflowConfig.kbId || "";
                console.log("Loaded RAGflow config from storage:", ragflowConfig);
                 // If a RAGflow URL is loaded, set it as the current standard source
                if (ragflowConfig.url) {
                    defectStandards = { source: 'ragflow', ...ragflowConfig, rules: [] }; // rules to be fetched later
                }
            }
            if (items.llmConfig) {
                llmConfig = items.llmConfig;
                modelUrlInput.value = llmConfig.url || "";
                apiKeyInput.value = llmConfig.apiKey || "";
                llmTypeSelect.value = llmConfig.type || "custom";
                console.log("Loaded LLM config from storage:", llmConfig);
            }
        });
    }

    function saveRagflowConfigToStorage() {
        chrome.storage.local.set({ ragflowConfig: ragflowConfig }, function() {
            console.log('RAGflow configuration saved.');
            showStatus("RAGflow配置已保存。", false, ragflowSettingsModal.querySelector('.modal-content'));
        });
    }
    function saveLlmConfigToStorage() {
        chrome.storage.local.set({ llmConfig: llmConfig }, function() {
            console.log('LLM configuration saved.');
            showStatus("大模型配置已保存。", false, llmSettingsModal.querySelector('.modal-content'));
        });
    }

    // --- Helper Functions ---
    function showStatus(message, isError = false, area = resultArea) {
        console.log(isError ? "Error:" : "Status:", message);
        if (area) { // Check if area is defined
            area.textContent = message;
            area.className = isError ? 'error' : 'success';
             if (!isError && area === resultArea) {
                setTimeout(() => {
                    if (area.textContent === message && !area.classList.contains('error')) area.textContent = "";
                }, 3000);
            }
        }
    }

    function setButtonsDisabled(disabled, buttonsToUpdate = [scanJiraButton, startDetectionButton, excelFileUpload /* other main buttons */]) {
        buttonsToUpdate.forEach(btn => { if(btn) btn.disabled = disabled; });
    }

    // --- Modal Logic ---
    ragflowSettingsButton.addEventListener('click', () => ragflowSettingsModal.style.display = 'block');
    closeRagflowSettings.addEventListener('click', () => ragflowSettingsModal.style.display = 'none');
    saveRagflowSettingsButton.addEventListener('click', () => {
        ragflowConfig.url = ragflowUrlInput.value.trim();
        ragflowConfig.apiKey = ragflowApiKeyInput.value; // Keep potential spaces for API keys
        ragflowConfig.kbId = ragflowKbIdInput.value.trim();
        saveRagflowConfigToStorage();
        if (ragflowConfig.url) {
            defectStandards = { source: 'ragflow', ...ragflowConfig, rules: [] };
            showStatus("RAGflow配置已更新。将使用此配置获取规范。", false, resultArea);
        } else if (defectStandards && defectStandards.source === 'ragflow') {
            defectStandards = null; // Clear if URL was removed
        }
        ragflowSettingsModal.style.display = 'none';
    });

    llmSettingsButton.addEventListener('click', () => llmSettingsModal.style.display = 'block');
    closeLlmSettings.addEventListener('click', () => llmSettingsModal.style.display = 'none');
    saveLlmSettingsButton.addEventListener('click', () => {
        llmConfig.type = llmTypeSelect.value;
        llmConfig.url = modelUrlInput.value.trim();
        llmConfig.apiKey = apiKeyInput.value; // Keep potential spaces
        saveLlmConfigToStorage();
        llmSettingsModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == ragflowSettingsModal) ragflowSettingsModal.style.display = 'none';
        if (event.target == llmSettingsModal) llmSettingsModal.style.display = 'none';
    });

    // --- Excel File Upload ---
    excelFileUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showStatus(`正在处理Excel文件 "${file.name}"...`);
            setButtonsDisabled(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    // Ensure XLSX is loaded (it should be, from the script tag in popup.html)
                    if (typeof XLSX === 'undefined') {
                        throw new Error("SheetJS XLSX library not loaded.");
                    }
                    const workbook = XLSX.read(data, { type: 'array' }); // 'array' is often more robust
                    const firstSheetName = workbook.SheetNames[0];
                    if (!firstSheetName) {
                        throw new Error("Excel文件中没有找到工作表。");
                    }
                    const worksheet = workbook.Sheets[firstSheetName];
                    // Assuming rules are in the first column (A)
                    // XLSX.utils.sheet_to_json can convert to array of objects or array of arrays
                    // For array of arrays, then take first element of each inner array:
                    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                    const rules = [];
                    if (sheetData.length > 0) {
                        sheetData.forEach(row => {
                            if (row && row[0] && String(row[0]).trim() !== "") { // Check if row and first cell exist and not empty
                                rules.push(String(row[0]).trim());
                            }
                        });
                    }

                    if (rules.length === 0) {
                        throw new Error("在Excel文件的第一列中没有找到任何规范。");
                    }

                    defectStandards = {
                        source: 'excel',
                        fileName: file.name,
                        rules: rules
                    };
                    console.log("Defect standards from Excel:", defectStandards);
                    showStatus(`从 "${file.name}" 加载了 ${rules.length} 条规范。`);
                } catch (parseError) {
                    console.error("Error parsing Excel:", parseError);
                    showStatus(`解析Excel文件 "${file.name}" 出错: ${parseError.message}`, true);
                    defectStandards = null; // Clear previous standards if parsing failed
                } finally {
                    setButtonsDisabled(false);
                    excelFileUpload.value = ""; // Reset file input to allow re-upload of same file
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading file:", e);
                showStatus(`读取文件 "${file.name}" 时出错。`, true);
                defectStandards = null;
                setButtonsDisabled(false);
                excelFileUpload.value = "";
            };
            reader.readAsArrayBuffer(file); // Use readAsArrayBuffer for XLSX library
        }
    });

    // --- Scan Jira Button (Refined) ---
    scanJiraButton.addEventListener('click', () => {
        showStatus("正在扫描Jira页面...");
        setButtonsDisabled(true, [scanJiraButton, startDetectionButton, excelFileUpload]);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                showStatus("错误：未找到活动标签页。", true);
                setButtonsDisabled(false, [scanJiraButton, startDetectionButton, excelFileUpload]);
                return;
            }
            const activeTab = tabs[0];
            if (!activeTab.id) {
                showStatus("错误：活动标签页没有ID。", true);
                setButtonsDisabled(false, [scanJiraButton, startDetectionButton, excelFileUpload]);
                return;
            }

            // Ensure content script is available
            // No need to inject 'content_script.js' here if it's declared in manifest.json for the target pages.
            // However, programmatic injection can be a fallback or ensure latest version.
            // For simplicity, we assume manifest injection works. If issues arise, executeScript can be added back.

            chrome.tabs.sendMessage(activeTab.id, { action: "scanJiraPage" }, (response) => {
                setButtonsDisabled(false, [scanJiraButton, startDetectionButton, excelFileUpload]);
                if (chrome.runtime.lastError) {
                    console.error("Error sending message to content script:", chrome.runtime.lastError.message);
                    // This error often means the content script isn't on the page or isn't listening.
                    // Could be a non-Jira page if manifest matching is too broad, or script failed to load.
                    showStatus(`扫描Jira页面错误: ${chrome.runtime.lastError.message}. 请确保当前是Jira问题页面并已完全加载，或尝试刷新页面。`, true);
                    currentDefectData = null;
                    return;
                }

                if (response && response.status === "success") {
                    if (!response.isJiraPage) {
                        showStatus("提示：当前页面似乎不是Jira问题页面。扫描功能可能无法正常工作。", false); // Not an error, but a warning
                        manualDefectInput.value = ""; // Clear textarea
                        currentDefectData = null;
                    } else {
                        console.log("Data received from content script:", response.data);
                        manualDefectInput.value = response.data; // Populate with the full text block
                        currentDefectData = { description: response.data, source: "scan" };
                        showStatus("Jira页面数据已成功扫描并填充到文本框。");
                    }
                } else if (response && response.status === "error") {
                    console.error("Content script returned an error:", response.message);
                    showStatus(`扫描Jira页面时出错: ${response.message}`, true);
                    currentDefectData = null;
                } else {
                    console.error("Failed to scan Jira page or no/invalid response:", response);
                    showStatus("扫描失败: 未收到有效响应或内容脚本未正确加载。请刷新Jira页面再试。", true);
                    currentDefectData = null;
                }
            });
        });
    });

    manualDefectInput.addEventListener('blur', (event) => {
        const text = event.target.value.trim();
        if (text) {
            currentDefectData = { description: text, source: "manual" };
        } else if (currentDefectData && currentDefectData.source === "manual") {
            currentDefectData = null;
        }
    });

    // --- LLM Test Connection ---
    testConnectionButton.addEventListener('click', async () => {
        const currentModelUrl = modelUrlInput.value.trim();
        const currentApiKey = apiKeyInput.value;
        const modalContentArea = llmSettingsModal.querySelector('.modal-content');

        if (!currentModelUrl) {
            showStatus("错误：模型URL不能为空。", true, modalContentArea); return;
        }
        if (!currentApiKey) {
            showStatus("错误：API Key不能为空。", true, modalContentArea); return;
        }

        showStatus(`正在测试连接到 ${currentModelUrl}...`, false, modalContentArea);
        setButtonsDisabled(true, [testConnectionButton, saveLlmSettingsButton]);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (currentModelUrl.includes("success")) showStatus("模拟连接成功！", false, modalContentArea);
            else if (currentModelUrl.includes("fail")) throw new Error("模拟连接失败 (服务器响应错误)");
            else if (!currentModelUrl.startsWith("http")) throw new Error("无效的URL格式");
            else showStatus("模拟连接成功！ (默认)", false, modalContentArea);
        } catch (error) {
            showStatus(`连接失败: ${error.message}`, true, modalContentArea);
        } finally {
            setButtonsDisabled(false, [testConnectionButton, saveLlmSettingsButton]);
        }
    });

    // --- Start Detection Button ---
    startDetectionButton.addEventListener('click', async () => {
        if (!defectStandards) {
            showStatus("错误：请先上传Excel规范或配置RAGflow规范。", true); return;
        }
        if (!currentDefectData) {
            const manualText = manualDefectInput.value.trim();
            if (manualText) currentDefectData = { description: manualText, source: "manual_at_detection" };
            else { showStatus("错误：请输入或扫描缺陷描述。", true); return; }
        }
        if (!llmConfig.url || !llmConfig.apiKey) {
            showStatus("错误：请先在设置中配置有效的大模型URL和API Key。", true); return;
        }

        showStatus("开始检测...");
        setButtonsDisabled(true, [startDetectionButton, scanJiraButton, excelFileUpload]);
        try {
            let rulesToUse = [];
            if (defectStandards.source === 'excel') {
                rulesToUse = defectStandards.rules;
            } else if (defectStandards.source === 'ragflow') {
                if (!ragflowConfig.url || !ragflowConfig.apiKey || !ragflowConfig.kbId) {
                     throw new Error("RAGflow配置不完整。请在设置中填写URL, API Key和知识库ID。");
                }
                showStatus("正在从RAGflow获取规范（模拟）...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (ragflowConfig.url.includes("error")) throw new Error("模拟RAGflow获取规范失败。");
                rulesToUse = [
                    `RAGflow (URL: ${ragflowConfig.url}, KB: ${ragflowConfig.kbId}): 标题模块名。`,
                    `RAGflow: 附带截图日志。`
                ];
            }
            if (rulesToUse.length === 0) throw new Error("未能加载任何规范。");

            showStatus("正在发送到大模型进行分析（模拟）...");
            const prompt = `规范: ${rulesToUse.join('; ')}. 缺陷: ${JSON.stringify(currentDefectData)}`;
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (currentDefectData.description.toLowerCase().includes("llmerror")) throw new Error("模拟LLM处理时发生内部错误。");

            const mockLLMResponse = {
                isStandard: Math.random() > 0.4,
                analysis: `分析 (${new Date().toLocaleTimeString()}):
- 标题: ${Math.random() > 0.5 ? '清晰' : '改进'}
- 描述: ${Math.random() > 0.5 ? '良好' : '改进'}
- 严重性: ${Math.random() > 0.5 ? '已指定' : '未指定'}
- 复现步骤: ${Math.random() > 0.5 ? '明确' : '模糊'}`
            };
            resultArea.innerHTML = `<strong>检测结论:</strong> ${mockLLMResponse.isStandard ? '规范' : '<span style="color:red;">不规范</span>'}<br><strong>分析理由:</strong> <pre>${mockLLMResponse.analysis}</pre>`;
            resultArea.className = '';
        } catch (error) {
            showStatus(`${error.message}`, true);
        } finally {
            setButtonsDisabled(false, [startDetectionButton, scanJiraButton, excelFileUpload]);
        }
    });

    // Initial load
    loadSettings(); // Ensure settings are loaded after the rest of the script is parsed.
    showStatus("插件已加载。请配置规范和缺陷信息。", false);
    console.log("Event listeners, modal logic, and improved Excel parsing attached.");
});
