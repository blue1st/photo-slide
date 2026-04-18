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
    renderGridView();
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
    renderGridView();
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
  const items = gridView.querySelectorAll('.grid-item');
  if (items.length <= 1) return 0;
  const firstRect = items[0].getBoundingClientRect();
  for (let i = 1; i < items.length; i++) {
    if (items[i].getBoundingClientRect().top > firstRect.top) {
      return i;
    }
  }
  return items.length;
}

function renderGridView() {
  gridView.innerHTML = '';
  filteredImages.forEach((imagePath, index) => {
    const item = document.createElement('div');
    item.className = 'grid-item' + (selectedImages.has(imagePath) ? ' selected' : '');
    if (index === currentIndex) {
      item.style.boxShadow = '0 0 0 2px #fff';
      // スクロール位置を調整
      setTimeout(() => {
        item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }, 0);
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
      toggleImageSelection(imagePath);
    };
    checkboxWrapper.appendChild(checkbox);

    const name = document.createElement('div');
    name.className = 'grid-item-name';
    name.innerText = imagePath.split('/').pop();

    item.appendChild(img);
    item.appendChild(checkboxWrapper);
    item.appendChild(name);

    item.onclick = () => {
      currentIndex = index;
      toggleImageSelection(imagePath);
    };

    gridView.appendChild(item);
  });
}

function toggleImageSelection(imagePath) {
  if (selectedImages.has(imagePath)) {
    selectedImages.delete(imagePath);
  } else {
    selectedImages.add(imagePath);
  }
  renderGridView();
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
  currentIndex = 0;
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
    bulkLabelingOverlay.classList.remove('overlay-hidden');
    inputBulkAddTag.focus();
  } else {
    bulkLabelingOverlay.classList.add('overlay-hidden');
  }
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
  if (isGridView) renderGridView();
  else updateImage();
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
  selectedImages.clear();
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
  selectedImages.clear();
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
        updateImage();
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
        updateImage();
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
