// DOM 元素
const tabPaste = document.getElementById('tab-paste');
const tabDirect = document.getElementById('tab-direct');
const tabZip = document.getElementById('tab-zip');
const panelPaste = document.getElementById('panel-paste');
const panelDirect = document.getElementById('panel-direct');
const panelZip = document.getElementById('panel-zip');
const dropZones = document.querySelectorAll('.drop-zone');
const fileInputDirect = document.getElementById('file-input-direct');
const fileInputZip = document.getElementById('file-input-zip');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const actionButtons = document.getElementById('action-buttons');
const convertBtn = document.getElementById('convert-btn');
const clearBtn = document.getElementById('clear-btn');
const btnText = document.getElementById('btn-text');
const spinner = document.getElementById('spinner');
const statusMessage = document.getElementById('status-message');
const flattenOption = document.getElementById('flatten-option');
const flattenCheckbox = document.getElementById('flatten-checkbox');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreviewGrid = document.getElementById('image-preview-grid');
const pasteFormat = document.getElementById('paste-format');
const pasteInput = document.getElementById('paste-input');
const pasteConvertBtn = document.getElementById('paste-convert-btn');
const pasteOutput = document.getElementById('paste-output');
const copyLrcBtn = document.getElementById('copy-lrc-btn');
const pasteOutputPlaceholder = document.getElementById('paste-output-placeholder');

// 状态
let filesToProcess = []; // 统一存储待处理文件 { name, getContent }
let loadedZip = null; // 存储上传的 ZIP 对象
let originalInputName = null; // 存储原始输入文件名
let zipImages = []; // { name, mime, base64 }
let selectedCoverImage = null; // { mime, base64 } 或 null

// --- 事件监听 ---

tabPaste.addEventListener('click', () => switchTab('paste'));
tabDirect.addEventListener('click', () => switchTab('direct'));
tabZip.addEventListener('click', () => switchTab('zip'));

if (pasteConvertBtn) {
    pasteConvertBtn.addEventListener('click', convertPasteText);
}

if (copyLrcBtn) {
    copyLrcBtn.addEventListener('click', copyLrcOutput);
}

// 页面加载时恢复上次选择的格式
restoreLastFormat();

dropZones.forEach(zone => {
    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (zone.parentElement.id === 'panel-direct') {
            handleDirectFiles(files);
        } else {
            if (files.length) handleZipFile(files[0]);
        }
    });
});

fileInputDirect.addEventListener('change', e => {
    handleDirectFiles(e.target.files);
});

fileInputZip.addEventListener('change', e => {
    if (e.target.files.length) handleZipFile(e.target.files[0]);
});

convertBtn.addEventListener('click', convertAndDownload);
clearBtn.addEventListener('click', clearFiles);

// --- 基础工具函数 ---

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showStatusMessage(message) {
    statusMessage.textContent = message;
}

function joinZipPath(folder, name) {
    const cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
    const cleanName = String(name || '').replace(/^\/+/g, '');

    if (!cleanFolder) return cleanName;
    if (!cleanName) return cleanFolder;

    return `${cleanFolder}/${cleanName}`;
}

function getBaseName(path) {
    return String(path).split('/').pop();
}

function isVttFile(filename) {
    return /\.vtt$/i.test(filename);
}

function isSrtFile(filename) {
    return /\.srt$/i.test(filename);
}

function isAssFile(filename) {
    return /\.(ass|ssa)$/i.test(filename);
}

function isSubtitleFile(filename) {
    return isVttFile(filename) || isSrtFile(filename) || isAssFile(filename);
}

function isMp3File(filename) {
    return /\.mp3$/i.test(filename);
}

function getFileFormat(filename) {
    if (isSrtFile(filename)) return 'SRT';
    if (isAssFile(filename)) return 'ASS';
    if (isVttFile(filename)) return 'VTT';
    return null;
}

function getFileFormatClass(format) {
    switch (format) {
        case 'SRT': return 'format-srt';
        case 'ASS': return 'format-ass';
        case 'VTT': return 'format-vtt';
        case 'LRC': return 'format-lrc';
        default: return '';
    }
}

function isZipFile(file) {
    if (!file) return false;
    return file.type.includes('zip') || /\.zip$/i.test(file.name);
}

// --- 页面状态 ---

