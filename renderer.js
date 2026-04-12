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

window.addEventListener('keydown', (e) => {
  if (document.activeElement === inputSingleTag || document.activeElement === inputNewName) return;
  const key = e.key.toLowerCase();
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
