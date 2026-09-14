/**
 * PDF Text Editor - 100% Client-Side Engine
 * Built with PDF.js and pdf-lib
 */

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
const state = {
  pdfDoc: null,           // PDF.js document object
  rawPdfBytes: null,      // Uint8Array / ArrayBuffer of loaded PDF
  fileName: 'document.pdf',
  pageNum: 1,
  totalPages: 0,
  scale: 1.25,            // 125% zoom by default
  viewport: null,
  pdfPageWidthPoints: 0,
  pdfPageHeightPoints: 0,
  pageItems: {},          // Map of pageNum -> Array of text items
  addedItems: {},         // Map of pageNum -> Array of custom added text items
  activeItem: null,       // Currently selected field object
  editsCount: 0,
  isRendering: false,
  isPreviewMode: false
};

// DOM Element References
const elements = {
  fileInput: document.getElementById('file-input'),
  btnUpload: document.getElementById('btn-upload'),
  btnSample: document.getElementById('btn-sample'),
  btnSampleLanding: document.getElementById('btn-sample-landing'),
  btnBrowseFile: document.getElementById('btn-browse-file'),
  btnExport: document.getElementById('btn-export'),
  exportText: document.getElementById('export-text'),
  
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  pageNumDisplay: document.getElementById('page-num-display'),
  
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomFit: document.getElementById('btn-zoom-fit'),
  zoomDisplay: document.getElementById('zoom-display'),
  
  btnAddText: document.getElementById('btn-add-text'),
  btnTogglePreview: document.getElementById('btn-toggle-preview'),
  btnClearEdits: document.getElementById('btn-clear-edits'),
  editsCounter: document.getElementById('edits-counter'),
  
  dropzone: document.getElementById('dropzone'),
  dropzoneCard: document.getElementById('dropzone-card'),
  viewport: document.getElementById('viewport'),
  pageContainer: document.getElementById('page-container'),
  pdfCanvas: document.getElementById('pdf-canvas'),
  textOverlay: document.getElementById('text-overlay'),
  
  floatingToolbar: document.getElementById('floating-toolbar'),
  fontFamilySelect: document.getElementById('font-family-select'),
  fontSizeSelect: document.getElementById('font-size-select'),
  textColorInput: document.getElementById('text-color-input'),
  bgColorInput: document.getElementById('bg-color-input'),
  btnRestoreField: document.getElementById('btn-restore-field'),
  btnToggleRedact: document.getElementById('btn-toggle-redact'),
  btnDeleteField: document.getElementById('btn-delete-field'),
  
  toastContainer: document.getElementById('toast-container')
};

// --- Initialization ---
function init() {
  attachEventListeners();
}

function attachEventListeners() {
  // File Upload Handlers
  elements.btnUpload.addEventListener('click', () => elements.fileInput.click());
  elements.btnBrowseFile.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Sample File Handlers
  elements.btnSample.addEventListener('click', loadSamplePDF);
  elements.btnSampleLanding.addEventListener('click', loadSamplePDF);

  // Drag and Drop
  elements.dropzoneCard.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-sample-landing') && !e.target.closest('#btn-browse-file')) {
      elements.fileInput.click();
    }
  });
  elements.dropzoneCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzoneCard.classList.add('drag-over');
  });
  elements.dropzoneCard.addEventListener('dragleave', () => {
    elements.dropzoneCard.classList.remove('drag-over');
  });
  elements.dropzoneCard.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzoneCard.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  // Navigation
  elements.btnPrev.addEventListener('click', () => changePage(-1));
  elements.btnNext.addEventListener('click', () => changePage(1));

  // Zoom
  elements.btnZoomOut.addEventListener('click', () => setZoom(state.scale - 0.2));
  elements.btnZoomIn.addEventListener('click', () => setZoom(state.scale + 0.2));
  elements.btnZoomFit.addEventListener('click', fitZoomToViewport);

  // Tools
  elements.btnAddText.addEventListener('click', addNewTextBox);
  elements.btnTogglePreview.addEventListener('click', toggleCleanPreview);
  elements.btnClearEdits.addEventListener('click', resetAllEdits);
  elements.btnExport.addEventListener('click', exportPDF);

  // Floating Formatting Toolbar Handlers
  elements.fontFamilySelect.addEventListener('change', updateActiveFieldStyle);
  elements.fontSizeSelect.addEventListener('input', updateActiveFieldStyle);
  elements.fontSizeSelect.addEventListener('change', updateActiveFieldStyle);
  elements.textColorInput.addEventListener('input', updateActiveFieldStyle);
  elements.bgColorInput.addEventListener('input', updateActiveFieldStyle);
  elements.btnRestoreField.addEventListener('click', restoreActiveField);
  elements.btnToggleRedact.addEventListener('click', toggleRedactActiveField);
  elements.btnDeleteField.addEventListener('click', deleteActiveField);

  // Click outside to deselect
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.editable-field') && !e.target.closest('.floating-toolbar') && !e.target.closest('#sub-toolbar')) {
      deselectActiveField();
    }
  });
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span style="color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1'}">•</span>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- PDF Loading Functions ---
function handleFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    processFile(file);
  }
  // Reset input value so re-selecting the same file fires change event
  e.target.value = '';
}

