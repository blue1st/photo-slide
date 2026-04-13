const imgElement = document.getElementById('main-image');
const btnOpen = document.getElementById('btn-open');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnAddTag = document.getElementById('btn-add-tag');
const inputSingleTag = document.getElementById('input-single-tag');
const fileNameDisplay = document.getElementById('file-name');
const allTagsListDiv = document.getElementById('all-tags-list');
const tagSuggestions = document.getElementById('tag-suggestions');
const btnClearFilter = document.getElementById('btn-clear-filter');
const displayModeLabel = document.getElementById('display-mode-label');
const currentTagsContainer = document.getElementById('current-tags-container');
const controls = document.getElementById('controls');
const welcomeView = document.getElementById('welcome-view');

// ファイル操作系
const btnRenameTrigger = document.getElementById('btn-rename-trigger');
const renameModal = document.getElementById('rename-modal');
const inputNewName = document.getElementById('input-new-name');
const btnRenameConfirm = document.getElementById('btn-rename-confirm');
const btnRenameCancel = document.getElementById('btn-rename-cancel');

// ラベル付けオーバーレイ系
const labelingOverlay = document.getElementById('labeling-overlay');
const tagPalette = document.getElementById('tag-palette');
const dropTarget = document.getElementById('drop-target');
const overlayImg = document.getElementById('overlay-img');
const overlayTagsDisplay = document.getElementById('overlay-tags-display');
const overlayNewTagInput = document.getElementById('overlay-new-tag-input');
const btnOverlayAddTag = document.getElementById('btn-overlay-add-tag');
const btnCloseOverlay = document.getElementById('btn-close-overlay');

let images = [];
let filteredImages = [];
let imageTagsMap = {}; 
let allUniqueTags = [];
let includeTags = new Set();
let excludeTags = new Set();
let currentIndex = 0;
let currentImageTags = [];

const MODES = [
  { id: 'contain', label: '収まる', class: 'mode-contain' },
  { id: 'width', label: '幅合わせ', class: 'mode-width' },
  { id: 'height', label: '高さ合わせ', class: 'mode-height' },
  { id: 'original', label: 'オリジナル', class: 'mode-original' },
];
let currentModeIndex = 0;

let hideTimeout;

async function updateImage() {
  if (filteredImages.length === 0) {
    welcomeView.style.display = 'flex';
    imgElement.style.display = 'none';
    fileNameDisplay.innerText = 'ファイルを選択してください';
    return;
  }

  welcomeView.style.display = 'none';
  imgElement.style.display = 'block';

  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;

  imgElement.src = `file://${imagePath}`;
  fileNameDisplay.innerText = imagePath.split('/').pop();
  
  currentImageTags = imageTagsMap[imagePath] || await window.electronAPI.getTags(imagePath);
  renderCurrentImageTags();
}

function renderCurrentImageTags() {
  currentTagsContainer.innerHTML = '';
  currentImageTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'current-tag-pill';
    pill.innerHTML = `${tag} <span class="remove-tag" data-tag="${tag}">×</span>`;
    pill.querySelector('.remove-tag').onclick = (e) => {
      removeTag(e.target.dataset.tag);
    };
    currentTagsContainer.appendChild(pill);
  });
}

async function addTag() {
  const tag = inputSingleTag.value.trim();
  if (tag) {
    if (!currentImageTags.includes(tag)) {
      currentImageTags.push(tag);
      renderCurrentImageTags();
      await saveCurrentTags();
    }
    inputSingleTag.value = '';
  }
}

async function removeTag(tag) {
  currentImageTags = currentImageTags.filter(t => t !== tag);
  renderCurrentImageTags();
  await saveCurrentTags();
}

async function saveCurrentTags() {
  const imagePath = filteredImages[currentIndex];
  if (imagePath) {
    const success = await window.electronAPI.setTags({ filePath: imagePath, tags: currentImageTags });
    if (success) {
      imageTagsMap[imagePath] = [...currentImageTags];
      updateUniqueTags();
    }
  }
}

function updateDisplayMode() {
  const mode = MODES[currentModeIndex];
  imgElement.className = ''; 
  imgElement.classList.add(mode.class);
  displayModeLabel.innerText = `モード: ${mode.label}`;
}

async function nextImage() {
  if (filteredImages.length === 0) return;
  currentIndex = (currentIndex + 1) % filteredImages.length;
  updateImage();
  resetHideTimeout();
}