function switchTab(tabName) {
    // 移除所有active状态
    tabPaste.classList.remove('active');
    tabDirect.classList.remove('active');
    tabZip.classList.remove('active');
    panelPaste.classList.remove('active');
    panelDirect.classList.remove('active');
    panelZip.classList.remove('active');

    // 设置当前标签页为active
    if (tabName === 'paste') {
        tabPaste.classList.add('active');
        panelPaste.classList.add('active');
        flattenOption.classList.add('hidden');
    } else if (tabName === 'direct') {
        tabDirect.classList.add('active');
        panelDirect.classList.add('active');
        flattenOption.classList.add('hidden');
    } else {
        tabZip.classList.add('active');
        panelZip.classList.add('active');
        flattenOption.classList.remove('hidden');
    }

    clearFiles();
}

function clearFiles() {
    filesToProcess = [];
    loadedZip = null;
    originalInputName = null;
    zipImages = [];
    selectedCoverImage = null;

    imagePreviewGrid.innerHTML = '';
    imagePreviewContainer.classList.add('hidden');

    // Hide pipeline
    const pipelineContainer = document.getElementById('pipeline-container');
    if (pipelineContainer) pipelineContainer.classList.add('hidden');

    // 清空粘贴输出
    if (pasteOutput) {
        pasteOutput.value = '';
        pasteOutput.classList.add('hidden');
    }
    if (pasteOutputPlaceholder) pasteOutputPlaceholder.classList.remove('hidden');
    if (copyLrcBtn) copyLrcBtn.classList.add('hidden');

    fileInputDirect.value = '';
    fileInputZip.value = '';

    fileList.innerHTML = '';
    fileListContainer.classList.add('hidden');
    actionButtons.classList.add('hidden');

    showStatusMessage('');
    setButtonLoading(false);
}

function setButtonLoading(isLoading) {
    if (isLoading) {
        convertBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        convertBtn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

// --- 文件处理 ---

function handleDirectFiles(inputFileList) {
    clearFiles();

    const subtitleFiles = Array.from(inputFileList).filter(file => isSubtitleFile(file.name));

    if (subtitleFiles.length === 0) {
        showStatusMessage('请选择 .vtt、.srt 或 .ass 文件。');
        return;
    }

    originalInputName = subtitleFiles[0].name;

    filesToProcess = subtitleFiles.map(file => ({
        name: file.name,
        getContent: () => file.text()
    }));

    updateFileListUI();
}

async function handleZipFile(zipFile) {
    if (!isZipFile(zipFile)) {
        showStatusMessage('请上传一个 ZIP 格式的压缩包。');
        return;
    }

    clearFiles();
    originalInputName = zipFile.name;

    try {
        loadedZip = await JSZip.loadAsync(zipFile);

        const subtitleZipEntries = [];
        let hasMp3 = false;

        for (const filename in loadedZip.files) {
            const entry = loadedZip.files[filename];
            if (entry.dir) continue;

            if (isSubtitleFile(filename)) {
                subtitleZipEntries.push(entry);
            }

            if (isMp3File(filename)) {
                hasMp3 = true;
            }
        }

        filesToProcess = subtitleZipEntries.map(entry => ({
            name: entry.name,
            getContent: () => entry.async('string')
        }));

        updateFileListUI(hasMp3);
        await extractAndDisplayImages();
    } catch (error) {
        console.error('解压文件时出错:', error);
        showStatusMessage('无法读取此 ZIP 文件，可能已损坏。');
        loadedZip = null;
    }
}

function updateFileListUI(hasMp3 = false) {
    if (filesToProcess.length === 0) {
        if (hasMp3) {
            showStatusMessage('');
            fileList.innerHTML = '<li class="text-sm text-gray-500 p-3">未找到字幕文件，将仅处理 MP3 封面嵌入</li>';
            fileListContainer.classList.remove('hidden');
            actionButtons.classList.remove('hidden');
        } else {
            showStatusMessage('在上传的文件中未找到任何 .vtt、.srt、.ass 或 .mp3 文件。');
            fileListContainer.classList.add('hidden');
            actionButtons.classList.add('hidden');
        }
        return;
    }

    fileList.innerHTML = '';

    filesToProcess.forEach(file => {
        const li = document.createElement('li');
        li.className = 'list-item flex items-center justify-between bg-gray-50 p-3 rounded-lg';

        const safeName = escapeHtml(file.name);
        const format = getFileFormat(file.name);

        li.innerHTML = `
            <span class="text-sm font-medium text-gray-700 truncate" title="${safeName}">${safeName}</span>
            <span class="text-xs px-2 py-1 rounded-full ${getFileFormatClass(format)}">${format}</span>
        `;

        fileList.appendChild(li);
    });

    // Update pipeline preview
    updatePipelinePreview();

    fileListContainer.classList.remove('hidden');
    actionButtons.classList.remove('hidden');
}

// --- VTT 转 LRC ---

function convertVttToLrc(vttContent) {
    const cleanContent = String(vttContent)
        .replace(/^\uFEFF/, '')
        .replace(/^WEBVTT[^\n]*\n?/i, '')
        .replace(/\r/g, '');

    const lines = cleanContent.split('\n');
    let lrcContent = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line.includes('-->')) continue;

        const startTime = line.split('-->')[0].trim();
        const timestamp = convertVttTimeToLrcTime(startTime);

        if (!timestamp) continue;

        let text = '';
        let j = i + 1;

        while (j < lines.length && lines[j].trim() !== '') {
            const subtitleLine = lines[j].trim();

            if (!/^NOTE\b/i.test(subtitleLine) && !/^\d+$/.test(subtitleLine)) {
                text += subtitleLine + ' ';
            }

            j++;
        }

        text = cleanupSubtitleText(text.trim());
        i = j - 1;

        if (text) {
            lrcContent += `${timestamp}${text}\n`;
        }
    }

    return lrcContent;
}

