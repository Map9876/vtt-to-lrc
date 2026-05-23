// DOM 元素
const tabDirect = document.getElementById('tab-direct');
const tabZip = document.getElementById('tab-zip');
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

// 状态
let filesToProcess = []; // 统一存储待处理文件 { name, getContent }
let loadedZip = null; // 存储上传的 ZIP 对象
let originalInputName = null; // 存储原始输入文件名
let zipImages = []; // { name, mime, base64 }
let selectedCoverImage = null; // { mime, base64 } 或 null

// --- 事件监听 ---

// 标签页切换
tabDirect.addEventListener('click', () => switchTab('direct'));
tabZip.addEventListener('click', () => switchTab('zip'));

// 拖拽事件
dropZones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', (e) => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
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

// 文件输入
fileInputDirect.addEventListener('change', (e) => handleDirectFiles(e.target.files));
fileInputZip.addEventListener('change', (e) => {
    if (e.target.files.length) handleZipFile(e.target.files[0]);
});

// 操作按钮
convertBtn.addEventListener('click', convertAndDownload);
clearBtn.addEventListener('click', clearFiles);

// --- 功能函数 ---

function switchTab(tabName) {
    if (tabName === 'direct') {
        tabDirect.classList.add('active');
        tabZip.classList.remove('active');
        panelDirect.classList.add('active');
        panelZip.classList.remove('active');
        flattenOption.classList.add('hidden');
    } else {
        tabDirect.classList.remove('active');
        tabZip.classList.add('active');
        panelDirect.classList.remove('active');
        panelZip.classList.add('active');
        flattenOption.classList.remove('hidden');
    }
     clearFiles(); // 切换时清空
}

// 处理直接上传的 VTT 文件
function handleDirectFiles(fileList) {
    clearFiles();
    const vttFiles = Array.from(fileList).filter(file => file.name.endsWith('.vtt'));
    if (vttFiles.length === 0) return;

    originalInputName = vttFiles[0].name;

    filesToProcess = vttFiles.map(file => ({
        name: file.name,
        getContent: () => file.text()
    }));
    updateFileListUI();
}

