const imgElement = document.getElementById('main-image');
const btnOpen = document.getElementById('btn-open');
const btnHistoryToggle = document.getElementById('btn-history-toggle');
const historyPopup = document.getElementById('history-popup');
const historyItems = document.getElementById('history-items');
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
const tagEditor = document.getElementById('tag-editor');
const fileInfoGroup = document.querySelector('.file-info-group');
const fileActionsGroup = document.querySelector('.file-actions');

// ファイル操作系
const btnRenameTrigger = document.getElementById('btn-rename-trigger');
const btnCopyTrigger = document.getElementById('btn-copy-trigger');
const btnMoveTrigger = document.getElementById('btn-move-trigger');
const btnDeleteTrigger = document.getElementById('btn-delete-trigger');
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

// 一括ラベル付けオーバーレイ系
const bulkLabelingOverlay = document.getElementById('bulk-labeling-overlay');
const bulkSelectionCount = document.getElementById('bulk-selection-count');
const bulkSelectedThumbnails = document.getElementById('bulk-selected-thumbnails');
const bulkAddTagsContainer = document.getElementById('bulk-add-tags-container');
const bulkRemoveTagsContainer = document.getElementById('bulk-remove-tags-container');
const inputBulkAddTag = document.getElementById('input-bulk-add-tag');
const inputBulkRemoveTag = document.getElementById('input-bulk-remove-tag');
const btnBulkApply = document.getElementById('btn-bulk-apply');
const btnBulkCancel = document.getElementById('btn-bulk-cancel');
const btnBulkCopy = document.getElementById('btn-bulk-copy');
const btnBulkMove = document.getElementById('btn-bulk-move');
const btnBulkDelete = document.getElementById('btn-bulk-delete');

// グリッドビュー系
const gridView = document.getElementById('grid-view');
const selectionIndicator = document.getElementById('selection-indicator');
const selectionCountText = document.getElementById('selection-count-text');
const btnClearSelection = document.getElementById('btn-clear-selection');
const btnOpenBulk = document.getElementById('btn-open-bulk');

let images = [];
let filteredImages = [];
let imageTagsMap = {}; 
let allUniqueTags = [];
let includeTags = new Set();
let excludeTags = new Set();
let currentIndex = 0;
let currentImageTags = [];
let isGridView = false;
let selectedImages = new Set();
let bulkAddTags = new Set();
let bulkRemoveTags = new Set();
let isUntaggedOnlyFilter = false;
let currentFolderPath = '';

const MODES = [
  { id: 'contain', label: '収まる', class: 'mode-contain' },
  { id: 'width', label: '幅合わせ', class: 'mode-width' },
  { id: 'height', label: '高さ合わせ', class: 'mode-height' },
  { id: 'original', label: 'オリジナル', class: 'mode-original' },
];
let currentModeIndex = 0;
let folderHistory = JSON.parse(localStorage.getItem('folderHistory') || '[]');

let hideTimeout;