function convertVttTimeToLrcTime(vttTime) {
    // 支持：
    // 00:01.234
    // 01:02:03.456
    const match = String(vttTime).match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);

    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    const milliseconds = parseInt((match[4] || '0').padEnd(3, '0'), 10);

    const totalMinutes = hours * 60 + minutes;
    const hundredths = Math.floor(milliseconds / 10);

    return `[${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

function cleanupSubtitleText(text) {
    return String(text)
        .replace(/<[^>]+>/g, '') // 去掉 VTT 简单标签
        .replace(/\{[^}]+\}/g, '') // 去掉 ASS 标签
        .replace(/\s+/g, ' ')
        .trim();
}

// --- SRT 转 LRC ---

function convertSrtToLrc(srtContent) {
    const cleanContent = String(srtContent)
        .replace(/^\uFEFF/, '')
        .replace(/\r/g, '');

    const lines = cleanContent.split('\n');
    let lrcContent = '';
    let i = 0;

    while (i < lines.length) {
        // 跳过空行
        if (!lines[i].trim()) { i++; continue; }

        // 跳过序号行（纯数字行）
        if (/^\d+$/.test(lines[i].trim())) { i++; continue; }

        // 寻找时间戳行
        if (lines[i].includes('-->')) {
            const timestampLine = lines[i].trim();
            const startTime = timestampLine.split('-->')[0].trim();
            const timestamp = convertSrtTimeToLrcTime(startTime);

            if (timestamp) {
                i++;
                let text = '';

                // 收集文本行直到遇到空行、序号行或下一个时间戳
                while (i < lines.length) {
                    const line = lines[i].trim();
                    if (!line || /^\d+$/.test(line) || line.includes('-->')) break;
                    text += line + ' ';
                    i++;
                }

                text = cleanupSubtitleText(text.trim());
                if (text) {
                    lrcContent += `${timestamp}${text}\n`;
                }
                continue;
            }
        }

        i++;
    }

    return lrcContent;
}

function convertSrtTimeToLrcTime(srtTime) {
    // SRT format: 00:01:23,456 or 01:02:03,456
    const match = String(srtTime).match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);

    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    const milliseconds = parseInt((match[4] || '0').padEnd(3, '0'), 10);

    const totalMinutes = hours * 60 + minutes;
    const hundredths = Math.floor(milliseconds / 10);

    return `[${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

// --- ASS 转 LRC ---

function convertAssToLrc(assContent) {
    const cleanContent = String(assContent)
        .replace(/^\uFEFF/, '')
        .replace(/\r/g, '');

    const lines = cleanContent.split('\n');
    let lrcContent = '';
    let inEvents = false;
    let formatParts = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.toLowerCase() === '[events]') {
            inEvents = true;
            continue;
        }

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            inEvents = false;
            continue;
        }

        if (!inEvents) continue;

        if (trimmed.toLowerCase().startsWith('format:')) {
            formatParts = trimmed.slice(7).split(',').map(s => s.trim().toLowerCase());
            continue;
        }

        if (!trimmed.toLowerCase().startsWith('dialogue:') && !trimmed.toLowerCase().startsWith('comment:')) {
            continue;
        }

        if (trimmed.toLowerCase().startsWith('comment:')) continue;

        // Parse Dialogue line
        const dialogueContent = trimmed.slice(9); // Skip "Dialogue: "
        const parts = dialogueContent.split(',');

        if (!formatParts || formatParts.length === 0) continue;

        // Find Start, End, Text indices
        const startIndex = formatParts.indexOf('start');
        const endIndex = formatParts.indexOf('end');
        const textIndex = formatParts.indexOf('text');

        if (startIndex === -1 || endIndex === -1 || textIndex === -1) continue;
        if (parts.length <= Math.max(startIndex, endIndex, textIndex)) continue;

        const startTime = parts[startIndex].trim();
        const textParts = parts.slice(textIndex);
        let text = textParts.join(',').trim();

        // Remove ASS style overrides like {\b1}, {\pos(x,y)}, etc.
        text = text.replace(/\{[^}]*\}/g, '');
        // Replace \N and \n with space
        text = text.replace(/\\[Nn]/g, ' ');
        text = text.trim();

        if (!text) continue;

        const timestamp = convertAssTimeToLrcTime(startTime);
        if (!timestamp) continue;

        lrcContent += `${timestamp}${text}\n`;
    }

    return lrcContent;
}

