// ==UserScript==
// @name         Gemini Solver
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Sends the page text to Gemini and shows the answer
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    let key = GM_getValue('key', '');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    // panel
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#fff;border:1px solid #888;padding:8px;width:250px;font:13px sans-serif;color:#000';

    const keyBtn = document.createElement('button');
    keyBtn.textContent = 'Set key';
    const solveBtn = document.createElement('button');
    solveBtn.textContent = 'Solve';
    const output = document.createElement('div');
    output.style.cssText = 'margin-top:8px;white-space:pre-wrap;max-height:250px;overflow:auto';

    box.append(keyBtn, ' ', solveBtn, output);
    document.body.appendChild(box);

    // set api key
    keyBtn.onclick = function () {
        const newKey = prompt('Gemini API key:', key);
        if (newKey) {
            key = newKey.trim();
            GM_setValue('key', key);
            output.textContent = 'Key saved';
        }
    };

    // get the text on the page
    function getText() {
        const main = document.querySelector('main') || document.body;
        return main.innerText.replace(/\s+/g, ' ').trim().slice(0, 4000);
    }

    // send page to gemini
    solveBtn.onclick = function () {
        if (!key) {
            output.textContent = 'Set your API key first';
            return;
        }

        output.textContent = 'Working...';
        solveBtn.disabled = true;

        const prompt = 'Solve the question on this page. Give only the answer, no explanation. ' +
            'For multiple choice, give the letter and the option.\n\n' + getText();

        GM_xmlhttpRequest({
            method: 'POST',
            url: url + '?key=' + key,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 500,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            }),
            timeout: 30000,
            onload: function (res) {
                solveBtn.disabled = false;
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.error) {
                        output.textContent = 'Error: ' + data.error.message;
                    } else {
                        output.textContent = data.candidates[0].content.parts[0].text.trim();
                    }
                } catch (e) {
                    output.textContent = 'No answer came back, try again';
                }
            },
            onerror: function () {
                solveBtn.disabled = false;
                output.textContent = 'Network error';
            },
            ontimeout: function () {
                solveBtn.disabled = false;
                output.textContent = 'Timed out';
            }
        });
    };
})();