async function prevImage() {
  if (filteredImages.length === 0) return;
  currentIndex = (currentIndex - 1 + filteredImages.length) % filteredImages.length;
  updateImage();
  resetHideTimeout();
}

async function openFolder() {
  const path = await window.electronAPI.openDirectory();
  if (!path) return;
  
  images = await window.electronAPI.readImages(path);
  imageTagsMap = await window.electronAPI.getAllTags(images);
  
  updateUniqueTags();
  
  filteredImages = [...images];
  currentIndex = 0;
  updateImage();
}

function updateUniqueTags() {
  const tagSet = new Set();
  Object.values(imageTagsMap).forEach(tags => {
    tags.forEach(tag => tagSet.add(tag));
  });
  allUniqueTags = Array.from(tagSet).sort();
  
  renderFilterTags();
  renderSuggestions();
  if (typeof renderTagPalette === 'function') renderTagPalette();
}

function renderFilterTags() {
  allTagsListDiv.innerHTML = '';
  allUniqueTags.forEach(tag => {
    const pill = document.createElement('span');
    let statusClass = '';
    if (includeTags.has(tag)) statusClass = ' include';
    else if (excludeTags.has(tag)) statusClass = ' exclude';
    pill.className = 'tag-pill' + statusClass;
    pill.innerText = tag;
    pill.onclick = () => {
      toggleTagFilter(tag);
    };
    allTagsListDiv.appendChild(pill);
  });
}

function toggleTagFilter(tag) {
  if (includeTags.has(tag)) {
    includeTags.delete(tag);
    excludeTags.add(tag);
  } else if (excludeTags.has(tag)) {
    excludeTags.delete(tag);
  } else {
    includeTags.add(tag);
  }
  applyFilter();
  renderFilterTags();
}

function renderSuggestions() {
  tagSuggestions.innerHTML = '';
  allUniqueTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    tagSuggestions.appendChild(option);
  });
}

function applyFilter() {
  if (includeTags.size === 0 && excludeTags.size === 0) {
    filteredImages = [...images];
  } else {
    filteredImages = images.filter(path => {
      const tags = imageTagsMap[path] || [];
      const isExcluded = Array.from(excludeTags).some(tag => tags.includes(tag));
      if (isExcluded) return false;
      const hasAllIncludes = Array.from(includeTags).every(tag => tags.includes(tag));
      if (!hasAllIncludes) return false;
      return true;
    });
  }
  currentIndex = 0;
  updateImage();
}

function resetHideTimeout() {
  controls.classList.remove('hidden');
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    controls.classList.add('hidden');
  }, 3000);
}

// ファイル操作系
async function handleRename() {
  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;
  
  const newName = inputNewName.value.trim();
  if (!newName) return;
  
  const result = await window.electronAPI.renameFile({ oldPath: imagePath, newName: newName });
  if (result.success) {
    // キャッシュとリストを更新
    const oldPath = imagePath;
    const newPath = result.newPath;
    
    // imageTagsMap のキーを更新
    const tags = imageTagsMap[oldPath];
    if (tags) {
      imageTagsMap[newPath] = tags;
      delete imageTagsMap[oldPath];
    }
    
    // images 配列内のパスを置換
    images = images.map(p => p === oldPath ? newPath : p);
    filteredImages = filteredImages.map(p => p === oldPath ? newPath : p);
    
    // 更新した画像を表示
    currentIndex = filteredImages.indexOf(newPath);
    updateImage();
    renameModal.style.display = 'none';
  } else {
    alert('エラー: ' + result.error);
  }
}

// ラベル付けオーバーレイ関連
function toggleLabelingOverlay() {
  if (labelingOverlay.classList.contains('overlay-hidden')) {
    const imagePath = filteredImages[currentIndex];
    if (!imagePath) return;

    overlayImg.src = `file://${imagePath}`;
    renderTagPalette();
    renderOverlayTags();
    labelingOverlay.classList.remove('overlay-hidden');
    overlayNewTagInput.focus();
  } else {
    labelingOverlay.classList.add('overlay-hidden');
  }
}

function renderTagPalette() {
  tagPalette.innerHTML = '';
  if (allUniqueTags.length === 0) {
    tagPalette.innerHTML = '<div style="color: #555; font-size: 12px; width: 100%; text-align: center; margin-top: 20px;">まだタグがありません。下の入力欄から追加してください。</div>';
    return;
  }
  allUniqueTags.forEach(tag => {
    const el = document.createElement('div');
    el.className = 'palette-tag';
    el.innerText = tag;
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('tag', tag);
      e.dataTransfer.setData('action-add', 'true');
    });
    tagPalette.appendChild(el);
  });
}