function convertAssTimeToLrcTime(assTime) {
    // ASS format: H:MM:SS.cc (centiseconds)
    const match = String(assTime).match(/^(\d+):(\d{1,2}):(\d{1,2})[.](\d{1,2})$/);

    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    const centiseconds = parseInt((match[4] || '0').padEnd(2, '0'), 10);

    const totalMinutes = hours * 60 + minutes;

    return `[${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`;
}

function getLrcFilename(vttFilename) {
    // Handle compound extensions like .mp3.vtt, .wav.vtt
    if (/\.mp3\.(vtt|srt|ass|ssa)$/i.test(vttFilename)) {
        return vttFilename.replace(/\.mp3\.(vtt|srt|ass|ssa)$/i, '.lrc');
    }

    if (/\.wav\.(vtt|srt|ass|ssa)$/i.test(vttFilename)) {
        return vttFilename.replace(/\.wav\.(vtt|srt|ass|ssa)$/i, '.lrc');
    }

    return vttFilename.replace(/\.(vtt|srt|ass|ssa)$/i, '.lrc');
}

// --- 流水线预览 ---

function updatePipelinePreview() {
    const pipelineContainer = document.getElementById('pipeline-container');
    const pipelineSteps = document.getElementById('pipeline-steps');

    if (!pipelineContainer || !pipelineSteps) return;

    if (filesToProcess.length === 0) {
        pipelineContainer.classList.add('hidden');
        return;
    }

    // Detect formats present
    const formats = new Set();
    filesToProcess.forEach(file => {
        const format = getFileFormat(file.name);
        if (format) formats.add(format);
    });

    // Build pipeline steps
    const steps = [];
    if (formats.has('SRT')) steps.push('SRT');
    if (formats.has('ASS')) steps.push('ASS');
    if (formats.has('VTT')) steps.push('VTT');
    steps.push('LRC');

    // If only one source format, show direct conversion
    // If multiple, show all source formats on left, LRC on right
    let html = '';

    if (steps.length === 2) {
        // Simple: Source → LRC
        html = `
            <div class="pipeline-step format-${steps[0].toLowerCase()}">${steps[0]}</div>
            <div class="pipeline-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </div>
            <div class="pipeline-step format-lrc">${steps[1]}</div>
        `;
    } else {
        // Multiple sources → LRC
        const sourceFormats = steps.slice(0, -1);
        html = `
            <div class="pipeline-sources">
                ${sourceFormats.map(f => `<div class="pipeline-step format-${f.toLowerCase()}">${f}</div>`).join('')}
            </div>
            <div class="pipeline-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </div>
            <div class="pipeline-step format-lrc">LRC</div>
        `;
    }

    pipelineSteps.innerHTML = html;
    pipelineContainer.classList.remove('hidden');
}

// --- 图片预览与封面选择 ---

async function extractAndDisplayImages() {
    zipImages = [];
    selectedCoverImage = null;

    const imageExts = /\.(jpe?g|png|gif|webp|bmp)$/i;
    const mimeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp'
    };

    for (const filename in loadedZip.files) {
        const entry = loadedZip.files[filename];

        if (entry.dir || !imageExts.test(filename)) continue;

        const ext = filename.split('.').pop().toLowerCase();
        const mime = mimeMap[ext];

        if (!mime) continue;

        try {
            const base64 = await entry.async('base64');
            zipImages.push({
                name: filename,
                mime,
                base64
            });
        } catch (error) {
            console.warn(`读取图片失败：${filename}`, error);
        }
    }

    renderImageGrid();
}

function renderImageGrid() {
    imagePreviewGrid.innerHTML = '';

    if (zipImages.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        return;
    }

    zipImages.forEach((img, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-thumb-wrapper';
        wrapper.dataset.index = String(index);
        wrapper.title = img.name;

        const image = document.createElement('img');
        image.src = `data:${img.mime};base64,${img.base64}`;
        image.alt = img.name;

        const check = document.createElement('div');
        check.className = 'cover-check';
        check.textContent = '✓';

        wrapper.appendChild(image);
        wrapper.appendChild(check);

        wrapper.addEventListener('click', () => selectCoverImage(index));
        imagePreviewGrid.appendChild(wrapper);
    });

    imagePreviewContainer.classList.remove('hidden');
}