function syncGridCurrentItem() {
  const oldItem = gridView.querySelector('.current-item');
  if (oldItem) {
    oldItem.style.boxShadow = '';
    oldItem.classList.remove('current-item');
  }

  const currentPath = filteredImages[currentIndex];
  if (!currentPath) return;

  const newItem = gridView.querySelector(`.grid-item[data-path="${CSS.escape(currentPath)}"]`);
  if (newItem) {
    newItem.style.boxShadow = '0 0 0 2px #fff';
    newItem.classList.add('current-item');
    newItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

async function updateImage(onlySelection = false) {
  if (filteredImages.length === 0) {
    if (images.length > 0) {
      // フォルダは開いているが該当なしの場合
      welcomeView.style.display = 'none';
      fileNameDisplay.innerText = '該当する画像はありません';
    } else {
      // フォルダ自体開いていない場合
      welcomeView.style.display = 'flex';
      fileNameDisplay.innerText = 'ファイルを選択してください';
    }
    imgElement.style.display = 'none';
    gridView.classList.add('hidden');
    currentImageTags = [];
    renderCurrentImageTags();
    return;
  }

  if (isGridView) {
    if (gridView.innerHTML === '') {
      renderGridView();
    } else {
      if (!onlySelection) {
        const filteredSet = new Set(filteredImages);
        const items = gridView.querySelectorAll('.grid-item');
        items.forEach(item => {
          const path = item.dataset.path;
          if (filteredSet.has(path)) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      }
      syncGridCurrentItem();
    }
    return;
  }

  welcomeView.style.display = 'none';
  imgElement.style.display = 'block';

  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;

  imgElement.src = `file://${imagePath}`;
  fileNameDisplay.innerText = imagePath.split('/').pop();
  
  if (imageTagsMap[imagePath] === undefined) {
    // If not loaded in background yet, fetch tags on demand and cache them
    const fetchedTags = await window.electronAPI.getTags(imagePath);
    if (imageTagsMap[imagePath] === undefined) {
      imageTagsMap[imagePath] = fetchedTags;
    }
  }
  currentImageTags = imageTagsMap[imagePath] || [];
  renderCurrentImageTags();
}

function toggleGridView() {
  isGridView = !isGridView;
  if (isGridView) {
    imgElement.style.display = 'none';
    controls.classList.add('hidden');
    gridView.classList.remove('hidden');
    tagEditor.style.display = 'none';
    fileInfoGroup.style.display = 'none';
    fileActionsGroup.style.display = 'none';
    displayModeLabel.style.display = 'none';
    if (gridView.innerHTML === '') {
      renderGridView();
    } else {
      updateImage();
    }
  } else {
    gridView.classList.add('hidden');
    imgElement.style.display = 'block';
    tagEditor.style.display = 'flex';
    fileInfoGroup.style.display = 'flex';
    fileActionsGroup.style.display = 'flex';
    displayModeLabel.style.display = 'block';
    updateImage();
  }
}

function getGridColumns() {
  const gridStyle = window.getComputedStyle(gridView);
  return gridStyle.gridTemplateColumns.split(' ').length;
}

function renderGridView() {
  gridView.innerHTML = '';
  const fragment = document.createDocumentFragment();
  let currentItemEl = null;

  const filteredSet = new Set(filteredImages);

  images.forEach((imagePath) => {
    const isFiltered = !filteredSet.has(imagePath);
    const item = document.createElement('div');
    item.className = 'grid-item' + 
      (selectedImages.has(imagePath) ? ' selected' : '') + 
      (isFiltered ? ' hidden' : '');
    item.dataset.path = imagePath;
    
    const currentPath = filteredImages[currentIndex];
    if (imagePath === currentPath) {
      item.style.boxShadow = '0 0 0 2px #fff';
      item.classList.add('current-item');
      currentItemEl = item;
    }

    const img = document.createElement('img');
    img.src = `file://${imagePath}`;
    img.className = 'grid-thumbnail';
    img.loading = 'lazy';

    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'grid-checkbox-wrapper';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'grid-checkbox';
    checkbox.checked = selectedImages.has(imagePath);
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleImageSelection(imagePath, item, checkbox);
    };
    checkboxWrapper.appendChild(checkbox);

    const name = document.createElement('div');
    name.className = 'grid-item-name';
    name.innerText = imagePath.split('/').pop();

    item.appendChild(img);
    item.appendChild(checkboxWrapper);
    item.appendChild(name);

    item.onclick = () => {
      const idx = filteredImages.indexOf(imagePath);
      if (idx !== -1) {
        updateCurrentIndex(idx, item);
        toggleImageSelection(imagePath, item, checkbox);
      }
    };

    fragment.appendChild(item);
  });
  
  gridView.appendChild(fragment);

  if (currentItemEl) {
    setTimeout(() => {
      currentItemEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 0);
  }
}

function updateCurrentIndex(newIndex, newItemElement) {
  const oldItem = gridView.querySelector('.current-item');
  if (oldItem) {
    oldItem.style.boxShadow = '';
    oldItem.classList.remove('current-item');
  }
  
  currentIndex = newIndex;
  
  if (newItemElement) {
    newItemElement.style.boxShadow = '0 0 0 2px #fff';
    newItemElement.classList.add('current-item');
  }
}

function toggleImageSelection(imagePath, itemElement = null, checkboxElement = null) {
  if (selectedImages.has(imagePath)) {
    selectedImages.delete(imagePath);
  } else {
    selectedImages.add(imagePath);
  }
  
  if (!itemElement) {
    itemElement = gridView.querySelector(`.grid-item[data-path="${CSS.escape(imagePath)}"]`);
  }
  
  if (itemElement) {
    if (selectedImages.has(imagePath)) {
      itemElement.classList.add('selected');
    } else {
      itemElement.classList.remove('selected');
    }
    
    if (!checkboxElement) {
      checkboxElement = itemElement.querySelector('.grid-checkbox');
    }
    if (checkboxElement) {
      checkboxElement.checked = selectedImages.has(imagePath);
    }
  }
  updateSelectionIndicator();
}

function updateSelectionIndicator() {
  if (selectedImages.size > 0) {
    selectionCountText.innerText = `${selectedImages.size}個選択中`;
    selectionIndicator.classList.remove('hidden');
  } else {
    selectionIndicator.classList.add('hidden');
  }
}

function clearAllSelections() {
  selectedImages.clear();
  if (isGridView) {
    const selectedItems = gridView.querySelectorAll('.grid-item.selected');
    selectedItems.forEach(item => {
      item.classList.remove('selected');
      const cb = item.querySelector('.grid-checkbox');
      if (cb) cb.checked = false;
    });
  }
  updateSelectionIndicator();
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
  updateImage(true);
  resetHideTimeout();
}

async function prevImage() {
  if (filteredImages.length === 0) return;
  currentIndex = (currentIndex - 1 + filteredImages.length) % filteredImages.length;
  updateImage(true);
  resetHideTimeout();
}

async function openFolder() {
  const path = await window.electronAPI.openDirectory();
  if (!path) return;
  loadFolder(path);
}

async function loadFolder(path) {
  gridView.innerHTML = '';
  try {
    images = await window.electronAPI.readImages(path);
    if (images.length === 0) {
      // フォルダが存在しないか空の場合
    }
  } catch (err) {
    alert('フォルダを開けませんでした。削除されている可能性があります。');
    return;
  }

  // Reset tag states and trigger background loading
  currentFolderPath = path;
  imageTagsMap = {};
  
  updateUniqueTags();
  
  filteredImages = [...images];
  currentIndex = 0;
  updateImage();

  saveToHistory(path);

  // Background load tags progressively
  loadTagsInBackground(path, images);
}

async function loadTagsInBackground(folderPath, imagesList) {
  const statusEl = document.getElementById('tag-loading-status');
  if (statusEl) {
    statusEl.innerText = `タグ読み込み中... (0/${imagesList.length})`;
    statusEl.classList.remove('hidden');
  }

  const batchSize = 100;
  let loadedCount = 0;

  for (let i = 0; i < imagesList.length; i += batchSize) {
    if (currentFolderPath !== folderPath) return;

    const chunk = imagesList.slice(i, i + batchSize);
    try {
      const tagsBatch = await window.electronAPI.getAllTags(chunk);
      if (currentFolderPath !== folderPath) return;

      // Merge tags into imageTagsMap only for files still present in the directory
      for (const [fp, tags] of Object.entries(tagsBatch)) {
        if (images.includes(fp)) {
          imageTagsMap[fp] = tags;
        }
      }
      loadedCount += chunk.length;

      if (statusEl) {
        statusEl.innerText = `タグ読み込み中... (${loadedCount}/${imagesList.length})`;
      }

      updateUniqueTags();

      // If active filter is in use, re-run filtering progressively
      if (includeTags.size > 0 || excludeTags.size > 0 || isUntaggedOnlyFilter) {
        applyFilter();
      }

      // If current image tags are updated, refresh current tag display
      const currentImagePath = filteredImages[currentIndex];
      if (chunk.includes(currentImagePath)) {
        currentImageTags = imageTagsMap[currentImagePath] || [];
        renderCurrentImageTags();
      }
    } catch (err) {
      console.error('Error loading tags in background:', err);
    }
    
    // Yield to the event loop to ensure UI thread responsiveness
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (currentFolderPath === folderPath && statusEl) {
    statusEl.classList.add('hidden');
  }
}

function saveToHistory(path) {
  folderHistory = folderHistory.filter(p => p !== path);
  folderHistory.unshift(path);
  if (folderHistory.length > 10) {
    folderHistory.pop();
  }
  localStorage.setItem('folderHistory', JSON.stringify(folderHistory));
  renderHistory();
}

function renderHistory() {
  historyItems.innerHTML = '';
  if (folderHistory.length === 0) {
    historyItems.innerHTML = '<div style="padding: 10px; color: #666; font-size: 12px; text-align: center;">履歴はありません</div>';
    return;
  }

  folderHistory.forEach(path => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const folderName = path.split('/').pop() || path;
    
    item.innerHTML = `
      <div class="path-info">
        <span class="folder-name">${folderName}</span>
        <span class="full-path">${path}</span>
      </div>
      <button class="btn-remove-item" title="履歴から削除">×</button>
    `;
    
    item.onclick = () => {
      loadFolder(path);
      historyPopup.classList.add('hidden');
    };
    
    const btnRemove = item.querySelector('.btn-remove-item');
    btnRemove.onclick = (e) => {
      e.stopPropagation();
      removeHistoryItem(path);
    };
    
    historyItems.appendChild(item);
  });
}

function removeHistoryItem(path) {
  folderHistory = folderHistory.filter(p => p !== path);
  localStorage.setItem('folderHistory', JSON.stringify(folderHistory));
  renderHistory();
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
  const oldCurrentPath = filteredImages[currentIndex];

  if (includeTags.size === 0 && excludeTags.size === 0 && !isUntaggedOnlyFilter) {
    filteredImages = [...images];
  } else {
    filteredImages = images.filter(path => {
      const tags = imageTagsMap[path] || [];
      
      if (isUntaggedOnlyFilter && tags.length > 0) return false;

      const isExcluded = Array.from(excludeTags).some(tag => tags.includes(tag));
      if (isExcluded) return false;
      
      const hasAllIncludes = Array.from(includeTags).every(tag => tags.includes(tag));
      if (!hasAllIncludes) return false;
      
      return true;
    });
  }

  const newIndex = filteredImages.indexOf(oldCurrentPath);
  if (newIndex !== -1) {
    currentIndex = newIndex;
  } else {
    currentIndex = 0;
  }
  
  updateImage();

  // ボタンの表示状態を更新
  const btnUntagged = document.getElementById('btn-untagged-filter');
  if (isUntaggedOnlyFilter) {
    btnUntagged.classList.add('active');
  } else {
    btnUntagged.classList.remove('active');
  }
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

// 一括ラベル付け関連
function toggleBulkLabelingOverlay() {
  if (bulkLabelingOverlay.classList.contains('overlay-hidden')) {
    if (selectedImages.size === 0) {
      alert('ファイルが選択されていません。');
      return;
    }
    bulkAddTags.clear();
    bulkRemoveTags.clear();
    bulkSelectionCount.innerText = `${selectedImages.size}個のファイルが選択されています`;
    renderBulkTags();
    renderBulkThumbnails();
    bulkLabelingOverlay.classList.remove('overlay-hidden');
    inputBulkAddTag.focus();
  } else {
    bulkLabelingOverlay.classList.add('overlay-hidden');
  }
}

function renderBulkThumbnails() {
  bulkSelectedThumbnails.innerHTML = '';
  const maxThumbnails = 50;
  let count = 0;
  const fragment = document.createDocumentFragment();
  
  for (const imagePath of selectedImages) {
    if (count >= maxThumbnails) {
      const more = document.createElement('div');
      more.className = 'bulk-thumbnail-more';
      more.innerText = `+${selectedImages.size - maxThumbnails}`;
      fragment.appendChild(more);
      break;
    }
    const img = document.createElement('img');
    img.src = `file://${imagePath}`;
    img.className = 'bulk-thumbnail';
    img.loading = 'lazy';
    fragment.appendChild(img);
    count++;
  }
  bulkSelectedThumbnails.appendChild(fragment);
}

function renderBulkTags() {
  bulkAddTagsContainer.innerHTML = '';
  bulkAddTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'bulk-tag-pill add';
    pill.innerHTML = `${tag} <span class="close">×</span>`;
    pill.querySelector('.close').onclick = () => {
      bulkAddTags.delete(tag);
      renderBulkTags();
    };
    bulkAddTagsContainer.appendChild(pill);
  });

  bulkRemoveTagsContainer.innerHTML = '';
  bulkRemoveTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'bulk-tag-pill remove';
    pill.innerHTML = `${tag} <span class="close">×</span>`;
    pill.querySelector('.close').onclick = () => {
      bulkRemoveTags.delete(tag);
      renderBulkTags();
    };
    bulkRemoveTagsContainer.appendChild(pill);
  });
}

async function applyBulkTags() {
  const paths = Array.from(selectedImages);
  for (const path of paths) {
    let tags = imageTagsMap[path] || await window.electronAPI.getTags(path);
    
    // 追加
    bulkAddTags.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag);
    });
    
    // 削除
    bulkRemoveTags.forEach(tag => {
      tags = tags.filter(t => t !== tag);
    });

    await window.electronAPI.setTags({ filePath: path, tags: tags });
    imageTagsMap[path] = tags;
  }
  
  updateUniqueTags();
  toggleBulkLabelingOverlay();
  clearAllSelections();
  applyFilter();
}