async function processFile(file) {
  const isPdf = (file.type && file.type.includes('pdf')) || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    showToast('Please select a valid PDF file (.pdf).', 'error');
    return;
  }

  state.fileName = file.name;
  try {
    const arrayBuffer = await file.arrayBuffer();
    await loadPDFBytes(arrayBuffer);
  } catch (err) {
    console.error('Error reading PDF file:', err);
    showToast('Failed to read PDF file.', 'error');
  }
}

async function loadPDFBytes(arrayBuffer) {
  showToast('Loading PDF document...', 'info');
  // Store a clean copy of the raw bytes for pdf-lib export
  state.rawPdfBytes = new Uint8Array(arrayBuffer.slice(0));

  try {
    // Pass a fresh Uint8Array copy to PDF.js worker
    const pdfDataCopy = new Uint8Array(arrayBuffer.slice(0));
    state.pdfDoc = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise;
    state.totalPages = state.pdfDoc.numPages;
    state.pageNum = 1;
    state.pageItems = {};
    state.addedItems = {};
    state.editsCount = 0;
    updateEditsCounter();

    // Hide dropzone, show canvas page container
    elements.dropzone.style.display = 'none';
    elements.pageContainer.style.display = 'block';

    // Enable toolbar buttons
    elements.btnExport.disabled = false;
    elements.btnAddText.disabled = false;
    elements.btnTogglePreview.disabled = false;
    elements.btnZoomOut.disabled = false;
    elements.btnZoomIn.disabled = false;
    elements.btnZoomFit.disabled = false;

    updateNavigationUI();
    await renderCurrentPage();
    showToast(`PDF loaded successfully (${state.totalPages} page${state.totalPages > 1 ? 's' : ''})`, 'success');
  } catch (err) {
    console.error('Error parsing PDF:', err);
    showToast('Failed to parse PDF document.', 'error');
  }
}