function selectCoverImage(index) {
    const wrappers = imagePreviewGrid.querySelectorAll('.image-thumb-wrapper');

    if (selectedCoverImage && selectedCoverImage.base64 === zipImages[index].base64) {
        selectedCoverImage = null;
        wrappers[index].classList.remove('selected');
        return;
    }

    wrappers.forEach(wrapper => wrapper.classList.remove('selected'));
    wrappers[index].classList.add('selected');

    selectedCoverImage = {
        mime: zipImages[index].mime,
        base64: zipImages[index].base64
    };
}

// --- 图片标准化：解决手机播放器不识别大图/Exif/非方图的问题 ---

async function normalizeCoverImage(imageBase64, imageMime, options = {}) {
    const maxSize = options.maxSize || 800;
    const quality = options.quality || 0.85;

    const blob = base64ToBlob(imageBase64, imageMime);
    const bitmap = await loadImageBitmapCompatible(blob);

    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;

    if (!sourceWidth || !sourceHeight) {
        throw new Error('无法读取封面图片尺寸。');
    }

    // 居中裁剪为正方形
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const cropX = Math.floor((sourceWidth - cropSize) / 2);
    const cropY = Math.floor((sourceHeight - cropSize) / 2);

    // 限制最大尺寸
    const targetSize = Math.min(maxSize, cropSize);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d', {
        alpha: false
    });

    // 填白底，避免 PNG/WebP 透明区域转 JPEG 后变黑
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetSize, targetSize);

    ctx.drawImage(
        bitmap,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        targetSize,
        targetSize
    );

    const jpegBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    if (!jpegBlob) {
        throw new Error('封面图片转换为 JPEG 失败。');
    }

    const normalizedBase64 = await blobToBase64(jpegBlob);

    return {
        mime: 'image/jpeg',
        base64: normalizedBase64,
        originalWidth: sourceWidth,
        originalHeight: sourceHeight,
        outputSize: targetSize,
        byteLength: jpegBlob.size
    };
}

function base64ToBlob(base64, mime) {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);

    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Blob([bytes], {
        type: mime
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || '');
            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

async function loadImageBitmapCompatible(blob) {
    if ('createImageBitmap' in window) {
        return await createImageBitmap(blob);
    }

    return await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片解码失败。'));
        };

        image.src = url;
    });
}

// --- ID3v2 读写工具 ---

function readSynchsafeInt(bytes, offset) {
    return (
        ((bytes[offset] & 0x7F) << 21) |
        ((bytes[offset + 1] & 0x7F) << 14) |
        ((bytes[offset + 2] & 0x7F) << 7) |
        (bytes[offset + 3] & 0x7F)
    );
}

function writeSynchsafeInt(value) {
    return new Uint8Array([
        (value >> 21) & 0x7F,
        (value >> 14) & 0x7F,
        (value >> 7) & 0x7F,
        value & 0x7F
    ]);
}

function readUint32BE(bytes, offset) {
    return (
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    ) >>> 0;
}

function writeUint32BE(value) {
    return new Uint8Array([
        (value >>> 24) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 8) & 0xFF,
        value & 0xFF
    ]);
}

function hasId3v2Tag(bytes) {
    return bytes.length >= 10 &&
        bytes[0] === 0x49 &&
        bytes[1] === 0x44 &&
        bytes[2] === 0x33;
}

function parseId3v2(bytes) {
    if (!hasId3v2Tag(bytes)) {
        return {
            hasTag: false,
            majorVersion: null,
            revision: null,
            flags: 0,
            tagStart: 0,
            tagEnd: 0,
            frameData: new Uint8Array(0),
            audioStart: 0
        };
    }

    const majorVersion = bytes[3];
    const revision = bytes[4];
    const flags = bytes[5];
    const tagSize = readSynchsafeInt(bytes, 6);

    let tagEnd = 10 + tagSize;

    // ID3v2 footer
    if (flags & 0x10) {
        tagEnd += 10;
    }

    tagEnd = Math.min(tagEnd, bytes.length);

    return {
        hasTag: true,
        majorVersion,
        revision,
        flags,
        tagStart: 0,
        tagEnd,
        frameData: bytes.slice(10, Math.min(10 + tagSize, bytes.length)),
        audioStart: tagEnd
    };
}