// ファイル操作関連
async function copySingleFile() {
  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;
  const destDir = await window.electronAPI.selectDirectory();
  if (!destDir) return;
  const result = await window.electronAPI.copyFile({ src: imagePath, destDir });
  if (result.success) {
    alert('コピー完了しました');
  } else {
    alert('エラー: ' + result.error);
  }
}

async function moveSingleFile() {
  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;
  const destDir = await window.electronAPI.selectDirectory();
  if (!destDir) return;
  const result = await window.electronAPI.moveFile({ src: imagePath, destDir });
  if (result.success) {
    removeFromLists(imagePath);
    updateImage();
  } else {
    alert('エラー: ' + result.error);
  }
}

async function deleteSingleFile() {
  const imagePath = filteredImages[currentIndex];
  if (!imagePath) return;
  if (!confirm('ファイルをゴミ箱に移動しますか？')) return;
  const result = await window.electronAPI.trashFile(imagePath);
  if (result.success) {
    removeFromLists(imagePath);
    updateImage();
  } else {
    alert('エラー: ' + result.error);
  }
}

async function copyBulkFiles() {
  if (selectedImages.size === 0) return;
  const destDir = await window.electronAPI.selectDirectory();
  if (!destDir) return;
  let count = 0;
  for (const path of selectedImages) {
    const res = await window.electronAPI.copyFile({ src: path, destDir });
    if (res.success) count++;
  }
  alert(`${count}個のファイルをコピーしました`);
}

