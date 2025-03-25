import { CONSTANTS } from './CONSTANTS';

/**
 * Класс для управления взаимодействием с пользователем
 */
export class DiagramController {
  constructor(model) {
    this.model = model;
    this.view = null; // Будет установлен позднее


    // Состояние холста
    this.canvasState = {
      position: { ...CONSTANTS.CANVAS.DEFAULT_POSITION },
      scale: CONSTANTS.CANVAS.DEFAULT_SCALE,
      isDragging: false,
      dragStartPos: { x: 0, y: 0 },
      dragStartClientPos: { x: 0, y: 0 }
    };

    // Состояние перетаскивания узла
    this.nodeDragState = {
      isDragging: false,
      nodeId: null,
      startPos: { x: 0, y: 0 },
      offset: { x: 0, y: 0 }
    };

    // Добавляем состояние для направляющих
    this.guidesState = {
      guides: [],
      snapThreshold: 10, // пикселей для срабатывания привязки
      snapEnabled: true,
      activeSnap: null
    };

    // Состояние множественного выделения
    this.multiSelectState = {
      isActive: false,
      startPos: { x: 0, y: 0 },
      endPos: { x: 0, y: 0 }
    };

    // Привязка обработчиков событий
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    // Обработчики для drag-and-drop
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);

    // Инициализация обработчиков событий
    this.init();
  }

  /**
   * Установка объекта представления
   * @param {DiagramView} view - Объект представления
   */
  setView(view) {
    this.view = view;

    // Обновляем представление при изменении состояния холста
    this.view.onCanvasTransformChange = this.updateCanvasTransform.bind(this);
  }

  /**
   * Инициализация контроллера
   */
  init() {
    // Инициализация обработчиков событий DOM
    this.initDOMEventListeners();

    // Инициализация обработчиков для интерфейса
    this.initUIEventListeners();
  }

  /**
   * Инициализация обработчиков событий DOM
   */
  initDOMEventListeners() {
    const canvas = document.getElementById('canvas');
    const canvasContainer = document.getElementById('canvas-container');

    // События мыши на холсте
    canvasContainer.addEventListener('mousedown', this.handleMouseDown);
    canvasContainer.addEventListener('mousemove', this.handleMouseMove);
    canvasContainer.addEventListener('mouseup', this.handleMouseUp);
    canvasContainer.addEventListener('wheel', this.handleWheel, { passive: false });

    // Глобальные обработчики для завершения перетаскивания вне холста
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Обработка клавиатурных сокращений
    document.addEventListener('keydown', this.handleKeyDown);

    // Отключение контекстного меню браузера
    canvasContainer.addEventListener('contextmenu', e => e.preventDefault());

    // Drag-and-drop из боковой панели
    const draggableItems = document.querySelectorAll('[draggable="true"]');
    draggableItems.forEach(item => {
      item.addEventListener('dragstart', this.handleDragStart);
    });

    canvasContainer.addEventListener('dragover', this.handleDragOver);
    canvasContainer.addEventListener('drop', this.handleDrop);
  }

  /**
   * Инициализация обработчиков для интерфейса
   */
  initUIEventListeners() {
    // Кнопка сохранения
    const saveButton = document.getElementById('btn-save');
    if (saveButton) {
      saveButton.addEventListener('click', this.saveProject.bind(this));
    }

    // Кнопка публикации
    const publishButton = document.getElementById('btn-publish');
    if (publishButton) {
      publishButton.addEventListener('click', this.showPublishModal.bind(this));
    }

    // Кнопки навигации
    const zoomInButton = document.querySelector('.navigation-controls [aria-label="Увеличить"]');
    const zoomOutButton = document.querySelector('.navigation-controls [aria-label="Уменьшить"]');
    const resetZoomButton = document.querySelector('.navigation-controls [aria-label="По размеру экрана"]');
    const undoButton = document.querySelector('.navigation-controls [aria-label="Отменить"]');
    const redoButton = document.querySelector('.navigation-controls [aria-label="Повторить"]');

    if (zoomInButton) zoomInButton.addEventListener('click', this.zoomIn.bind(this));
    if (zoomOutButton) zoomOutButton.addEventListener('click', this.zoomOut.bind(this));
    if (resetZoomButton) resetZoomButton.addEventListener('click', this.resetZoom.bind(this));
    if (undoButton) undoButton.addEventListener('click', this.undo.bind(this));
    if (redoButton) redoButton.addEventListener('click', this.redo.bind(this));

    // Кнопка свертывания боковой панели
    const sidebarCollapseButton = document.querySelector('.sidebar-collapse-btn');
    if (sidebarCollapseButton) {
      sidebarCollapseButton.addEventListener('click', this.toggleSidebar.bind(this));
    }

    // Кнопка закрытия панели свойств
    const closePropertiesButton = document.getElementById('close-properties');
    if (closePropertiesButton) {
      closePropertiesButton.addEventListener('click', this.hidePropertiesPanel.bind(this));
    }

    // Кнопки управления виртуализацией и направляющими
    const toggleVirtualizationBtn = document.getElementById('toggle-virtualization');
    const toggleGuidesBtn = document.getElementById('toggle-guides');

    if (toggleVirtualizationBtn) {
      toggleVirtualizationBtn.addEventListener('click', this.toggleVirtualization.bind(this));
    }

    if (toggleGuidesBtn) {
      toggleGuidesBtn.addEventListener('click', this.toggleGuides.bind(this));
    }

    // Кнопка сохранения состояния холста
    const saveCanvasButton = document.getElementById('btn-save-canvas');
    if (saveCanvasButton) {
      saveCanvasButton.addEventListener('click', this.saveCanvasState.bind(this));
    }

    // Кнопка загрузки состояния холста
    const loadCanvasButton = document.getElementById('btn-load-canvas');
    if (loadCanvasButton) {
      loadCanvasButton.addEventListener('click', this.loadCanvasState.bind(this));
    }
  }

  /**
   * Установка активного инструмента
   * @param {string} tool - Название инструмента
   */
  setActiveTool(tool) {
    this.activeTool = tool;

    // Обновляем поведение мыши в соответствии с активным инструментом
    if (tool === 'pan') {
      // Режим перемещения холста - левая кнопка мыши теперь панорамирует
      this.isPanMode = true;
    } else {
      this.isPanMode = false;
    }
  }

  /**
   * Модифицированный обработчик нажатия кнопки мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseDown(e) {
    const canvas = document.getElementById('canvas');

    // В режиме перемещения холста, обрабатываем левую кнопку мыши как перетаскивание
    if (this.activeTool === 'pan' && e.button === 0) {
      this.canvasState.isDragging = true;
      this.canvasState.dragStartClientPos = { x: e.clientX, y: e.clientY };
      canvas.classList.add('dragging');
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Стандартное поведение для других инструментов
    if (e.button === 2) {
      // Правая кнопка мыши - перетаскивание холста
      this.canvasState.isDragging = true;
      this.canvasState.dragStartClientPos = { x: e.clientX, y: e.clientY };
      canvas.classList.add('dragging');
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    } else if (e.target === canvas) {
      // Клик по пустой области холста - сброс выделения
      this.model.setSelectedNode(null);
      this.hidePropertiesPanel();
    } else {
      // Проверка на клик по узлу или элементам узла
      const nodeElement = e.target.closest('.node');
      if (nodeElement) {
        const nodeId = nodeElement.id;

        // Клик по заголовку - начало перетаскивания
        if (e.target.closest('.node-header')) {
          // Проверяем, что это не клик по кнопке
          const button = e.target.closest('button');
          if (button) return;

          this.startNodeDrag(e, nodeId);

          // Клик по порту - начало создания соединения
        } else if (e.target.classList.contains('node-port')) {
          // В режиме создания соединений, только порты разрешены
          if (this.activeTool === 'connect' || e.target.classList.contains('node-port-out')) {
            this.startConnectionCreation(e, nodeId);
          }

          // Клик по элементу узла - выделение элемента
        } else if (e.target.closest('.node-element')) {
          const elementElement = e.target.closest('.node-element');
          const elementId = elementElement.dataset.elementId;
          this.model.setSelectedElement(nodeId, elementId);
          this.showPropertiesPanel();

          // Клик по узлу - выделение узла
        } else {
          this.model.setSelectedNode(nodeId);
          this.showPropertiesPanel();
        }
      }
    }
  }

  /**
   * Начало перетаскивания узла
   * @param {MouseEvent} e - Событие мыши
   * @param {string} nodeId - ID узла
   */
  startNodeDrag(e, nodeId) {
    if (!this.model.selectedNodeIds.has(nodeId) && !e.shiftKey && !e.ctrlKey) {
      this.model.toggleNodeSelection(nodeId, true);
    }

    const node = this.model.getNodeById(nodeId);
    if (!node) return;

    const nodeElement = document.getElementById(nodeId);
    const rect = nodeElement.getBoundingClientRect();
    const canvas = document.getElementById('canvas');

    // Создаем элемент-призрак для более наглядного перетаскивания
    const ghostNode = nodeElement.cloneNode(true);
    ghostNode.id = `${nodeId}-ghost`;
    ghostNode.classList.add('node-ghost');
    ghostNode.style.position = 'absolute';
    ghostNode.style.left = `${node.position.x}px`;
    ghostNode.style.top = `${node.position.y}px`;
    ghostNode.style.zIndex = '1000';
    ghostNode.style.pointerEvents = 'none';
    ghostNode.style.opacity = '0.7';

    // Добавляем призрак на холст
    canvas.appendChild(ghostNode);

    // Сохраняем состояние перетаскивания
    this.nodeDragState = {
      isDragging: true,
      nodeId: nodeId,
      ghostId: `${nodeId}-ghost`,
      startPos: { ...node.position },
      offset: {
        x: (e.clientX - rect.left) / this.canvasState.scale,
        y: (e.clientY - rect.top) / this.canvasState.scale
      }
    };

    // Добавляем класс для визуальной индикации перетаскивания
    nodeElement.classList.add('dragging');
    document.body.style.cursor = 'grabbing';

    // Выделяем узел
    this.model.setSelectedNode(nodeId);
    this.showPropertiesPanel();
  }

  /**
   * Начало создания соединения
   * @param {MouseEvent} e - Событие мыши
   * @param {string} nodeId - ID узла
   */
  startConnectionCreation(e, nodeId) {
    const node = this.model.getNodeById(nodeId);
    if (!node) return;

    // Определяем порт (входной или выходной)
    const isOutputPort = e.target.classList.contains('node-port-out');
    const isInputPort = e.target.classList.contains('node-port-in');

    // Начинаем создание соединения только из выходного порта
    if (isOutputPort) {
      const nodeElement = document.getElementById(nodeId);
      const portRect = e.target.getBoundingClientRect();
      const canvasRect = document.getElementById('canvas').getBoundingClientRect();

      // Позиция порта в координатах холста
      const portPosition = {
        x: node.position.x + nodeElement.offsetWidth / 2,
        y: node.position.y + nodeElement.offsetHeight
      };

      // Начинаем создание соединения
      this.model.startConnection(nodeId, portPosition);

      // Добавляем класс для визуального выделения порта
      e.target.classList.add('active');
    }
  }

  /**
   * Обработчик перемещения мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseMove(e) {
    const canvas = document.getElementById('canvas');

    // Перетаскивание холста (правая кнопка мыши)
    if (this.canvasState.isDragging) {
      const dx = e.clientX - this.canvasState.dragStartClientPos.x;
      const dy = e.clientY - this.canvasState.dragStartClientPos.y;

      this.canvasState.position.x -= dx / this.canvasState.scale;
      this.canvasState.position.y -= dy / this.canvasState.scale;

      this.canvasState.dragStartClientPos = { x: e.clientX, y: e.clientY };

      this.updateCanvasTransform();
    }


    // Перетаскивание узла
    else if (this.nodeDragState.isDragging) {
      const canvasRect = canvas.getBoundingClientRect();

      // Вычисляем новую позицию узла с учетом масштаба и смещения холста
      let x = (e.clientX - canvasRect.left) / this.canvasState.scale - 
              this.nodeDragState.offset.x + this.canvasState.position.x;
      let y = (e.clientY - canvasRect.top) / this.canvasState.scale - 
              this.nodeDragState.offset.y + this.canvasState.position.y;

      // Привязка к сетке при зажатом Shift
      if (e.shiftKey) {
        const gridSize = 20;
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      } else if (this.guidesState.snapEnabled) {
        // Вычисляем и применяем направляющие
        const guides = this.calculateGuides(this.nodeDragState.nodeId, { x, y });

        // Применяем привязку, если есть направляющие
        guides.forEach(guide => {
          if (guide.snap) {
            if (guide.snap.axis === 'x') {
              x = guide.snap.value;
              this.guidesState.activeSnap = { axis: 'x', value: x };
            } else if (guide.snap.axis === 'y') {
              y = guide.snap.value;
              this.guidesState.activeSnap = { axis: 'y', value: y };
            }
          }
        });

        // Отображаем направляющие
        this.renderGuides(guides);
      }

      // Обновляем только позицию призрака во время перетаскивания
      const ghostNode = document.getElementById(this.nodeDragState.ghostId);
      if (ghostNode) {
        ghostNode.style.left = `${x}px`;
        ghostNode.style.top = `${y}px`;
      }
    }

    // Обновление временного соединения
    else if (this.model.pendingConnection) {
      const canvasRect = canvas.getBoundingClientRect();

      // Позиция курсора в координатах холста
      const x = (e.clientX - canvasRect.left) / this.canvasState.scale + this.canvasState.position.x;
      const y = (e.clientY - canvasRect.top) / this.canvasState.scale + this.canvasState.position.y;

      this.model.updatePendingConnection({ x, y });
    }

    if (this.multiSelectState.isActive) {
      const canvasRect = this.canvas.getBoundingClientRect();
      this.multiSelectState.endPos = {
        x: (e.clientX - canvasRect.left) / this.canvasState.scale + this.canvasState.position.x,
        y: (e.clientY - canvasRect.top) / this.canvasState.scale + this.canvasState.position.y
      };

      this.view.updateSelectionArea(
        this.multiSelectState.startPos,
        this.multiSelectState.endPos
      );
    }
  }

  /**
   * Обработчик отпускания кнопки мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseUp(e) {
    const canvas = document.getElementById('canvas');

    // Завершение перетаскивания холста
    if (this.canvasState.isDragging) {
      this.canvasState.isDragging = false;
      canvas.classList.remove('dragging');
      document.body.style.cursor = 'default';
    }


    // Завершение перетаскивания узла
    else if (this.nodeDragState.isDragging) {
      const nodeElement = document.getElementById(this.nodeDragState.nodeId);
      const ghostNode = document.getElementById(this.nodeDragState.ghostId);

      if (nodeElement && ghostNode) {
        // Получаем итоговую позицию из элемента-призрака
        const finalX = parseInt(ghostNode.style.left);
        const finalY = parseInt(ghostNode.style.top);

        // Удаляем призрак
        console.log(ghostNode);

        ghostNode.remove();

        // Обновляем реальную позицию узла с анимацией
        nodeElement.style.transition = 'transform 0.2s ease-out';
        this.updateNodePosition(this.nodeDragState.nodeId, { x: finalX, y: finalY });

        // Сбрасываем transition после анимации
        setTimeout(() => {
          if (nodeElement) {
            nodeElement.style.transition = '';
            nodeElement.classList.remove('dragging');
          }
        }, 200);
      }

      this.nodeDragState.isDragging = false;
      document.body.style.cursor = 'default';
    }


    // Завершение создания соединения
    else if (this.model.pendingConnection) {
      // Ищем узел под курсором
      const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
      if (elementUnderCursor) {
        const targetNodeElement = elementUnderCursor.closest('.node');
        if (targetNodeElement) {
          const targetNodeId = targetNodeElement.id;

          // Завершаем создание соединения
          this.model.completePendingConnection(targetNodeId);
        } else {
          // Отменяем создание соединения, если не попали по узлу
          this.model.cancelPendingConnection();
        }
      } else {
        this.model.cancelPendingConnection();
      }

      // Удаляем класс активности у всех портов
      document.querySelectorAll('.node-port.active').forEach(port => {
        port.classList.remove('active');
      });
    }

    // Удаляем все направляющие
    document.querySelectorAll('.alignment-guide').forEach(guide => guide.remove());
    this.guidesState.guides = [];
    this.guidesState.activeSnap = null;

    if (this.multiSelectState.isActive) {
      this.handleMultiSelectEnd();
    }
  }

  /**
   * Обработчик колесика мыши
   * @param {WheelEvent} e - Событие колесика
   */
  handleWheel(e) {
    e.preventDefault();

    if (e.ctrlKey) {
      // Масштабирование при зажатом Ctrl
      const delta = e.deltaY > 0 ? -CONSTANTS.CANVAS.SCALE_STEP : CONSTANTS.CANVAS.SCALE_STEP;
      this.zoom(delta, e.clientX, e.clientY);

    } else {
      // Панорамирование при прокрутке колесиком
      this.canvasState.position.x += e.deltaX / this.canvasState.scale;
      this.canvasState.position.y += e.deltaY / this.canvasState.scale;

      this.updateCanvasTransform();
    }
  }

  /**
   * Изменение масштаба
   * @param {number} delta - Изменение масштаба
   * @param {number} clientX - X-координата центра масштабирования
   * @param {number} clientY - Y-координата центра масштабирования
   */
  zoom(delta, clientX, clientY) {
    const newScale = Math.max(
      CONSTANTS.CANVAS.SCALE_MIN,
      Math.min(CONSTANTS.CANVAS.SCALE_MAX, this.canvasState.scale + delta)
    );

    // Не делаем ничего, если масштаб не изменился
    if (newScale === this.canvasState.scale) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    // Координаты точки, относительно которой происходит масштабирование
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Позиция мыши в координатах холста до масштабирования
    const mouseCanvasX = mouseX / this.canvasState.scale + this.canvasState.position.x;
    const mouseCanvasY = mouseY / this.canvasState.scale + this.canvasState.position.y;

    // Обновляем масштаб
    this.canvasState.scale = newScale;

    // Обновляем позицию холста, чтобы точка под курсором осталась на месте
    this.canvasState.position.x = mouseCanvasX - mouseX / newScale;
    this.canvasState.position.y = mouseCanvasY - mouseY / newScale;

    this.updateCanvasTransform();
  }

  /**
   * Увеличение масштаба
   */
  zoomIn() {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.zoom(CONSTANTS.CANVAS.SCALE_STEP, centerX, centerY);
  }

  /**
   * Уменьшение масштаба
   */
  zoomOut() {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.zoom(-CONSTANTS.CANVAS.SCALE_STEP, centerX, centerY);
  }

  /**
   * Сброс масштаба к значению по умолчанию
   */
  resetZoom() {
    this.canvasState.scale = CONSTANTS.CANVAS.DEFAULT_SCALE;
    this.canvasState.position = { ...CONSTANTS.CANVAS.DEFAULT_POSITION };

    this.updateCanvasTransform();
  }

  /**
   * Обновление трансформации холста
   */
  updateCanvasTransform() {
    const canvas = document.getElementById('canvas');
    const container = document.getElementById('canvas-container');

    // Устанавливаем css переменные для смещения фона
    container.style.setProperty('--bg-offset-x', `${-this.canvasState.position.x * this.canvasState.scale}px`);
    container.style.setProperty('--bg-offset-y', `${-this.canvasState.position.y * this.canvasState.scale}px`);

    canvas.style.transform = `translate(${-this.canvasState.position.x * this.canvasState.scale}px, ${-this.canvasState.position.y * this.canvasState.scale}px) scale(${this.canvasState.scale})`;

    // Обновляем представление
    if (this.view) {
      this.view.render();
    }
  }

  /**
   * Обновление позиции узла
   * @param {string} nodeId - ID узла
   * @param {Object} position - Новая позиция
   */
  updateNodePosition(nodeId, position) {
    this.model.updateNode(nodeId, { position });
  }

  /**
   * Обработчик начала перетаскивания из боковой панели
   * @param {DragEvent} e - Событие перетаскивания
   */
  handleDragStart(e) {
    const nodeType = e.target.dataset.nodeType;
    if (!nodeType) return;

    // Создаем "призрак" перетаскивания
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';

    // Заполняем призрак иконкой и текстом
    const iconContainer = e.target.querySelector('.sidebar-item-icon');
    const iconHTML = iconContainer ? iconContainer.innerHTML : '';
    const text = e.target.querySelector('.sidebar-item-label').textContent;

    ghost.innerHTML = `
      <div class="sidebar-item-icon ${nodeType}">${iconHTML}</div>
      <span>${text}</span>
    `;

    document.body.appendChild(ghost);

    // Запоминаем элемент призрака
    this.dragGhost = ghost;

    // Устанавливаем начальную позицию призрака
    ghost.style.position = 'fixed';
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.zIndex = '1000';

    // Добавляем класс dragging к перетаскиваемому элементу
    e.target.classList.add('dragging');

    // Устанавливаем данные для передачи
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setDragImage(document.createElement('div'), 0, 0);

    // Добавляем класс dropzone-active на холст
    document.getElementById('canvas').classList.add('dropzone-active');
  }

  /**
   * Обработчик перетаскивания над холстом
   * @param {DragEvent} e - Событие перетаскивания
   */
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Обновляем позицию призрака
    if (this.dragGhost) {
      this.dragGhost.style.left = `${e.clientX}px`;
      this.dragGhost.style.top = `${e.clientY}px`;
    }
  }

  /**
   * Обработчик сбрасывания на холст
   * @param {DragEvent} e - Событие перетаскивания
   */
  handleDrop(e) {
    e.preventDefault();

    // Удаляем призрак и классы
    if (this.dragGhost) {
      document.body.removeChild(this.dragGhost);
      this.dragGhost = null;
    }

    document.querySelectorAll('[draggable="true"].dragging').forEach(el => {
      el.classList.remove('dragging');
    });

    document.getElementById('canvas').classList.remove('dropzone-active');

    // Получаем тип узла
    const nodeType = e.dataTransfer.getData('nodeType');
    if (!nodeType) return;

    // Получаем координаты в системе холста
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.canvasState.scale + this.canvasState.position.x;
    const y = (e.clientY - rect.top) / this.canvasState.scale + this.canvasState.position.y;

    // Создаем новый узел
    const nodeId = this.model.addNode(nodeType, { x, y });

    // Выбираем созданный узел
    this.model.setSelectedNode(nodeId);
    this.showPropertiesPanel();
  }

  /**
   * Обработчик нажатий клавиш
   * @param {KeyboardEvent} e - Событие клавиатуры
   */
  handleKeyDown(e) {
    // Если активно поле ввода, не обрабатываем сочетания клавиш
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl+Z - отмена действия
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }

    // Ctrl+Shift+Z или Ctrl+Y - повтор действия
    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      this.redo();
    }

    // Ctrl+A - выделить все узлы
    if (e.ctrlKey && e.key === 'a') {
      console.log('Ctrl+A pressed');
      
      e.preventDefault();

      // Выделяем все узлы
      this.model.selectedNodeIds.clear();
      this.model.nodes.forEach(node => {
        this.model.selectedNodeIds.add(node.id);
      });

      // Устанавливаем последний узел как текущий для панели свойств
      if (this.model.nodes.length > 0) {
        this.model.selectedNodeId = this.model.nodes[this.model.nodes.length - 1].id;
      }

      // Публикуем событие изменения выделения
      this.model.publish('onSelectionChanged', {
        type: 'nodes',
        nodeIds: Array.from(this.model.selectedNodeIds),
        primaryNodeId: this.model.selectedNodeId
      });
    }

    // Escape - отмена лассо-выделения
    if (e.key === 'Escape') {
      if (this.multiSelectState.isActive) {
        this.multiSelectState.isActive = false;
        this.view.removeSelectionArea();
        return;
      }

      // Сброс выделения
      this.model.setSelectedNode(null);
      this.hidePropertiesPanel();
    }

    // Delete или Backspace - удаление всех выделенных узлов
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.model.selectedNodeIds.size > 0) {
        this.model.removeSelectedNodes();
        return;
      }

      if (this.model.selectedNodeId) {
        if (this.model.selectedElementId) {
          // Удаление элемента узла
          this.model.removeElement(this.model.selectedNodeId, this.model.selectedElementId);
        } else {
          // Удаление узла
          this.model.removeNode(this.model.selectedNodeId);
          this.hidePropertiesPanel();
        }
      } else if (this.model.selectedConnectionId) {
        // Удаление соединения
        this.model.removeConnection(this.model.selectedConnectionId);
      }
    }

    // Ctrl+D - дублирование выбранного узла
    if (e.ctrlKey && e.key === 'd' && this.model.selectedNodeId) {
      e.preventDefault();
      this.duplicateNode(this.model.selectedNodeId);
    }

    // Escape - отмена действия или сброс выделения
    if (e.key === 'Escape') {
      if (this.model.pendingConnection) {
        // Отмена создания соединения
        this.model.cancelPendingConnection();
        document.querySelectorAll('.node-port.active').forEach(port => {
          port.classList.remove('active');
        });
      } else {
        // Сброс выделения
        this.model.setSelectedNode(null);
        this.hidePropertiesPanel();
      }
    }
  }

  /**
   * Отмена последнего действия
   */
  undo() {
    this.model.undo();
  }

  /**
   * Повтор отмененного действия
   */
  redo() {
    this.model.redo();
  }

  /**
   * Дублирование узла
   * @param {string} nodeId - ID узла
   */
  duplicateNode(nodeId) {
    const newNodeId = this.model.duplicateNode(nodeId);
    if (newNodeId) {
      this.model.setSelectedNode(newNodeId);
      this.showPropertiesPanel();
    }
  }

  /**
   * Показать панель свойств
   */
  showPropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) {
      panel.classList.add('visible');
      this.view.updatePropertiesPanel();
    }
  }

  /**
   * Скрыть панель свойств
   */
  hidePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) {
      panel.classList.remove('visible');
    }
  }

  /**
   * Переключение сворачивания боковой панели
   */
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
    }
  }

  /**
   * Сохранение проекта
   */
  saveProject() {
    const data = this.model.exportData();
    const json = JSON.stringify(data, null, 2);

    try {
      localStorage.setItem('bot_builder_data', json);
      this.showNotification('Проект успешно сохранен', 'success');
    } catch (e) {
      console.error('Ошибка сохранения проекта', e);
      this.showNotification('Ошибка сохранения проекта', 'error');
    }
  }

  /**
   * Загрузка проекта
   */
  loadProject() {
    try {
      const savedData = localStorage.getItem('bot_builder_data');
      if (savedData) {
        const data = JSON.parse(savedData);
        this.model.importData(data);
        this.showNotification('Проект успешно загружен', 'success');
      }
    } catch (e) {
      console.error('Ошибка загрузки проекта', e);
      this.showNotification('Ошибка загрузки проекта', 'error');
    }
  }

  /**
   * Показать модальное окно публикации
   */
  showPublishModal() {
    const modal = document.getElementById('export-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * Показать уведомление
   * @param {string} message - Сообщение
   * @param {string} type - Тип уведомления (success, error, warning, info)
   */
  showNotification(message, type = 'info') {
    // Проверяем, существует ли контейнер для уведомлений
    let container = document.querySelector('.notifications-container');

    // Если контейнер не существует, создаем его
    if (!container) {
      container = document.createElement('div');
      container.className = 'notifications-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '1000';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }

    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.backgroundColor = 'var(--bg-secondary)';
    notification.style.color = 'var(--text-primary)';
    notification.style.padding = '12px 16px';
    notification.style.borderRadius = 'var(--radius-medium)';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.justifyContent = 'space-between';
    notification.style.minWidth = '250px';
    notification.style.maxWidth = '350px';
    notification.style.transition = 'all 0.3s ease';
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';

    // Добавляем цветовую полоску в зависимости от типа
    let color = '';
    switch (type) {
      case 'success':
        color = 'var(--accent-success)';
        break;
      case 'error':
        color = 'var(--accent-danger)';
        break;
      case 'warning':
        color = 'var(--accent-warning)';
        break;
      default:
        color = 'var(--accent-primary)';
    }

    notification.style.borderLeft = `4px solid ${color}`;

    // Заполняем содержимое уведомления
    notification.innerHTML = `
      <div>${message}</div>
      <button class="btn-icon notification-close" style="width: 20px; height: 20px; padding: 0;">
        <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
        </svg>
      </button>
    `;

    // Добавляем уведомление в контейнер
    container.appendChild(notification);

    // Анимация появления
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 10);

    // Добавляем обработчик для закрытия
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    });

    // Автоматическое закрытие через 5 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  /**
   * Расчет направляющих для текущей позиции узла
   * @param {string} nodeId - ID узла
   * @param {Object} position - Новая позиция
   */
  calculateGuides(nodeId, position) {
    const guides = [];
    const draggedNode = this.model.getNodeById(nodeId);
    if (!draggedNode) return guides;

    const nodeWidth = CONSTANTS.NODE.DEFAULT_WIDTH;
    const nodeHeight = CONSTANTS.NODE.DEFAULT_HEIGHT;

    // Ключевые точки перетаскиваемого узла
    const draggedLeft = position.x;
    const draggedRight = position.x + nodeWidth;
    const draggedTop = position.y;
    const draggedBottom = position.y + nodeHeight;
    const draggedCenterX = position.x + nodeWidth / 2;
    const draggedCenterY = position.y + nodeHeight / 2;

    // Проверяем все другие узлы
    this.model.nodes.forEach(node => {
      if (node.id === nodeId) return;

      const nodeLeft = node.position.x;
      const nodeRight = node.position.x + nodeWidth;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + nodeHeight;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;

      // Вертикальные направляющие
      if (Math.abs(draggedLeft - nodeLeft) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'vertical',
          position: nodeLeft,
          start: Math.min(draggedTop, nodeTop) - 20,
          end: Math.max(draggedBottom, nodeBottom) + 20,
          snap: { axis: 'x', value: nodeLeft }
        });
      }
      if (Math.abs(draggedCenterX - nodeCenterX) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'vertical',
          position: nodeCenterX,
          start: Math.min(draggedTop, nodeTop) - 20,
          end: Math.max(draggedBottom, nodeBottom) + 20,
          snap: { axis: 'x', value: nodeCenterX - nodeWidth / 2 }
        });
      }
      if (Math.abs(draggedRight - nodeRight) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'vertical',
          position: nodeRight,
          start: Math.min(draggedTop, nodeTop) - 20,
          end: Math.max(draggedBottom, nodeBottom) + 20,
          snap: { axis: 'x', value: nodeRight - nodeWidth }
        });
      }

      // Горизонтальные направляющие
      if (Math.abs(draggedTop - nodeTop) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'horizontal',
          position: nodeTop,
          start: Math.min(draggedLeft, nodeLeft) - 20,
          end: Math.max(draggedRight, nodeRight) + 20,
          snap: { axis: 'y', value: nodeTop }
        });
      }
      if (Math.abs(draggedCenterY - nodeCenterY) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'horizontal',
          position: nodeCenterY,
          start: Math.min(draggedLeft, nodeLeft) - 20,
          end: Math.max(draggedRight, nodeRight) + 20,
          snap: { axis: 'y', value: nodeCenterY - nodeHeight / 2 }
        });
      }
      if (Math.abs(draggedBottom - nodeBottom) <= this.guidesState.snapThreshold) {
        guides.push({
          type: 'horizontal',
          position: nodeBottom,
          start: Math.min(draggedLeft, nodeLeft) - 20,
          end: Math.max(draggedRight, nodeRight) + 20,
          snap: { axis: 'y', value: nodeBottom - nodeHeight }
        });
      }
    });

    return guides;
  }

  /**
   * Отрисовка направляющих
   * @param {Array} guides - Направляющие
   */
  renderGuides(guides) {
    // Сначала удаляем все существующие направляющие
    document.querySelectorAll('.alignment-guide').forEach(guide => guide.remove());

    // Рисуем новые направляющие
    guides.forEach(guide => {
      const guideElement = document.createElement('div');
      guideElement.className = `alignment-guide ${guide.type}`;

      if (guide.type === 'vertical') {
        guideElement.style.left = `${guide.position}px`;
        guideElement.style.top = `${guide.start}px`;
        guideElement.style.height = `${guide.end - guide.start}px`;
      } else {
        guideElement.style.top = `${guide.position}px`;
        guideElement.style.left = `${guide.start}px`;
        guideElement.style.width = `${guide.end - guide.start}px`;
      }

      const canvas = document.getElementById('canvas');
      canvas.appendChild(guideElement);
    });

    this.guidesState.guides = guides;
  }

  /**
   * Переключение виртуализации
   */
  toggleVirtualization() {
    this.view.virtualizationEnabled = !this.view.virtualizationEnabled;

    const button = document.getElementById('toggle-virtualization');
    if (button) {
      button.classList.toggle('active', this.view.virtualizationEnabled);
    }

    // При выключении виртуализации рисуем все элементы
    if (!this.view.virtualizationEnabled) {
      this.view.render();
    }

    this.showNotification(
      `Виртуализация ${this.view.virtualizationEnabled ? 'включена' : 'выключена'}`,
      'info'
    );
  }

  /**
   * Переключение направляющих
   */
  toggleGuides() {
    this.guidesState.snapEnabled = !this.guidesState.snapEnabled;

    const button = document.getElementById('toggle-guides');
    if (button) {
      button.classList.toggle('active', this.guidesState.snapEnabled);
    }

    this.showNotification(
      `Направляющие ${this.guidesState.snapEnabled ? 'включены' : 'выключены'}`,
      'info'
    );
  }

  /**
   * Сохранение состояния холста (позиция и масштаб) в localStorage
   */
  saveCanvasState() {
    const canvasState = {
      position: this.canvasState.position,
      scale: this.canvasState.scale
    };
    try {
      localStorage.setItem('canvas_state', JSON.stringify(canvasState));
      this.showNotification('Состояние холста сохранено', 'success');
    } catch (e) {
      console.error('Ошибка сохранения состояния холста', e);
      this.showNotification('Ошибка сохранения состояния холста', 'error');
    }
  }

  /**
   * Загрузка состояния холста (позиция и масштаб) из localStorage
   */
  loadCanvasState() {
    try {
      const savedState = localStorage.getItem('canvas_state');
      if (savedState) {
        const { position, scale } = JSON.parse(savedState);
        this.canvasState.position = position || CONSTANTS.CANVAS.DEFAULT_POSITION;
        this.canvasState.scale = scale || CONSTANTS.CANVAS.DEFAULT_SCALE;
        this.updateCanvasTransform();
        this.showNotification('Состояние холста загружено', 'success');
      }
    } catch (e) {
      console.error('Ошибка загрузки состояния холста', e);
      this.showNotification('Ошибка загрузки состояния холста', 'error');
    }
  }

  // Обработчик начала выделения области
  handleMultiSelectStart(e) {
    if ((e.shiftKey || e.ctrlKey) && e.button === 0 && e.target === this.canvas) {
      this.multiSelectState.isActive = true;

      const canvasRect = this.canvas.getBoundingClientRect();
      this.multiSelectState.startPos = {
        x: (e.clientX - canvasRect.left) / this.canvasState.scale + this.canvasState.position.x,
        y: (e.clientY - canvasRect.top) / this.canvasState.scale + this.canvasState.position.y
      };
      this.multiSelectState.endPos = { ...this.multiSelectState.startPos };

      this.view.createSelectionArea(
        this.multiSelectState.startPos,
        this.multiSelectState.endPos
      );

      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleMouseUp(e) {
    const canvas = document.getElementById('canvas');

    // Завершение перетаскивания холста
    if (this.canvasState.isDragging) {
      this.canvasState.isDragging = false;
      canvas.classList.remove('dragging');
      document.body.style.cursor = 'default';
    }


    // Завершение перетаскивания узла
    else if (this.nodeDragState.isDragging) {
      const nodeElement = document.getElementById(this.nodeDragState.nodeId);
      const ghostNode = document.getElementById(this.nodeDragState.ghostId);

      if (nodeElement && ghostNode) {
        // Получаем итоговую позицию из элемента-призрака
        const finalX = parseInt(ghostNode.style.left);
        const finalY = parseInt(ghostNode.style.top);

        // Удаляем призрак
        console.log(ghostNode);

        ghostNode.remove();

        // Обновляем реальную позицию узла с анимацией
        nodeElement.style.transition = 'transform 0.2s ease-out';
        this.updateNodePosition(this.nodeDragState.nodeId, { x: finalX, y: finalY });

        // Сбрасываем transition после анимации
        setTimeout(() => {
          if (nodeElement) {
            nodeElement.style.transition = '';
            nodeElement.classList.remove('dragging');
          }
        }, 200);
      }

      this.nodeDragState.isDragging = false;
      document.body.style.cursor = 'default';
    }


    // Завершение создания соединения
    else if (this.model.pendingConnection) {
      // Ищем узел под курсором
      const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
      if (elementUnderCursor) {
        const targetNodeElement = elementUnderCursor.closest('.node');
        if (targetNodeElement) {
          const targetNodeId = targetNodeElement.id;

          // Завершаем создание соединения
          this.model.completePendingConnection(targetNodeId);
        } else {
          // Отменяем создание соединения, если не попали по узлу
          this.model.cancelPendingConnection();
        }
      } else {
        this.model.cancelPendingConnection();
      }

      // Удаляем класс активности у всех портов
      document.querySelectorAll('.node-port.active').forEach(port => {
        port.classList.remove('active');
      });
    }

    // Удаляем все направляющие
    document.querySelectorAll('.alignment-guide').forEach(guide => guide.remove());
    this.guidesState.guides = [];
    this.guidesState.activeSnap = null;

    if (this.multiSelectState.isActive) {
      this.handleMultiSelectEnd();
    }
  }

  handleMultiSelectEnd() {
    if (this.multiSelectState.isActive) {
      const normalizedArea = this.normalizeSelectionArea(
        this.multiSelectState.startPos,
        this.multiSelectState.endPos
      );

      this.model.selectNodesInArea(normalizedArea, event.shiftKey);

      this.multiSelectState.isActive = false;
      this.view.removeSelectionArea();
    }
  }

  normalizeSelectionArea(startPos, endPos) {
    return {
      startPos: {
        x: Math.min(startPos.x, endPos.x),
        y: Math.min(startPos.y, endPos.y)
      },
      endPos: {
        x: Math.max(startPos.x, endPos.x),
        y: Math.max(startPos.y, endPos.y)
      }
    };
  }

  handleNodeClick(nodeId, e) {
    if (e.shiftKey || e.ctrlKey) {
      this.model.toggleNodeSelection(nodeId, false);
    } else {
      this.model.toggleNodeSelection(nodeId, true);
    }

    this.showPropertiesPanel();
  }

  handleNodeMove(deltaX, deltaY) {
    if (this.model.selectedNodeIds.size > 1) {
      this.model.moveSelectedNodes(deltaX, deltaY);
    } else {
      const nodeId = this.model.selectedNodeIds.values().next().value;
      const node = this.model.getNodeById(nodeId);
      if (node) {
        this.model.moveNode(nodeId, deltaX, deltaY);
      }
    }
  }
}