function removeApicFramesFromId3v23(frameData) {
    const keptFrames = [];
    let offset = 0;

    while (offset + 10 <= frameData.length) {
        const frameId = String.fromCharCode(
            frameData[offset],
            frameData[offset + 1],
            frameData[offset + 2],
            frameData[offset + 3]
        );

        // padding
        if (!/^[A-Z0-9]{4}$/.test(frameId)) {
            break;
        }

        const frameSize = readUint32BE(frameData, offset + 4);
        const frameTotalSize = 10 + frameSize;

        if (frameSize <= 0 || offset + frameTotalSize > frameData.length) {
            break;
        }

        if (frameId !== 'APIC') {
            keptFrames.push(frameData.slice(offset, offset + frameTotalSize));
        }

        offset += frameTotalSize;
    }

    return concatUint8Arrays(keptFrames);
}

function createTextFrameV23(frameId, text) {
    const textBytes = new TextEncoder().encode(String(text || ''));
    const frameContent = new Uint8Array(1 + textBytes.length);

    frameContent[0] = 0x03; // UTF-8。虽然 ID3v2.3 标准里更常见 UTF-16，但多数现代播放器能识别
    frameContent.set(textBytes, 1);

    return createFrameV23(frameId, frameContent);
}

function createApicFrameV23(imageBytes, imageMime) {
    const mimeTypeBytes = new TextEncoder().encode(imageMime || 'image/jpeg');

    // APIC content:
    // text encoding: 1 byte
    // MIME: n bytes
    // null terminator: 1 byte
    // picture type: 1 byte
    // description null terminator: 1 byte
    // image data: n bytes
    const frameContentSize = 1 + mimeTypeBytes.length + 1 + 1 + 1 + imageBytes.length;
    const frameContent = new Uint8Array(frameContentSize);

    let offset = 0;

    frameContent[offset++] = 0x00; // ISO-8859-1，描述为空，所以最兼容
    frameContent.set(mimeTypeBytes, offset);
    offset += mimeTypeBytes.length;
    frameContent[offset++] = 0x00; // MIME null
    frameContent[offset++] = 0x03; // Front Cover
    frameContent[offset++] = 0x00; // empty description
    frameContent.set(imageBytes, offset);

    return createFrameV23('APIC', frameContent);
}

function createFrameV23(frameId, frameContent) {
    const frame = new Uint8Array(10 + frameContent.length);
    const frameIdBytes = new TextEncoder().encode(frameId);

    frame.set(frameIdBytes, 0);
    frame.set(writeUint32BE(frameContent.length), 4);

    frame[8] = 0x00;
    frame[9] = 0x00;

    frame.set(frameContent, 10);

    return frame;
}

function createId3v23Tag(frames) {
    const frameData = concatUint8Arrays(frames);
    const header = new Uint8Array(10);

    header[0] = 0x49; // I
    header[1] = 0x44; // D
    header[2] = 0x33; // 3
    header[3] = 0x03; // ID3v2.3
    header[4] = 0x00;
    header[5] = 0x00;

    header.set(writeSynchsafeInt(frameData.length), 6);

    return concatUint8Arrays([header, frameData]);
}

function concatUint8Arrays(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;

    arrays.forEach(arr => {
        result.set(arr, offset);
        offset += arr.length;
    });

    return result;
}

function base64ToUint8Array(base64) {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);

    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }

    return bytes;
}

// --- ID3v2 封面写入 ---
// 重点改进：
// 1. 写入前把封面压缩成 800x800 JPEG
// 2. 对 ID3v2.3 文件尽量保留原标签，只替换 APIC
// 3. 非 ID3v2.3 或无标签时，写入一个新的 ID3v2.3 标签

async function addId3v2Cover(mp3ArrayBuffer, imageBase64, imageMime, metadata = {}) {
    const normalizedCover = await normalizeCoverImage(imageBase64, imageMime, {
        maxSize: 800,
        quality: 0.85
    });

    const imageBytes = base64ToUint8Array(normalizedCover.base64);
    const mp3Bytes = new Uint8Array(mp3ArrayBuffer);
    const parsed = parseId3v2(mp3Bytes);
    const audioBytes = mp3Bytes.slice(parsed.audioStart);

    const apicFrame = createApicFrameV23(imageBytes, normalizedCover.mime);

    let frames = [];

    if (parsed.hasTag && parsed.majorVersion === 3) {
        // 保留原 ID3v2.3 的非 APIC 帧，只替换封面
        const keptFrameData = removeApicFramesFromId3v23(parsed.frameData);

        frames.push(keptFrameData);

        // 如原标签里完全缺少基础信息，可按文件名补一个标题
        if (metadata.title) {
            // 为了避免重复 TIT2，这里不强行补写。
            // 需要强制补标题时，可以在这里添加 createTextFrameV23('TIT2', metadata.title)
        }

        frames.push(apicFrame);
    } else {
        // 没有 ID3v2 标签，或版本不是 v2.3：新建一个兼容性较好的 ID3v2.3 标签
        if (metadata.title) {
            frames.push(createTextFrameV23('TIT2', metadata.title));
        }

        frames.push(apicFrame);
    }

    const id3Tag = createId3v23Tag(frames);
    const result = new Uint8Array(id3Tag.length + audioBytes.length);

    result.set(id3Tag, 0);
    result.set(audioBytes, id3Tag.length);

    return result.buffer;
}