async function moveBulkFiles() {
  if (selectedImages.size === 0) return;
  const destDir = await window.electronAPI.selectDirectory();
  if (!destDir) return;
  let count = 0;
  for (const path of selectedImages) {
    const res = await window.electronAPI.moveFile({ src: path, destDir });
    if (res.success) {
      removeFromLists(path);
      count++;
    }
  }
  clearAllSelections();
  toggleBulkLabelingOverlay();
  if (isGridView) renderGridView();
  else updateImage();
  alert(`${count}個のファイルを移動しました`);
}

async function deleteBulkFiles() {
  if (selectedImages.size === 0) return;
  if (!confirm(`${selectedImages.size}個のファイルをゴミ箱に移動しますか？`)) return;
  let count = 0;
  for (const path of selectedImages) {
    const res = await window.electronAPI.trashFile(path);
    if (res.success) {
      removeFromLists(path);
      count++;
    }
  }
  clearAllSelections();
  toggleBulkLabelingOverlay();
  if (isGridView) renderGridView();
  else updateImage();
  alert(`${count}個のファイルを削除しました`);
}

function removeFromLists(path) {
  images = images.filter(p => p !== path);
  filteredImages = filteredImages.filter(p => p !== path);
  delete imageTagsMap[path];
  if (currentIndex >= filteredImages.length && filteredImages.length > 0) {
    currentIndex = filteredImages.length - 1;
  }
  const el = gridView.querySelector(`.grid-item[data-path="${CSS.escape(path)}"]`);
  if (el) el.remove();
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
btnClearSelection.addEventListener('click', clearAllSelections);
btnOpenBulk.addEventListener('click', toggleBulkLabelingOverlay);
btnOpen.addEventListener('click', openFolder);
btnHistoryToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  historyPopup.classList.toggle('hidden');
});

