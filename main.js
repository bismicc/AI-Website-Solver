// ==UserScript==
// @name         Gemini AI Question Solver
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Send webpage to Gemini AI to solve questions
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    let API_KEY = GM_getValue('gemini_api_key', '');
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

    let solveButton, retryButton, resultDiv, configButton, debugButton;
    let isProcessing = false;
    let lastResponse = null;

    function createUI() {
        const container = document.createElement('div');
        container.id = 'gemini-solver-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #fff;
            border: 2px solid #4285f4;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: Arial, sans-serif;
            max-width: 350px;
            min-width: 280px;
        `;

        configButton = document.createElement('button');
        configButton.textContent = API_KEY ? 'Config' : 'Set API Key';
        configButton.style.cssText = `
            background: #34a853;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-bottom: 10px;
            width: 100%;
        `;
        configButton.onclick = showConfigModal;

        solveButton = document.createElement('button');
        solveButton.textContent = 'Solve Question';
        solveButton.style.cssText = `
            background: #4285f4;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            width: 100%;
            margin-bottom: 10px;
        `;
        solveButton.onclick = solveQuestion;

        retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.style.cssText = `
            background: #ea4335;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-bottom: 10px;
            display: none;
        `;
        retryButton.onclick = solveQuestion;

        debugButton = document.createElement('button');
        debugButton.textContent = 'Show Debug Info';
        debugButton.style.cssText = `
            background: #ff9800;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
            margin-bottom: 10px;
            display: none;
        `;
        debugButton.onclick = showDebugInfo;

        resultDiv = document.createElement('div');
        resultDiv.id = 'gemini-result';
        resultDiv.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dadce0;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
            font-size: 13px;
            line-height: 1.4;
            max-height: 300px;
            overflow-y: auto;
            display: none;
        `;

        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = '−';
        minimizeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            width: 20px;
            height: 20px;
        `;
        minimizeBtn.onclick = toggleMinimize;

        container.appendChild(minimizeBtn);
        container.appendChild(configButton);
        container.appendChild(solveButton);
        container.appendChild(retryButton);
        container.appendChild(debugButton);
        container.appendChild(resultDiv);

        document.body.appendChild(container);
    }

    function toggleMinimize() {
        const container = document.getElementById('gemini-solver-container');
        const isMinimized = container.dataset.minimized === 'true';

        if (isMinimized) {
            container.style.height = 'auto';
            Array.from(container.children).forEach(child => {
                if (child.textContent !== '−' && child.textContent !== '+') {
                    child.style.display = child.dataset.originalDisplay || '';
                }
            });
            container.children[0].textContent = '−';
            container.dataset.minimized = 'false';
        } else {
            Array.from(container.children).forEach(child => {
                if (child.textContent !== '−') {
                    child.dataset.originalDisplay = child.style.display;
                    child.style.display = 'none';
                }
            });
            container.style.height = '30px';
            container.children[0].textContent = '+';
            container.children[0].style.display = 'block';
            container.dataset.minimized = 'true';
        }
    }

    function showDebugInfo() {
        if (!lastResponse) {
            showResult('No response data available', 'error');
            return;
        }

        const debugInfo = `
            <strong>Debug Information:</strong><br>
            <pre style="font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(lastResponse, null, 2)}</pre>
        `;
        showResult(debugInfo, 'info');
    }

    function showConfigModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
        `;

        modalContent.innerHTML = `
            <h3 style="margin-top: 0;">Gemini API Configuration</h3>
            <p style="font-size: 14px; color: #666;">Enter your Gemini API key:</p>
            <input type="text" id="api-key-input" placeholder="Your API Key"
                   value="${API_KEY}" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
            <div style="margin-top: 20px;">
                <button id="save-config" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Save</button>
                <button id="cancel-config" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
            <p style="font-size: 12px; color: #888; margin-top: 15px;">
                Get your API key from: <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a>
            </p>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        document.getElementById('save-config').onclick = () => {
            const newApiKey = document.getElementById('api-key-input').value.trim();
            if (newApiKey) {
                API_KEY = newApiKey;
                GM_setValue('gemini_api_key', API_KEY);
                configButton.textContent = 'Config';
                showResult('API key saved successfully!', 'success');
            }
            document.body.removeChild(modal);
        };

        document.getElementById('cancel-config').onclick = () => {
            document.body.removeChild(modal);
        };
    }

    function getPageContent() {
        const contentSelectors = [
            'main',
            '[role="main"]',
            '.content',
            '.main-content',
            '.question',
            '.problem',
            'article',
            '.post-content'
        ];

        let content = '';

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = element.innerText;
                break;
            }
        }

        if (!content) {
            content = document.body.innerText;
        }

        content = content.replace(/\s+/g, ' ').trim();

        if (content.length > 4000) {
            content = content.substring(0, 4000) + '...';
        }

        return content;
    }

    function solveQuestion() {
        if (!API_KEY) {
            showResult('Please set your API key first!', 'error');
            return;
        }

        if (isProcessing) return;

        isProcessing = true;
        solveButton.textContent = 'Processing...';
        solveButton.disabled = true;
        retryButton.style.display = 'none';
        debugButton.style.display = 'none';

        const pageContent = getPageContent();

        const prompt = `Analyze this webpage content and solve any question or problem presented. Provide ONLY the direct answer with no explanations, reasoning, or additional text. If it's a multiple choice question, provide only the letter and correct option. If it's a calculation, provide only the final number. If it's a short answer, provide only the essential answer:

${pageContent}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 200,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }
            ]
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_URL}?key=${API_KEY}`,
            headers: {
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(requestBody),
            onload: function(response) {
                handleResponse(response);
            },
            onerror: function(error) {
                handleError('Network error occurred');
            },
            ontimeout: function() {
                handleError('Request timed out');
            },
            timeout: 30000
        });
    }

    function handleResponse(response) {
        isProcessing = false;
        solveButton.textContent = 'Solve Question';
        solveButton.disabled = false;

        try {
            const data = JSON.parse(response.responseText);
            lastResponse = data;

            // Check for API errors first
            if (data.error) {
                showResult(`API Error: ${data.error.message}`, 'error');
                retryButton.style.display = 'block';
                debugButton.style.display = 'block';
                return;
            }

            // Safely extract the answer with proper null/undefined checks
            if (response.status === 200 &&
                data.candidates &&
                Array.isArray(data.candidates) &&
                data.candidates.length > 0) {

                const candidate = data.candidates[0];

                // Check for content filtering
                if (candidate.finishReason === 'SAFETY') {
                    let safetyMsg = 'Response blocked by safety filters.';
                    if (candidate.safetyRatings) {
                        safetyMsg += '<br><small>Safety ratings: ' +
                            JSON.stringify(candidate.safetyRatings) + '</small>';
                    }
                    showResult(safetyMsg, 'error');
                    retryButton.style.display = 'block';
                    debugButton.style.display = 'block';
                    return;
                }

                // Check for other finish reasons
                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    showResult(`Response finished with reason: ${candidate.finishReason}`, 'error');
                    retryButton.style.display = 'block';
                    debugButton.style.display = 'block';
                    return;
                }

                // Check if content exists
                if (!candidate.content) {
                    showResult('No content in response. Try rewording or simplifying the question.', 'error');
                    retryButton.style.display = 'block';
                    debugButton.style.display = 'block';
                    return;
                }

                // Check if parts exists and is an array
                if (!candidate.content.parts ||
                    !Array.isArray(candidate.content.parts) ||
                    candidate.content.parts.length === 0) {
                    showResult('No answer parts in response. The API may be blocking this content.', 'error');
                    retryButton.style.display = 'block';
                    debugButton.style.display = 'block';
                    return;
                }

                // Check if text exists in the first part
                const firstPart = candidate.content.parts[0];
                if (!firstPart.text) {
                    showResult('No text in response part. Try a different page or question.', 'error');
                    retryButton.style.display = 'block';
                    debugButton.style.display = 'block';
                    return;
                }

                const answer = firstPart.text.trim();
                showResult(`<strong>Answer:</strong> ${answer}`, 'success');
            } else {
                showResult('Invalid response structure from API. Status: ' + response.status, 'error');
                retryButton.style.display = 'block';
                debugButton.style.display = 'block';
            }
        } catch (error) {
            showResult(`Error parsing response: ${error.message}`, 'error');
            retryButton.style.display = 'block';
            debugButton.style.display = 'block';
            console.error('Full error:', error);
            console.error('Response text:', response.responseText);
        }
    }

    function handleError(message) {
        isProcessing = false;
        solveButton.textContent = 'Solve Question';
        solveButton.disabled = false;
        showResult(message, 'error');
        retryButton.style.display = 'block';
        debugButton.style.display = 'block';
    }

    function showResult(message, type) {
        resultDiv.innerHTML = message;
        resultDiv.style.display = 'block';

        if (type === 'success') {
            resultDiv.style.background = '#e8f5e8';
            resultDiv.style.borderColor = '#4caf50';
            resultDiv.style.color = '#2e7d32';
        } else if (type === 'error') {
            resultDiv.style.background = '#ffeaea';
            resultDiv.style.borderColor = '#f44336';
            resultDiv.style.color = '#c62828';
        } else if (type === 'info') {
            resultDiv.style.background = '#e3f2fd';
            resultDiv.style.borderColor = '#2196f3';
            resultDiv.style.color = '#1565c0';
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            createUI();
        }
    }

    init();

})();