// --- ZIP 输出辅助 ---

function getOutputFolderNameFromZip(zip) {
    let fallback = '';

    if (originalInputName) {
        fallback = originalInputName.replace(/\.zip$/i, '');
    }

    for (const fn in zip.files) {
        if (zip.files[fn].dir) continue;

        const parts = fn.split('/').filter(Boolean);
        const dirParts = parts.slice(0, -1);

        if (dirParts.length >= 2) {
            return `${dirParts[0]}_${dirParts[1]}`;
        }

        if (dirParts.length === 1) {
            return dirParts[0];
        }

        break;
    }

    return fallback || 'output';
}

function createFlattenedName(filename, existingNames) {
    const baseName = getBaseName(filename);
    const parts = filename.split('/').filter(Boolean);

    // 路径部分：去掉第一个根目录和最后一个文件名
    const pathParts = parts.slice(1, -1);
    const hasPath = pathParts.length > 0;
    const pathStr = pathParts.join('_');

    const isMusicOrSubtitle = /\.(mp3|wav|lrc|ogg|flac|aac|m4a)$/i.test(baseName);

    let newName = baseName;

    if (existingNames.has(newName)) {
        if (isMusicOrSubtitle && hasPath) {
            newName = baseName.replace(/\.[^.]+$/, `_${pathStr}$&`);
        } else if (!isMusicOrSubtitle && hasPath) {
            newName = `${pathStr}_${baseName}`;
        } else {
            newName = addNumberSuffixUntilUnique(baseName, existingNames);
        }
    }

    if (existingNames.has(newName)) {
        newName = addNumberSuffixUntilUnique(newName, existingNames);
    }

    existingNames.add(newName);

    return newName;
}

function addNumberSuffixUntilUnique(filename, existingNames) {
    const dotIndex = filename.lastIndexOf('.');
    const nameBase = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
    const extPart = dotIndex > 0 ? filename.slice(dotIndex) : '';

    let counter = 2;
    let candidate = `${nameBase}_${counter}${extPart}`;

    while (existingNames.has(candidate)) {
        counter++;
        candidate = `${nameBase}_${counter}${extPart}`;
    }

    return candidate;
}

// --- 转换与下载 ---

async function convertAndDownload() {
    if (filesToProcess.length === 0 && !loadedZip) return;

    setButtonLoading(true);
    showStatusMessage('');

    try {
        const outputZip = new JSZip();

        if (loadedZip) {
            await processZipMode(outputZip);
        } else {
            await processDirectVttMode(outputZip);
        }

        const zipBlob = await outputZip.generateAsync({
            type: 'blob'
        });

        downloadBlob(zipBlob, getDownloadName());
        showStatusMessage('处理完成。');
    } catch (error) {
        console.error('转换或下载过程中发生错误:', error);
        showStatusMessage(`处理失败：${error.message || '请在控制台查看错误信息。'}`);
    } finally {
        setButtonLoading(false);
    }
}