// 处理 ZIP 压缩包
async function handleZipFile(zipFile) {
    if (!zipFile || !(zipFile.type.includes('zip') || zipFile.name.endsWith('.zip'))) {
        showStatusMessage('请上传一个 ZIP 格式的压缩包。');
        return;
    }
    clearFiles();
    originalInputName = zipFile.name;

    try {
        loadedZip = await JSZip.loadAsync(zipFile); // 存储整个 ZIP 对象
        const vttZipEntries = [];
        let hasMp3 = false;
        for (const filename in loadedZip.files) {
            const entry = loadedZip.files[filename];
            if (entry.dir) continue;
            if (filename.endsWith('.vtt')) {
                vttZipEntries.push(entry);
            }
            if (/\.mp3$/i.test(filename)) {
                hasMp3 = true;
            }
        }
        filesToProcess = vttZipEntries.map(entry => ({
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
            fileList.innerHTML = '<li class="text-sm text-gray-500 p-3">未找到 VTT 文件，将仅处理 MP3 封面嵌入</li>';
            fileListContainer.classList.remove('hidden');
            actionButtons.classList.remove('hidden');
        } else {
            showStatusMessage(`在上传的文件中未找到任何 .vtt 或 .mp3 文件。`);
            fileListContainer.classList.add('hidden');
            actionButtons.classList.add('hidden');
        }
        return;
    }
    fileList.innerHTML = '';
    filesToProcess.forEach(file => {
        const li = document.createElement('li');
        li.className = 'list-item flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        li.innerHTML = `
            <span class="text-sm font-medium text-gray-700 truncate" title="${file.name}">${file.name}</span>
            <span class="text-sm text-green-600">待处理</span>`;
        fileList.appendChild(li);
    });
    fileListContainer.classList.remove('hidden');
    actionButtons.classList.remove('hidden');
}

function showStatusMessage(message) {
    statusMessage.textContent = message;
}

function clearFiles() {
    filesToProcess = [];
    loadedZip = null; // 清空已加载的 ZIP
    originalInputName = null;
    zipImages = [];
    selectedCoverImage = null;
    imagePreviewGrid.innerHTML = '';
    imagePreviewContainer.classList.add('hidden');
    fileInputDirect.value = '';
    fileInputZip.value = '';
    fileList.innerHTML = '';
    fileListContainer.classList.add('hidden');
    actionButtons.classList.add('hidden');
    showStatusMessage('');
}

function convertVttToLrc(vttContent) {
    const cleanContent = vttContent.replace(/^WEBVTT\s*/, '').replace(/NOTE\s.*\n/g, '').replace(/\r/g, '');
    const lines = cleanContent.split('\n');
    let lrcContent = '';
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
            const startTime = lines[i].split(' --> ')[0].trim();
            const timeParts = startTime.split(/[:.]/);
            if (timeParts.length < 3) continue;
            const hours = timeParts.length > 3 ? parseInt(timeParts[0], 10) : 0;
            const minutes = parseInt(timeParts[timeParts.length - 3], 10) || 0;
            const seconds = parseInt(timeParts[timeParts.length - 2], 10) || 0;
            const milliseconds = parseInt(timeParts[timeParts.length - 1], 10) || 0;
            const totalMinutes = hours * 60 + minutes;
            const hundredths = Math.floor(milliseconds / 10);
            let text = '';
            let j = i + 1;
            while (j < lines.length && lines[j] && lines[j].trim() !== '') {
                text += lines[j].trim() + ' ';
                j++;
            }
            text = text.trim();
            i = j - 1;
            if (text) {
                const lrcTimestamp = `[${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
                lrcContent += `${lrcTimestamp}${text}\n`;
            }
        }
    }
    return lrcContent;
}

function getLrcFilename(vttFilename) {
    if (vttFilename.endsWith('.mp3.vtt')) {
        return vttFilename.replace('.mp3.vtt', '.lrc');
    }
    if (vttFilename.endsWith('.wav.vtt')) {
        return vttFilename.replace('.wav.vtt', '.lrc');
    }
    return vttFilename.replace(/.vtt$/, '.lrc');
}

// --- 图片预览与封面选择 ---

async function extractAndDisplayImages() {
    zipImages = [];
    selectedCoverImage = null;
    const imageExts = /\.(jpe?g|png|gif|webp|bmp)$/i;
    const mimeMap = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
    };

    for (const filename in loadedZip.files) {
        const entry = loadedZip.files[filename];
        if (entry.dir || !imageExts.test(filename)) continue;
        const ext = filename.split('.').pop().toLowerCase();
        const mime = mimeMap[ext];
        if (!mime) continue;
        const base64 = await entry.async('base64');
        zipImages.push({ name: filename, mime, base64 });
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
        wrapper.dataset.index = index;
        wrapper.title = img.name;
        wrapper.innerHTML = `
            <img src="data:${img.mime};base64,${img.base64}" alt="${img.name}">
            <div class="cover-check">✓</div>
        `;
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

    wrappers.forEach(w => w.classList.remove('selected'));
    wrappers[index].classList.add('selected');
    selectedCoverImage = { mime: zipImages[index].mime, base64: zipImages[index].base64 };
}

// --- ID3v2 封面写入 ---

function addId3v2Cover(mp3ArrayBuffer, imageBase64, imageMime) {
    // 解码 base64 图片
    const binaryStr = atob(imageBase64);
    const imageBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        imageBytes[i] = binaryStr.charCodeAt(i);
    }

    const mp3Bytes = new Uint8Array(mp3ArrayBuffer);

    // 剥离已有 ID3v2 标签
    let mp3StartOffset = 0;
    if (mp3Bytes[0] === 0x49 && mp3Bytes[1] === 0x44 && mp3Bytes[2] === 0x33) {
        const tagSize =
            ((mp3Bytes[6] & 0x7F) << 21) |
            ((mp3Bytes[7] & 0x7F) << 14) |
            ((mp3Bytes[8] & 0x7F) << 7) |
            ((mp3Bytes[9] & 0x7F));
        mp3StartOffset = 10 + tagSize;
        if (mp3Bytes[5] & 0x10) mp3StartOffset += 10; // footer
    }
    const mp3WithoutId3 = mp3Bytes.slice(mp3StartOffset);

    // 构建 APIC frame
    const mimeTypeBytes = new TextEncoder().encode(imageMime);
    // frame content: encoding(1) + mime + null(1) + picType(1) + desc null(1) + imageData
    const frameContentSize = 1 + mimeTypeBytes.length + 1 + 1 + 1 + imageBytes.length;
    const apicFrame = new Uint8Array(10 + frameContentSize);

    // Frame ID: "APIC"
    apicFrame[0] = 0x41; apicFrame[1] = 0x50; apicFrame[2] = 0x49; apicFrame[3] = 0x43;
    // Frame size (big-endian, 非 syncsafe)
    apicFrame[4] = (frameContentSize >> 24) & 0xFF;
    apicFrame[5] = (frameContentSize >> 16) & 0xFF;
    apicFrame[6] = (frameContentSize >> 8) & 0xFF;
    apicFrame[7] = frameContentSize & 0xFF;
    // Flags
    apicFrame[8] = 0x00; apicFrame[9] = 0x00;

    let offset = 10;
    apicFrame[offset++] = 0x00; // encoding: ISO-8859-1
    apicFrame.set(mimeTypeBytes, offset); offset += mimeTypeBytes.length;
    apicFrame[offset++] = 0x00; // null terminator for MIME
    apicFrame[offset++] = 0x03; // picture type: front cover
    apicFrame[offset++] = 0x00; // description: empty
    apicFrame.set(imageBytes, offset);

    // ID3v2.3 tag header
    const tagSize = apicFrame.length;
    const id3Header = new Uint8Array(10);
    id3Header[0] = 0x49; id3Header[1] = 0x44; id3Header[2] = 0x33; // "ID3"
    id3Header[3] = 3; id3Header[4] = 0; // v2.3.0
    id3Header[5] = 0; // flags
    id3Header[6] = (tagSize >> 21) & 0x7F;
    id3Header[7] = (tagSize >> 14) & 0x7F;
    id3Header[8] = (tagSize >> 7) & 0x7F;
    id3Header[9] = tagSize & 0x7F;

    // 拼接：header + APIC frame + stripped MP3
    const result = new Uint8Array(id3Header.length + apicFrame.length + mp3WithoutId3.length);
    result.set(id3Header, 0);
    result.set(apicFrame, id3Header.length);
    result.set(mp3WithoutId3, id3Header.length + apicFrame.length);

    return result.buffer;
}

async function convertAndDownload() {
    if (filesToProcess.length === 0 && !loadedZip) return;
    setButtonLoading(true);
    try {
        const outputZip = new JSZip();

        if (loadedZip) {
            // 模式一：处理上传的 ZIP 包
            const shouldFlatten = flattenCheckbox.checked;
            const existingNames = new Set();

            // 从 ZIP 结构中提取输出文件夹名（前两层目录合并）
            let outputFolder = '';
            for (const fn in loadedZip.files) {
                if (loadedZip.files[fn].dir) continue;
                const parts = fn.split('/');
                const dirParts = parts.slice(0, -1);
                if (dirParts.length >= 2) {
                    outputFolder = dirParts[0] + '_' + dirParts[1];
                } else if (dirParts.length === 1) {
                    outputFolder = dirParts[0];
                }
                break;
            }

            for (const filename in loadedZip.files) {
                const zipEntry = loadedZip.files[filename];
                if (zipEntry.dir) continue;

                let newName;

                if (shouldFlatten) {
                    const baseName = filename.split('/').pop();
                    const parts = filename.split('/');
                    // 路径部分：去掉第一个（根目录如 RJ01524070）和最后一个（文件名）
                    const pathParts = parts.slice(1, -1);
                    const hasPath = pathParts.length > 0;
                    const pathStr = pathParts.join('_');
                    const isMusicOrSubtitle = /\.(mp3|wav|lrc|ogg|flac|aac|m4a)$/i.test(baseName);

                    if (existingNames.has(baseName)) {
                        if (isMusicOrSubtitle && hasPath) {
                            newName = baseName.replace(/\.[^.]+$/, `_${pathStr}$&`);
                        } else if (!isMusicOrSubtitle && hasPath) {
                            newName = `${pathStr}_${baseName}`;
                        } else {
                            // 无法区分的重名：加序号
                            let counter = 1;
                            let candidate;
                            do {
                                counter++;
                                candidate = baseName.replace(/([^.]+)/, `$1_${counter}`);
                            } while (existingNames.has(candidate));
                            newName = candidate;
                        }
                    } else {
                        newName = baseName;
                    }

                    // 处理重命名后仍然重名的情况（加序号）
                    if (existingNames.has(newName)) {
                        let counter = 1;
                        let candidate;
                        do {
                            counter++;
                            const ext = newName.lastIndexOf('.');
                            const nameBase = ext > 0 ? newName.substring(0, ext) : newName;
                            const extPart = ext > 0 ? newName.substring(ext) : '';
                            candidate = `${nameBase}_${counter}${extPart}`;
                        } while (existingNames.has(candidate));
                        newName = candidate;
                    }

                    existingNames.add(newName);
                } else {
                    newName = filename;
                }

                if (filename.endsWith('.vtt')) {
                    const vttContent = await zipEntry.async('string');
                    const lrcContent = convertVttToLrc(vttContent);
                    const lrcFilename = shouldFlatten ? getLrcFilename(newName) : getLrcFilename(filename);
                    outputZip.file(outputFolder + '/' + lrcFilename, lrcContent);
                } else if (/\.mp3$/i.test(filename) && selectedCoverImage) {
                    const arrayBuffer = await zipEntry.async('arraybuffer');
                    const taggedBuffer = addId3v2Cover(arrayBuffer, selectedCoverImage.base64, selectedCoverImage.mime);
                    outputZip.file(outputFolder + '/' + newName, new Blob([taggedBuffer], { type: 'audio/mpeg' }));
                } else {
                    const fileContent = await zipEntry.async('blob');
                    outputZip.file(outputFolder + '/' + newName, fileContent);
                }
            }
        } else {
            // 模式二：处理直接上传的 VTT 文件
            for (const file of filesToProcess) {
                const vttContent = await file.getContent();
                const lrcContent = convertVttToLrc(vttContent);
                const lrcFilename = getLrcFilename(file.name);
                outputZip.file(lrcFilename, lrcContent);
            }
        }

        const zipBlob = await outputZip.generateAsync({ type: 'blob' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;

        let downloadName = `converted_lrc_${Date.now()}.zip`; // Fallback name
        if (loadedZip && originalInputName) {
            // ZIP mode
            const baseName = originalInputName.replace(/\.zip$/i, '');
            downloadName = `${baseName}_after.zip`;
        } else if (!loadedZip && originalInputName) {
            // Direct VTTs mode
            const baseName = originalInputName.replace(/\.vtt$/i, '');
            downloadName = `${baseName}等等.zip`;
        }
        a.download = downloadName;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('转换或下载过程中发生错误:', error);
        showStatusMessage('处理失败，请在控制台查看错误信息。');
    } finally {
        setButtonLoading(false);
    }
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