// ポップアップの外側クリックで閉じる
window.addEventListener('click', () => {
  historyPopup.classList.add('hidden');
});
historyPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});
btnPrev.addEventListener('click', prevImage);
btnNext.addEventListener('click', nextImage);
btnAddTag.addEventListener('click', addTag);
inputSingleTag.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) addTag();
});
btnClearFilter.addEventListener('click', () => {
  includeTags.clear();
  excludeTags.clear();
  isUntaggedOnlyFilter = false;
  applyFilter();
  renderFilterTags();
});

const btnUntaggedFilter = document.getElementById('btn-untagged-filter');
btnUntaggedFilter.addEventListener('click', () => {
  isUntaggedOnlyFilter = !isUntaggedOnlyFilter;
  applyFilter();
});

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

// 一括ラベル用イベント
inputBulkAddTag.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    const tag = inputBulkAddTag.value.trim();
    if (tag) {
      bulkAddTags.add(tag);
      inputBulkAddTag.value = '';
      renderBulkTags();
    }
  }
});
inputBulkRemoveTag.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    const tag = inputBulkRemoveTag.value.trim();
    if (tag) {
      bulkRemoveTags.add(tag);
      inputBulkRemoveTag.value = '';
      renderBulkTags();
    }
  }
});
btnBulkApply.addEventListener('click', applyBulkTags);
btnBulkCancel.addEventListener('click', toggleBulkLabelingOverlay);
btnBulkCopy.addEventListener('click', copyBulkFiles);
btnBulkMove.addEventListener('click', moveBulkFiles);
btnBulkDelete.addEventListener('click', deleteBulkFiles);