async function processZipMode(outputZip) {
    const shouldFlatten = flattenCheckbox.checked;
    const existingNames = new Set();
    const outputFolder = getOutputFolderNameFromZip(loadedZip);

    for (const filename in loadedZip.files) {
        const zipEntry = loadedZip.files[filename];
        if (zipEntry.dir) continue;

        const newName = shouldFlatten
            ? createFlattenedName(filename, existingNames)
            : filename;

        if (isVttFile(filename)) {
            const vttContent = await zipEntry.async('string');
            const lrcContent = convertVttToLrc(vttContent);
            const lrcFilename = shouldFlatten
                ? getLrcFilename(newName)
                : getLrcFilename(filename);

            outputZip.file(joinZipPath(outputFolder, lrcFilename), lrcContent);
            continue;
        }

        if (isSrtFile(filename)) {
            const srtContent = await zipEntry.async('string');
            const lrcContent = convertSrtToLrc(srtContent);
            const lrcFilename = shouldFlatten
                ? getLrcFilename(newName)
                : getLrcFilename(filename);

            outputZip.file(joinZipPath(outputFolder, lrcFilename), lrcContent);
            continue;
        }

        if (isAssFile(filename)) {
            const assContent = await zipEntry.async('string');
            const lrcContent = convertAssToLrc(assContent);
            const lrcFilename = shouldFlatten
                ? getLrcFilename(newName)
                : getLrcFilename(filename);

            outputZip.file(joinZipPath(outputFolder, lrcFilename), lrcContent);
            continue;
        }

        if (isMp3File(filename) && selectedCoverImage) {
            const arrayBuffer = await zipEntry.async('arraybuffer');

            const metadata = {
                title: getBaseName(newName).replace(/\.[^.]+$/, '')
            };

            const taggedBuffer = await addId3v2Cover(
                arrayBuffer,
                selectedCoverImage.base64,
                selectedCoverImage.mime,
                metadata
            );

            outputZip.file(
                joinZipPath(outputFolder, newName),
                new Blob([taggedBuffer], {
                    type: 'audio/mpeg'
                })
            );

            continue;
        }

        const fileContent = await zipEntry.async('blob');
        outputZip.file(joinZipPath(outputFolder, newName), fileContent);
    }
}

async function processDirectVttMode(outputZip) {
    for (const file of filesToProcess) {
        const content = await file.getContent();
        let lrcContent;

        if (isVttFile(file.name)) {
            lrcContent = convertVttToLrc(content);
        } else if (isSrtFile(file.name)) {
            lrcContent = convertSrtToLrc(content);
        } else if (isAssFile(file.name)) {
            lrcContent = convertAssToLrc(content);
        } else {
            continue;
        }

        const lrcFilename = getLrcFilename(file.name);
        outputZip.file(lrcFilename, lrcContent);
    }
}

function getDownloadName() {
    let downloadName = `converted_lrc_${Date.now()}.zip`;

    if (loadedZip && originalInputName) {
        const baseName = originalInputName.replace(/\.zip$/i, '');
        downloadName = `${baseName}_after.zip`;
    } else if (!loadedZip && originalInputName) {
        const baseName = originalInputName.replace(/\.vtt$/i, '');
        downloadName = `${baseName}等等.zip`;
    }

    return downloadName;
}

function downloadBlob(blob, filename) {
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = downloadUrl;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(downloadUrl);
}

// --- 粘贴文本转换 ---

function convertPasteText() {
    if (!pasteInput || !pasteOutput || !pasteFormat) return;

    const inputText = pasteInput.value.trim();
    const format = pasteFormat.value;

    if (!inputText) {
        pasteOutput.value = '';
        pasteOutput.classList.add('hidden');
        pasteOutputPlaceholder.classList.remove('hidden');
        copyLrcBtn.classList.add('hidden');
        return;
    }

    let lrcContent = '';

    try {
        switch (format) {
            case 'srt':
                lrcContent = convertSrtToLrc(inputText);
                break;
            case 'vtt':
                lrcContent = convertVttToLrc(inputText);
                break;
            case 'ass':
                lrcContent = convertAssToLrc(inputText);
                break;
            default:
                lrcContent = convertSrtToLrc(inputText);
        }

        pasteOutput.value = lrcContent;
        pasteOutput.classList.remove('hidden');
        pasteOutputPlaceholder.classList.add('hidden');
        copyLrcBtn.classList.remove('hidden');

        // 保存选择的格式
        localStorage.setItem('lastSubtitleFormat', format);
    } catch (error) {
        console.error('转换失败:', error);
        pasteOutput.value = '转换失败：' + error.message;
        pasteOutput.classList.remove('hidden');
        pasteOutputPlaceholder.classList.add('hidden');
        copyLrcBtn.classList.add('hidden');
    }
}

// 恢复上次选择的格式
function restoreLastFormat() {
    const lastFormat = localStorage.getItem('lastSubtitleFormat');
    if (lastFormat && pasteFormat) {
        pasteFormat.value = lastFormat;
    }
}

function copyLrcOutput() {
    const outputText = pasteOutput.value;

    if (!outputText) return;

    navigator.clipboard.writeText(outputText).then(() => {
        showCopySuccess();
    }).catch(() => {
        // 降级方案：临时允许选中
        pasteOutput.focus();
        pasteOutput.select();
        document.execCommand('copy');
        showCopySuccess();
    });
}

function showCopySuccess() {
    const originalText = '复制';
    copyLrcBtn.textContent = '已复制';
    copyLrcBtn.classList.add('copied');
    setTimeout(() => {
        copyLrcBtn.textContent = originalText;
        copyLrcBtn.classList.remove('copied');
    }, 2000);
}