// --- Sample PDF Generator (Instant 1-Click Demo) ---
async function loadSamplePDF() {
  showToast('Generating sample PDF invoice...', 'info');
  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 750]);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Title
    page.drawText('INVOICE', { x: 50, y: 680, size: 28, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
    page.drawText('#INV-2026-089', { x: 440, y: 685, size: 14, font: fontBold, color: rgb(0.4, 0.4, 0.5) });

    // Dates & Info
    page.drawText('Date: August 10, 2026', { x: 440, y: 660, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Due Date: August 24, 2026', { x: 440, y: 645, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

    // Billed To
    page.drawText('BILLED TO:', { x: 50, y: 610, size: 11, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
    page.drawText('Acme Corporation Inc.', { x: 50, y: 590, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('100 Innovation Way, Suite 400', { x: 50, y: 575, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('San Francisco, CA 94105', { x: 50, y: 560, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

    // Line items Header Bar
    page.drawRectangle({ x: 50, y: 500, width: 500, height: 25, color: rgb(0.92, 0.94, 0.98) });
    page.drawText('Item Description', { x: 60, y: 508, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.3) });
    page.drawText('Hours', { x: 340, y: 508, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.3) });
    page.drawText('Rate', { x: 420, y: 508, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.3) });
    page.drawText('Amount', { x: 490, y: 508, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.3) });

    // Item 1
    page.drawText('Client-Side Web Application Design', { x: 60, y: 470, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('24', { x: 350, y: 470, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$75.00', { x: 415, y: 470, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$1,800.00', { x: 485, y: 470, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    // Item 2
    page.drawText('PDF Text Extraction & Editing Engine Integration', { x: 60, y: 440, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('12', { x: 350, y: 440, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$85.00', { x: 415, y: 440, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$1,020.00', { x: 485, y: 440, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    // Separator line
    page.drawLine({ start: { x: 50, y: 410 }, end: { x: 550, y: 410 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });

    // Subtotal & Total
    page.drawText('Subtotal:', { x: 400, y: 380, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$2,820.00', { x: 485, y: 380, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText('Tax (0%):', { x: 400, y: 360, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('$0.00', { x: 485, y: 360, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText('TOTAL DUE:', { x: 380, y: 330, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
    page.drawText('$2,820.00', { x: 475, y: 330, size: 16, font: fontBold, color: rgb(0.38, 0.4, 0.95) });

    // Notes
    page.drawText('Payment Terms & Notes:', { x: 50, y: 250, size: 11, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
    page.drawText('Thank you for working with us! Please make payment within 14 days.', { x: 50, y: 230, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('This sample document is 100% editable using this PDF Text Editor.', { x: 50, y: 210, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

    const bytes = await pdfDoc.save();
    state.fileName = 'Sample_Invoice.pdf';
    loadPDFBytes(bytes.buffer);
  } catch (err) {
    console.error('Error generating sample PDF:', err);
    showToast('Failed to create sample PDF.', 'error');
  }
}

// --- Navigation & Zoom UI Controls ---
function updateNavigationUI() {
  elements.pageNumDisplay.textContent = `Page ${state.pageNum} of ${state.totalPages}`;
  elements.btnPrev.disabled = state.pageNum <= 1;
  elements.btnNext.disabled = state.pageNum >= state.totalPages;
  elements.zoomDisplay.textContent = `${Math.round(state.scale * 100)}%`;
}

function changePage(delta) {
  const newPage = state.pageNum + delta;
  if (newPage >= 1 && newPage <= state.totalPages) {
    state.pageNum = newPage;
    deselectActiveField();
    updateNavigationUI();
    renderCurrentPage();
  }
}

function setZoom(newScale) {
  if (newScale < 0.5 || newScale > 3.0) return;
  state.scale = Math.round(newScale * 10) / 10;
  updateNavigationUI();
  renderCurrentPage();
}

function fitZoomToViewport() {
  if (!state.pdfPageWidthPoints) return;
  const viewportWidth = elements.viewport.clientWidth - 80;
  state.scale = Math.round((viewportWidth / state.pdfPageWidthPoints) * 100) / 100;
  updateNavigationUI();
  renderCurrentPage();
}

// --- Core Rendering & Text Overlay Extraction ---
async function renderCurrentPage() {
  if (!state.pdfDoc || state.isRendering) return;
  state.isRendering = true;

  try {
    const page = await state.pdfDoc.getPage(state.pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    state.pdfPageWidthPoints = unscaledViewport.width;
    state.pdfPageHeightPoints = unscaledViewport.height;

    state.viewport = page.getViewport({ scale: state.scale });

    // High-DPI Canvas Scaling
    const outputScale = window.devicePixelRatio || 1;
    const canvas = elements.pdfCanvas;
    const context = canvas.getContext('2d');

    canvas.width = Math.floor(state.viewport.width * outputScale);
    canvas.height = Math.floor(state.viewport.height * outputScale);
    canvas.style.width = Math.floor(state.viewport.width) + 'px';
    canvas.style.height = Math.floor(state.viewport.height) + 'px';

    elements.pageContainer.style.width = Math.floor(state.viewport.width) + 'px';
    elements.pageContainer.style.height = Math.floor(state.viewport.height) + 'px';

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: context,
      transform: transform,
      viewport: state.viewport
    };

    await page.render(renderContext).promise;

    // Extract text elements if not already cached for this page
    if (!state.pageItems[state.pageNum]) {
      const textContent = await page.getTextContent();
      state.pageItems[state.pageNum] = processTextContent(textContent, unscaledViewport.height);
    }

    renderOverlayFields();
  } catch (err) {
    console.error('Render error:', err);
  } finally {
    state.isRendering = false;
  }
}

// Transform PDF text content items into structured editable objects
function processTextContent(textContent, pdfPageHeight) {
  const items = [];
  let idCounter = 0;

  textContent.items.forEach((item) => {
    const str = item.str;
    if (!str || str.trim().length === 0) return;

    // Transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const tx = item.transform;
    const pdfX = tx[4];
    const pdfY = tx[5];

    // Estimate font size from matrix or height
    const fontSize = Math.round(Math.hypot(tx[0], tx[1])) || Math.round(item.height) || 12;
    const pdfWidth = item.width || (str.length * fontSize * 0.55);
    const pdfHeight = item.height || fontSize;

    items.push({
      id: `p${state.pageNum}_item_${idCounter++}`,
      originalStr: str,
      editedStr: str,
      // Current coordinates (updated when moved/resized)
      pdfX: pdfX,
      pdfY: pdfY,
      pdfWidth: pdfWidth,
      pdfHeight: pdfHeight,
      // Original coordinates (never change — used for mask placement)
      origPdfX: pdfX,
      origPdfY: pdfY,
      origPdfWidth: pdfWidth,
      origPdfHeight: pdfHeight,
      fontSize: fontSize,
      fontName: item.fontName || 'Helvetica',
      fontFamily: item.fontName?.toLowerCase().includes('times') ? 'Times-Roman' : item.fontName?.toLowerCase().includes('courier') ? 'Courier' : 'Helvetica',
      textColor: '#000000',
      bgColor: '#ffffff',
      isEdited: false,
      isRedacted: false,
      isDeleted: false
    });
  });

  return items;
}

// Render overlay fields onto the overlay layer
function renderOverlayFields() {
  elements.textOverlay.innerHTML = '';
  const pageItems = state.pageItems[state.pageNum] || [];
  const addedItems = state.addedItems[state.pageNum] || [];

  const pdfHeight = state.pdfPageHeightPoints;

  // Render extracted PDF text items
  pageItems.forEach((item) => {
    // Coordinate transformation: PDF origin (bottom-left) -> Screen origin (top-left)
    const screenX = item.pdfX * state.scale;
    const screenY = (pdfHeight - item.pdfY - item.pdfHeight) * state.scale;
    const screenWidth = item.pdfWidth * state.scale;
    const screenHeight = (item.pdfHeight || item.fontSize) * state.scale;
    const screenFontSize = Math.max(9, item.fontSize * state.scale);

    const fieldEl = document.createElement('div');
    
    let classNames = ['editable-field'];
    if (item.isRedacted) classNames.push('redacted');
    else if (item.isDeleted) classNames.push('deleted');
    else if (item.isEdited) classNames.push('edited');

    fieldEl.className = classNames.join(' ');
    fieldEl.id = item.id;
    fieldEl.contentEditable = (item.isDeleted || item.isRedacted) ? 'false' : 'true';

    fieldEl.style.left = `${screenX}px`;
    fieldEl.style.top = `${screenY}px`;
    fieldEl.style.width = `${Math.max(20, screenWidth)}px`;
    fieldEl.style.height = `${Math.max(14, screenHeight)}px`;
    fieldEl.style.fontSize = `${screenFontSize}px`;
    fieldEl.style.fontFamily = getFontCSS(item.fontFamily);

    // Only set inline color/bg for modified items; unedited use CSS transparent
    if (item.isRedacted) {
      fieldEl.style.backgroundColor = '#000000';
    } else if (item.isDeleted) {
      fieldEl.style.backgroundColor = item.bgColor || '#ffffff';
    } else if (item.isEdited) {
      fieldEl.style.color = item.textColor;
      fieldEl.style.backgroundColor = item.bgColor || '#ffffff';
    }
    // Unedited: no inline color/bg — CSS sets color:transparent, bg:transparent

    fieldEl.textContent = item.isDeleted ? '' : item.editedStr;
    if (item.isDeleted) fieldEl.title = 'Deleted text (Click to restore)';

    // Attach field event listeners
    fieldEl.addEventListener('focus', () => selectActiveField(item, fieldEl));
    fieldEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectActiveField(item, fieldEl);
    });

    fieldEl.addEventListener('input', () => {
      item.editedStr = fieldEl.textContent;
      item.isEdited = (item.editedStr !== item.originalStr) || item.isRedacted || item.isDeleted;
      updateEditsCounter();
    });

    // Make draggable and resizable
    makeDraggable(fieldEl, item);
    addResizeHandles(fieldEl, item);

    elements.textOverlay.appendChild(fieldEl);
  });

  // Render user-added custom text items
  addedItems.forEach((item) => {
    const screenX = item.pdfX * state.scale;
    const screenY = (pdfHeight - item.pdfY - item.pdfHeight) * state.scale;
    const screenFontSize = Math.max(9, item.fontSize * state.scale);

    const fieldEl = document.createElement('div');
    fieldEl.className = `editable-field added-field ${item.isRedacted ? 'redacted' : item.isDeleted ? 'deleted' : 'edited'}`;
    fieldEl.id = item.id;
    fieldEl.contentEditable = (item.isDeleted || item.isRedacted) ? 'false' : 'true';

    fieldEl.style.left = `${screenX}px`;
    fieldEl.style.top = `${screenY}px`;
    fieldEl.style.fontSize = `${screenFontSize}px`;
    fieldEl.style.fontFamily = getFontCSS(item.fontFamily);
    fieldEl.style.color = item.textColor;
    fieldEl.style.backgroundColor = item.bgColor || '#ffffff';

    fieldEl.textContent = item.isDeleted ? '' : item.editedStr;

    fieldEl.addEventListener('focus', () => selectActiveField(item, fieldEl));
    fieldEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectActiveField(item, fieldEl);
    });

    fieldEl.addEventListener('input', () => {
      item.editedStr = fieldEl.textContent;
      item.isEdited = true;
      updateEditsCounter();
    });

    // Make draggable and resizable
    makeDraggable(fieldEl, item);
    addResizeHandles(fieldEl, item);

    elements.textOverlay.appendChild(fieldEl);
  });
}

// --- Drag-to-move handler for any field ---
// Uses a 5px movement threshold to differentiate click (→ focus) from drag (→ move)
function makeDraggable(fieldEl, item) {
  const DRAG_THRESHOLD = 5;

  fieldEl.addEventListener('mousedown', (e) => {
    // If already focused for editing, let normal text selection work
    if (document.activeElement === fieldEl) return;
    // Don't interfere with resize handles
    if (e.target.classList.contains('resize-handle')) return;
    if (e.button !== 0) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startElLeft = parseFloat(fieldEl.style.left) || 0;
    const startElTop = parseFloat(fieldEl.style.top) || 0;
    let hasDragged = false;

    // Don't preventDefault yet — wait to see if this is a drag or a click
    e.stopPropagation();

    const onMouseMove = (moveE) => {
      const dx = moveE.clientX - startMouseX;
      const dy = moveE.clientY - startMouseY;

      if (!hasDragged && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

      if (!hasDragged) {
        // First time past threshold — commit to dragging
        hasDragged = true;
        fieldEl.classList.add('dragging');
      }

      fieldEl.style.left = `${startElLeft + dx}px`;
      fieldEl.style.top = `${startElTop + dy}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (hasDragged) {
        // Was a drag — update coordinates
        fieldEl.classList.remove('dragging');

        const finalLeft = parseFloat(fieldEl.style.left) || 0;
        const finalTop = parseFloat(fieldEl.style.top) || 0;
        const pdfHeight = state.pdfPageHeightPoints;

        item.pdfX = finalLeft / state.scale;
        item.pdfY = pdfHeight - (finalTop / state.scale) - item.pdfHeight;
        item.isEdited = true;
        if (!fieldEl.classList.contains('edited')) fieldEl.classList.add('edited');
        fieldEl.style.color = item.textColor || '#000000';
        fieldEl.style.backgroundColor = item.bgColor || '#ffffff';
        updateEditsCounter();
      } else {
        // Was a click — focus the field for text editing
        fieldEl.focus();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// --- Resize handles for any field ---
function addResizeHandles(fieldEl, item) {
  const corners = ['nw', 'ne', 'sw', 'se'];

  corners.forEach(corner => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-${corner}`;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(fieldEl, item, corner, e);
    });
    fieldEl.appendChild(handle);
  });
}

function startResize(fieldEl, item, corner, e) {
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = parseFloat(fieldEl.style.left) || 0;
  const startTop = parseFloat(fieldEl.style.top) || 0;
  const startWidth = fieldEl.offsetWidth;
  const startHeight = fieldEl.offsetHeight;

  fieldEl.classList.add('resizing');

  const onMouseMove = (moveE) => {
    const dx = moveE.clientX - startX;
    const dy = moveE.clientY - startY;

    let newLeft = startLeft, newTop = startTop;
    let newWidth = startWidth, newHeight = startHeight;

    if (corner.includes('e')) {
      newWidth = Math.max(20, startWidth + dx);
    }
    if (corner.includes('w')) {
      newWidth = Math.max(20, startWidth - dx);
      newLeft = startLeft + (startWidth - newWidth);
    }
    if (corner.includes('s')) {
      newHeight = Math.max(14, startHeight + dy);
    }
    if (corner.includes('n')) {
      newHeight = Math.max(14, startHeight - dy);
      newTop = startTop + (startHeight - newHeight);
    }

    fieldEl.style.left = `${newLeft}px`;
    fieldEl.style.top = `${newTop}px`;
    fieldEl.style.width = `${newWidth}px`;
    fieldEl.style.height = `${newHeight}px`;
  };

  const onMouseUp = () => {
    fieldEl.classList.remove('resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Convert final screen dimensions back to PDF coordinates
    const finalLeft = parseFloat(fieldEl.style.left) || 0;
    const finalTop = parseFloat(fieldEl.style.top) || 0;
    const finalWidth = fieldEl.offsetWidth;
    const finalHeight = fieldEl.offsetHeight;
    const pdfHeight = state.pdfPageHeightPoints;

    item.pdfX = finalLeft / state.scale;
    item.pdfY = pdfHeight - (finalTop / state.scale) - (finalHeight / state.scale);
    item.pdfWidth = finalWidth / state.scale;
    item.pdfHeight = finalHeight / state.scale;
    item.isEdited = true;
    if (!fieldEl.classList.contains('edited')) fieldEl.classList.add('edited');
    fieldEl.style.color = item.textColor || '#000000';
    fieldEl.style.backgroundColor = item.bgColor || '#ffffff';
    updateEditsCounter();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function getFontCSS(family) {
  switch (family) {
    case 'Times-Roman': return '"Times New Roman", Times, serif';
    case 'Courier': return '"Courier New", Courier, monospace';
    case 'Helvetica':
    default: return 'Helvetica, Arial, sans-serif';
  }
}

// --- Active Field & Formatting Controls ---
function selectActiveField(item, domEl) {
  state.activeItem = item;

  // Highlight active DOM field
  document.querySelectorAll('.editable-field').forEach(el => el.classList.remove('active'));
  if (domEl) domEl.classList.add('active');

  // Populate floating toolbar inputs
  elements.fontSizeSelect.value = String(item.fontSize || 12);
  elements.fontFamilySelect.value = item.fontFamily || 'Helvetica';
  elements.textColorInput.value = item.textColor || '#000000';
  elements.bgColorInput.value = item.bgColor || '#ffffff';

  // Toggle Restore button visibility
  if (item.isDeleted || item.isRedacted || item.isEdited) {
    elements.btnRestoreField.style.display = 'inline-flex';
  } else {
    elements.btnRestoreField.style.display = 'none';
  }

  // Show floating toolbar
  elements.floatingToolbar.classList.add('visible');
}

function deselectActiveField() {
  state.activeItem = null;
  document.querySelectorAll('.editable-field').forEach(el => el.classList.remove('active'));
  elements.floatingToolbar.classList.remove('visible');
}

function updateActiveFieldStyle() {
  if (!state.activeItem) return;

  const item = state.activeItem;
  const parsedSize = parseFloat(elements.fontSizeSelect.value);
  if (!isNaN(parsedSize) && parsedSize > 0) {
    item.fontSize = parsedSize;
  }
  item.fontFamily = elements.fontFamilySelect.value;
  item.textColor = elements.textColorInput.value;
  item.bgColor = elements.bgColorInput.value;
  item.isEdited = true;

  updateEditsCounter();
  renderOverlayFields();
}

function toggleCleanPreview() {
  state.isPreviewMode = !state.isPreviewMode;
  if (state.isPreviewMode) {
    elements.textOverlay.classList.add('preview-mode');
    elements.btnTogglePreview.classList.add('btn-primary');
    elements.btnTogglePreview.classList.remove('btn-secondary');
    showToast('Clean Preview Mode ON', 'info');
  } else {
    elements.textOverlay.classList.remove('preview-mode');
    elements.btnTogglePreview.classList.add('btn-secondary');
    elements.btnTogglePreview.classList.remove('btn-primary');
    showToast('Clean Preview Mode OFF', 'info');
  }
}

function deleteActiveField() {
  if (!state.activeItem) return;
  const item = state.activeItem;

  if (item.isCustom) {
    const addedList = state.addedItems[state.pageNum] || [];
    state.addedItems[state.pageNum] = addedList.filter(i => i.id !== item.id);
  } else {
    item.editedStr = '';
    item.isDeleted = true;
    item.isRedacted = false;
    item.isEdited = true;
    item.bgColor = '#ffffff';
  }

  deselectActiveField();
  updateEditsCounter();
  renderOverlayFields();
  showToast('Element deleted (Masked white)', 'info');
}

function restoreActiveField() {
  if (!state.activeItem) return;
  const item = state.activeItem;
  item.editedStr = item.originalStr;
  item.isDeleted = false;
  item.isRedacted = false;
  item.isEdited = false;
  item.bgColor = '#ffffff';

  deselectActiveField();
  updateEditsCounter();
  renderOverlayFields();
  showToast('Original text restored', 'info');
}

function toggleRedactActiveField() {
  if (!state.activeItem) return;
  state.activeItem.isRedacted = !state.activeItem.isRedacted;
  state.activeItem.isDeleted = false;
  state.activeItem.isEdited = true;

  deselectActiveField();
  updateEditsCounter();
  renderOverlayFields();
  showToast(state.activeItem.isRedacted ? 'Text element redacted (Blacked out)' : 'Redaction removed', 'info');
}

// Add a new user custom text box
function addNewTextBox() {
  if (!state.pdfDoc) return;
  if (!state.addedItems[state.pageNum]) {
    state.addedItems[state.pageNum] = [];
  }

  const pdfWidth = state.pdfPageWidthPoints || 600;
  const pdfHeight = state.pdfPageHeightPoints || 750;

  const newItem = {
    id: `custom_p${state.pageNum}_${Date.now()}`,
    originalStr: 'New Text',
    editedStr: 'New Text',
    pdfX: pdfWidth / 2 - 50,
    pdfY: pdfHeight / 2,
    pdfWidth: 100,
    pdfHeight: 16,
    fontSize: 14,
    fontFamily: 'Helvetica',
    textColor: '#6366f1',
    bgColor: '#ffffff',
    isEdited: true,
    isCustom: true,
    isRedacted: false,
    isDeleted: false
  };

  state.addedItems[state.pageNum].push(newItem);
  updateEditsCounter();
  renderOverlayFields();

  setTimeout(() => {
    const domEl = document.getElementById(newItem.id);
    if (domEl) {
      domEl.focus();
      selectActiveField(newItem, domEl);
    }
  }, 50);
}

// Reset all edits
function resetAllEdits() {
  if (confirm('Are you sure you want to reset all edits in this document?')) {
    state.pageItems = {};
    state.addedItems = {};
    state.editsCount = 0;
    updateEditsCounter();
    deselectActiveField();
    renderCurrentPage();
    showToast('All edits have been reset.', 'info');
  }
}

function updateEditsCounter() {
  let count = 0;

  Object.values(state.pageItems).forEach(itemList => {
    itemList.forEach(item => {
      if (item.isEdited || item.isRedacted || item.isDeleted) count++;
    });
  });

  Object.values(state.addedItems).forEach(itemList => {
    count += itemList.length;
  });

  state.editsCount = count;
  elements.editsCounter.textContent = `${count} edit${count === 1 ? '' : 's'} made`;
  elements.btnClearEdits.disabled = count === 0;
}

// --- Export Engine (Using pdf-lib) ---
async function exportPDF() {
  if (!state.rawPdfBytes) {
    showToast('No PDF data available to export.', 'error');
    return;
  }

  elements.btnExport.disabled = true;
  elements.exportText.textContent = 'Exporting...';
  showToast('Preparing exported PDF...', 'info');

  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    
    // Load original PDF document bytes
    const pdfDoc = await PDFDocument.load(state.rawPdfBytes);

    // Embed Standard Fonts
    const fonts = {
      'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
      'Times-Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
      'Courier': await pdfDoc.embedFont(StandardFonts.Courier)
    };

    const pages = pdfDoc.getPages();

    // Iterate through pages and burn modifications
    for (let pIndex = 0; pIndex < pages.length; pIndex++) {
      const pageNum = pIndex + 1;
      const pdfPage = pages[pIndex];
      const pageItems = state.pageItems[pageNum] || [];
      const addedItems = state.addedItems[pageNum] || [];

      // Process extracted items
      for (const item of pageItems) {
        if (item.isEdited || item.isDeleted || item.isRedacted) {
          // 1. Draw mask rectangle over ORIGINAL text position (covers canvas text)
          const maskBgColor = item.isRedacted ? rgb(0, 0, 0) : parseRGBColor(item.bgColor || '#ffffff', rgb);
          const maskX = item.origPdfX ?? item.pdfX;
          const maskY = item.origPdfY ?? item.pdfY;
          const maskW = item.origPdfWidth ?? item.pdfWidth;
          const maskH = item.origPdfHeight ?? item.pdfHeight;
          pdfPage.drawRectangle({
            x: Math.max(0, maskX - 2),
            y: Math.max(0, maskY - 2),
            width: maskW + 4,
            height: maskH + 4,
            color: maskBgColor
          });

          // 2. If not redacted and not deleted, draw new replacement text at CURRENT position
          if (!item.isRedacted && !item.isDeleted && item.editedStr && item.editedStr.trim().length > 0) {
            const selectedFont = fonts[item.fontFamily] || fonts['Helvetica'];
            const textColor = parseRGBColor(item.textColor || '#000000', rgb);

            pdfPage.drawText(item.editedStr, {
              x: item.pdfX,
              y: item.pdfY,
              size: item.fontSize,
              font: selectedFont,
              color: textColor
            });
          }
        }
      }

      // Process added items
      for (const item of addedItems) {
        if (!item.isRedacted && !item.isDeleted && item.editedStr && item.editedStr.trim().length > 0) {
          const selectedFont = fonts[item.fontFamily] || fonts['Helvetica'];
          const textColor = parseRGBColor(item.textColor || '#000000', rgb);

          pdfPage.drawText(item.editedStr, {
            x: item.pdfX,
            y: item.pdfY,
            size: item.fontSize,
            font: selectedFont,
            color: textColor
          });
        }
      }
    }

    // Save and trigger file download
    const modifiedBytes = await pdfDoc.save();
    const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName.replace(/\.pdf$/i, '_edited.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('PDF exported and downloaded successfully!', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('Failed to export PDF file.', 'error');
  } finally {
    elements.btnExport.disabled = false;
    elements.exportText.textContent = 'Export PDF';
  }
}

// Helper to convert hex string to pdf-lib rgb object
function parseRGBColor(hex, rgb) {
  if (!hex || hex === 'transparent') return rgb(1, 1, 1);
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