btnCopyTrigger.addEventListener('click', copySingleFile);
btnMoveTrigger.addEventListener('click', moveSingleFile);
btnDeleteTrigger.addEventListener('click', deleteSingleFile);

window.addEventListener('keydown', (e) => {
  if (document.activeElement === inputSingleTag || 
      document.activeElement === inputNewName || 
      document.activeElement === overlayNewTagInput ||
      document.activeElement === inputBulkAddTag ||
      document.activeElement === inputBulkRemoveTag) return;
  const key = e.key.toLowerCase();
  if (e.key === 'Tab') {
    e.preventDefault();
    toggleGridView();
    return;
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    if (isGridView) {
      toggleBulkLabelingOverlay();
    } else {
      toggleLabelingOverlay();
    }
    return;
  }
  if (!labelingOverlay.classList.contains('overlay-hidden')) {
    if (e.key === 'Escape') toggleLabelingOverlay();
    return;
  }
  if (!bulkLabelingOverlay.classList.contains('overlay-hidden')) {
    if (e.key === 'Escape') toggleBulkLabelingOverlay();
    return;
  }
  if (e.key === 'ArrowRight' || key === 'd') {
    nextImage();
  } else if (e.key === 'ArrowLeft' || key === 'a') {
    prevImage();
  } else if (e.key === 'ArrowUp' || key === 'w') {
    if (isGridView) {
      const cols = getGridColumns();
      if (cols > 0) {
        currentIndex = Math.max(0, currentIndex - cols);
        updateImage(true);
      }
    } else {
      currentModeIndex = (currentModeIndex + 1) % MODES.length;
      updateDisplayMode();
    }
    resetHideTimeout();
  } else if (e.key === 'ArrowDown' || key === 's') {
    if (isGridView) {
      const cols = getGridColumns();
      if (cols > 0) {
        currentIndex = Math.min(filteredImages.length - 1, currentIndex + cols);
        updateImage(true);
      }
    } else {
      currentModeIndex = (currentModeIndex - 1 + MODES.length) % MODES.length;
      updateDisplayMode();
    }
    resetHideTimeout();
  } else {
    resetHideTimeout();
  }
});

window.addEventListener('mousemove', resetHideTimeout);

updateDisplayMode();
renderHistory();