function renderOverlayTags() {
  overlayTagsDisplay.innerHTML = '';
  currentImageTags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'overlay-tags-pill';
    span.innerText = tag;
    span.draggable = true;
    span.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('tag', tag);
      e.dataTransfer.setData('action-remove', 'true');
      // ドラッグ中であることを視覚的に示す
      span.style.opacity = '0.5';
    });
    span.addEventListener('dragend', () => {
      span.style.opacity = '1';
    });
    overlayTagsDisplay.appendChild(span);
  });
}

async function addTagFromOverlay() {
  const tag = overlayNewTagInput.value.trim();
  if (tag) {
    if (!currentImageTags.includes(tag)) {
      currentImageTags.push(tag);
      renderOverlayTags();
      renderCurrentImageTags();
      await saveCurrentTags();
      renderTagPalette(); // paletteも更新される可能性がある（新規タグの場合）
    }
    overlayNewTagInput.value = '';
  }
}

// ドラッグ＆ドロップ
dropTarget.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('action-add')) {
    e.preventDefault();
    dropTarget.classList.add('drag-over');
  }
});

dropTarget.addEventListener('dragleave', () => {
  dropTarget.classList.remove('drag-over');
});

dropTarget.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropTarget.classList.remove('drag-over');
  const tag = e.dataTransfer.getData('tag');
  
  if (e.dataTransfer.types.includes('action-add') && tag && !currentImageTags.includes(tag)) {
    currentImageTags.push(tag);
    renderOverlayTags();
    renderCurrentImageTags();
    await saveCurrentTags();
  }
});

// パレットを削除のドロップターゲットにする
tagPalette.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('action-remove')) {
    e.preventDefault();
    tagPalette.classList.add('trash-zone');
  }
});

tagPalette.addEventListener('dragleave', () => {
  tagPalette.classList.remove('trash-zone');
});

tagPalette.addEventListener('drop', async (e) => {
  e.preventDefault();
  tagPalette.classList.remove('trash-zone');
  const tag = e.dataTransfer.getData('tag');
  
  if (e.dataTransfer.types.includes('action-remove') && tag) {
    currentImageTags = currentImageTags.filter(t => t !== tag);
    renderOverlayTags();
    renderCurrentImageTags();
    await saveCurrentTags();
  }
});

// イベント登録
btnOpen.addEventListener('click', openFolder);
btnPrev.addEventListener('click', prevImage);
btnNext.addEventListener('click', nextImage);
btnAddTag.addEventListener('click', addTag);
inputSingleTag.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) addTag();
});
btnClearFilter.addEventListener('click', () => {
  includeTags.clear();
  excludeTags.clear();
  applyFilter();
  renderFilterTags();
}
);

btnRenameTrigger.addEventListener('click', () => {
  renameModal.style.display = 'flex';
  inputNewName.value = '';
  inputNewName.focus();
});

inputNewName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) handleRename();
});

btnRenameCancel.addEventListener('click', () => {
  renameModal.style.display = 'none';
});

btnRenameConfirm.addEventListener('click', handleRename);

btnOverlayAddTag.addEventListener('click', addTagFromOverlay);
overlayNewTagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) addTagFromOverlay();
});
btnCloseOverlay.addEventListener('click', toggleLabelingOverlay);

window.addEventListener('keydown', (e) => {
  if (document.activeElement === inputSingleTag || 
      document.activeElement === inputNewName || 
      document.activeElement === overlayNewTagInput) return;
  const key = e.key.toLowerCase();
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    toggleLabelingOverlay();
    return;
  }
  if (!labelingOverlay.classList.contains('overlay-hidden')) {
    if (e.key === 'Escape') toggleLabelingOverlay();
    return;
  }
  if (e.key === 'ArrowRight' || key === 'd') {
    nextImage();
  } else if (e.key === 'ArrowLeft' || key === 'a') {
    prevImage();
  } else if (e.key === 'ArrowUp' || key === 'w') {
    currentModeIndex = (currentModeIndex + 1) % MODES.length;
    updateDisplayMode();
    resetHideTimeout();
  } else if (e.key === 'ArrowDown' || key === 's') {
    currentModeIndex = (currentModeIndex - 1 + MODES.length) % MODES.length;
    updateDisplayMode();
    resetHideTimeout();
  } else {
    resetHideTimeout();
  }
});

window.addEventListener('mousemove', resetHideTimeout);

updateDisplayMode();
