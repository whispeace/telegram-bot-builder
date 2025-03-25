import { CONSTANTS } from './CONSTANTS';

/**
 * Класс для управления расширенной панелью инструментов
 */
export class ToolbarManager {
  /**
   * Создает экземпляр менеджера панели инструментов
   * @param {DiagramModel} model - Модель данных диаграммы
   * @param {DiagramController} controller - Контроллер диаграммы
   * @param {DiagramView} view - Представление диаграммы
   */
  constructor(model, controller, view) {
    this.model = model;
    this.controller = controller;
    this.view = view;

    // Текущий инструмент
    this.activeTool = 'select';

    // Состояние отображения
    this.isGridVisible = true;
    this.isSnapEnabled = true;
    this.isGuidesEnabled = true;
    this.isDarkMode = true; // По умолчанию темная тема


    // Элементы интерфейса
    this.toolbar = document.getElementById('toolbar-container');
    this.contextToolbar = document.getElementById('context-toolbar');
    this.contextMenu = document.getElementById('node-contextmenu');
    this.mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');

    // Инициализация
    this.init();
  }

  /**
   * Инициализация менеджера панели инструментов
   */
  init() {
    // Инициализация кнопок инструментов
    this.initToolButtons();

    // Инициализация контекстного меню
    this.initContextMenu();

    // Инициализация мобильной кнопки боковой панели
    this.initMobileSidebar();

    // Подписка на события модели для обновления UI
    this.model.subscribe('onSelectionChanged', this.updateContextToolbar.bind(this));
    this.model.subscribe('onStateChanged', this.updateToolbarState.bind(this));

    // Обработка клавиатурных сокращений
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Закрытие контекстного меню при клике вне его
    document.addEventListener('click', this.hideContextMenu.bind(this));
  }

  /**
   * Инициализация кнопок панели инструментов
   */
  initToolButtons() {
    // Инструменты редактирования
    this.bindToolButton('tool-select', () => this.setActiveTool('select'));
    this.bindToolButton('tool-pan', () => this.setActiveTool('pan'));
    this.bindToolButton('tool-connect', () => this.setActiveTool('connect'));

    // Инструменты выравнивания
    this.bindToolButton('tool-align-left', () => this.alignNodes('left'));
    this.bindToolButton('tool-align-center-h', () => this.alignNodes('center-h'));
    this.bindToolButton('tool-align-right', () => this.alignNodes('right'));

    // Инструменты распределения
    this.bindToolButton('tool-distribute-h', () => this.distributeNodes('horizontal'));
    this.bindToolButton('tool-distribute-v', () => this.distributeNodes('vertical'));

    // Инструменты масштабирования
    this.bindToolButton('tool-zoom-in', () => this.controller.zoomIn());
    this.bindToolButton('tool-zoom-out', () => this.controller.zoomOut());
    this.bindToolButton('tool-zoom-fit', () => this.controller.resetZoom());

    // Инструменты отмены/повтора
    this.bindToolButton('tool-undo', () => this.controller.undo());
    this.bindToolButton('tool-redo', () => this.controller.redo());

    // Инструменты отображения
    this.bindToolButton('tool-toggle-grid', () => this.toggleGrid());
    this.bindToolButton('tool-toggle-snap', () => this.toggleSnap());
    this.bindToolButton('tool-toggle-guides', () => this.toggleGuides());
    this.bindToolButton('tool-toggle-dark-mode', () => this.toggleDarkMode());
    this.bindToolButton('tool-toggle-simulation', () => this.toggleSimulation());

    // Установка начального состояния
    this.updateToolButtonStates();
  }

  /**
   * Привязка обработчика к кнопке инструмента
   * @param {string} id - ID кнопки
   * @param {Function} handler - Обработчик клика
   */
  bindToolButton(id, handler) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        handler();
      });
    }
  }

  /**
   * Установка активного инструмента
   * @param {string} tool - Название инструмента
   */
  setActiveTool(tool) {
    // Сбрасываем активное состояние всех кнопок инструментов
    document.querySelectorAll('.toolbar-button').forEach(button => {
      button.classList.remove('active');
    });

    // Устанавливаем активное состояние для выбранного инструмента
    const buttonId = `tool-${tool}`;
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.add('active');
    }

    // Обновляем активный инструмент
    this.activeTool = tool;

    // Обновляем курсор в зависимости от инструмента
    const canvas = document.getElementById('canvas');
    switch (tool) {
      case 'select':
        canvas.style.cursor = 'default';
        break;
      case 'pan':
        canvas.style.cursor = 'grab';
        break;
      case 'connect':
        canvas.style.cursor = 'crosshair';
        break;
      default:
        canvas.style.cursor = 'default';
    }

    // Оповещаем контроллер о смене инструмента
    this.controller.setActiveTool(tool);
  }

  /**
   * Обновление состояния кнопок панели инструментов
   */
  updateToolButtonStates() {
    // Устанавливаем активное состояние для текущего инструмента
    const activeButton = document.getElementById(`tool-${this.activeTool}`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Обновляем состояние кнопок отображения
    this.updateToggleButtonState('tool-toggle-grid', this.isGridVisible);
    this.updateToggleButtonState('tool-toggle-snap', this.isSnapEnabled);
    this.updateToggleButtonState('tool-toggle-guides', this.isGuidesEnabled);
  }

  /**
   * Обновление состояния кнопки-переключателя
   * @param {string} id - ID кнопки
   * @param {boolean} state - Состояние (активно/неактивно)
   */
  updateToggleButtonState(id, state) {
    const button = document.getElementById(id);
    if (button) {
      if (state) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }

  /**
   * Переключение отображения сетки
   */
  toggleGrid() {
    this.isGridVisible = !this.isGridVisible;
    this.updateToggleButtonState('tool-toggle-grid', this.isGridVisible);

    // Обновляем отображение сетки
    const canvas = document.getElementById('canvas');
    if (this.isGridVisible) {
      canvas.style.backgroundImage = 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)';
    } else {
      canvas.style.backgroundImage = 'none';
    }
  }

  /**
   * Переключение привязки к сетке
   */
  toggleSnap() {
    this.isSnapEnabled = !this.isSnapEnabled;
    this.updateToggleButtonState('tool-toggle-snap', this.isSnapEnabled);

    // Обновляем контроллер
    if (this.controller.guidesState) {
      this.controller.guidesState.snapEnabled = this.isSnapEnabled;
    }
  }

  /**
   * Переключение отображения направляющих
   */
  toggleGuides() {
    this.isGuidesEnabled = !this.isGuidesEnabled;
    this.updateToggleButtonState('tool-toggle-guides', this.isGuidesEnabled);

    // Вызываем соответствующий метод контроллера
    if (typeof this.controller.toggleGuides === 'function') {
      this.controller.toggleGuides();
    }
  }

  /**
   * Переключение темной/светлой темы
   */
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;

    // Обновляем класс темы для документа
    if (this.isDarkMode) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }

  /**
   * Запуск режима симуляции потока
   */
  toggleSimulation() {
    // Здесь будет запуск симуляции потока
    // TODO: Реализовать в будущем
    // Временное уведомление
    this.controller.showNotification('Режим симуляции будет доступен в следующем обновлении', 'info');
  }

  /**
   * Выравнивание выделенных узлов
   * @param {string} alignment - Тип выравнивания ('left', 'center-h', 'right', 'top', 'center-v', 'bottom')
   */
  alignNodes(alignment) {
    const selectedNodes = this.model.getSelectedNodes();

    if (selectedNodes.length < 2) {
      this.controller.showNotification('Выделите несколько узлов для выравнивания', 'warning');
      return;
    }

    let referenceValue;
    switch (alignment) {
      case 'left':
        referenceValue = Math.min(...selectedNodes.map(node => node.position.x));
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: referenceValue, y: node.position.y }
          });
        });
        break;

      case 'center-h':
        const totalX = selectedNodes.reduce((sum, node) => sum + node.position.x + CONSTANTS.NODE.DEFAULT_WIDTH / 2, 0);
        referenceValue = totalX / selectedNodes.length - CONSTANTS.NODE.DEFAULT_WIDTH / 2;
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: referenceValue, y: node.position.y }
          });
        });
        break;

      case 'right':
        referenceValue = Math.max(...selectedNodes.map(node => node.position.x));
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: referenceValue, y: node.position.y }
          });
        });
        break;

      case 'top':
        referenceValue = Math.min(...selectedNodes.map(node => node.position.y));
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: node.position.x, y: referenceValue }
          });
        });
        break;

      case 'center-v':
        referenceValue = Math.max(...selectedNodes.map(node => node.position.y));
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: node.position.x, y: referenceValue }
          });
        });
        break;

      case 'bottom':
        referenceValue = Math.min(...selectedNodes.map(node => node.position.y));
        selectedNodes.forEach(node => {
          this.model.updateNode(node.id, {
            position: { x: node.position.x, y: referenceValue }
          });
        });
        break;
    }

    this.controller.showNotification(`Узлы выровнены (${selectedNodes.length})`, 'success');
  }

  /**
   * Распределение узлов равномерно
   * @param {string} direction - Направление ('horizontal', 'vertical')
   */
  distributeNodes(direction) {
    const selectedNodes = this.model.getSelectedNodes();

    if (selectedNodes.length < 3) {
      this.controller.showNotification('Выделите минимум три узла для распределения', 'warning');
      return;
    }

    if (direction === 'horizontal') {
      const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
      const firstNode = sortedNodes[0];
      const lastNode = sortedNodes[sortedNodes.length - 1];
      const totalWidth = (lastNode.position.x + CONSTANTS.NODE.DEFAULT_WIDTH) - firstNode.position.x;
      const interval = totalWidth / (sortedNodes.length - 1);

      for (let i = 1; i < sortedNodes.length - 1; i++) {
        const node = sortedNodes[i];
        const newX = firstNode.position.x + interval * i;
        this.model.updateNode(node.id, {
          position: { x: newX, y: node.position.y }
        });
      }
    } else if (direction === 'vertical') {
      const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
      const firstNode = sortedNodes[0];
      const lastNode = sortedNodes[sortedNodes.length - 1];
      const totalHeight = (lastNode.position.y + CONSTANTS.NODE.DEFAULT_HEIGHT) - firstNode.position.y;
      const interval = totalHeight / (sortedNodes.length - 1);

      for (let i = 1; i < sortedNodes.length - 1; i++) {
        const node = sortedNodes[i];
        const newY = firstNode.position.y + interval * i;
        this.model.updateNode(node.id, {
          position: { x: node.position.x, y: newY }
        });
      }
    }

    this.controller.showNotification(`Узлы распределены равномерно (${selectedNodes.length})`, 'success');
  }

  /**
   * Получение всех выделенных узлов
   * @returns {Array} Массив выделенных узлов
   */
  getSelectedNodes() {
    return this.model.getSelectedNodes();
  }

  /**
   * Инициализация контекстного меню
   */
  initContextMenu() {
    // Привязка действий контекстного меню
    this.bindContextMenuItem('contextmenu-copy', this.copySelectedNode.bind(this));
    this.bindContextMenuItem('contextmenu-duplicate', this.duplicateSelectedNode.bind(this));
    this.bindContextMenuItem('contextmenu-rename', this.renameSelectedNode.bind(this));
    this.bindContextMenuItem('contextmenu-delete', this.deleteSelectedNode.bind(this));

    // Обработчик правого клика для показа контекстного меню
    document.addEventListener('contextmenu', this.showContextMenu.bind(this));
  }

  /**
   * Привязка обработчика к элементу контекстного меню
   * @param {string} id - ID элемента
   * @param {Function} handler - Обработчик клика
   */
  bindContextMenuItem(id, handler) {
    const item = document.getElementById(id);
    if (item) {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
        this.hideContextMenu();
      });
    }
  }

  /**
   * Показ контекстного меню
   * @param {MouseEvent} e - Событие мыши
   */
  showContextMenu(e) {
    // Проверяем, был ли клик по узлу
    const nodeElement = e.target.closest('.node');
    if (nodeElement) {
      e.preventDefault();

      // Получаем ID узла
      const nodeId = nodeElement.id;

      // Выбираем узел
      this.model.setSelectedNode(nodeId);

      // Позиционируем контекстное меню
      this.contextMenu.style.display = 'block';
      this.contextMenu.style.left = `${e.clientX}px`;
      this.contextMenu.style.top = `${e.clientY}px`;

      // Проверяем, не выходит ли меню за границы экрана
      const rect = this.contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.contextMenu.style.left = `${e.clientX - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.contextMenu.style.top = `${e.clientY - rect.height}px`;
      }
    }
  }

  /**
   * Скрытие контекстного меню
   */
  hideContextMenu() {
    this.contextMenu.style.display = 'none';
  }

  /**
   * Копирование выделенного узла (действие из контекстного меню)
   */
  copySelectedNode() {
    // TODO: Реализовать копирование в буфер обмена
    this.controller.showNotification('Копирование в буфер обмена будет доступно в следующем обновлении', 'info');
  }

  /**
   * Дублирование выделенного узла (действие из контекстного меню)
   */
  duplicateSelectedNode() {
    if (this.model.selectedNodeId) {
      this.controller.duplicateNode(this.model.selectedNodeId);
    }
  }

  /**
   * Переименование выделенного узла (действие из контекстного меню)
   */
  renameSelectedNode() {
    // Запрашиваем новое имя через prompt (в реальном приложении лучше использовать модальное окно)
    const node = this.model.getNodeById(this.model.selectedNodeId);
    if (node) {
      const newTitle = prompt('Введите новое название для узла:', node.title);
      if (newTitle !== null && newTitle.trim() !== '') {
        this.model.updateNode(node.id, { title: newTitle.trim() });
      }
    }
  }

  /**
   * Удаление выделенного узла (действие из контекстного меню)
   */
  deleteSelectedNode() {
    if (this.model.selectedNodeId) {
      this.model.removeNode(this.model.selectedNodeId);
    }
  }

  /**
   * Обновление контекстной панели инструментов
   */
  updateContextToolbar() {
    // Очищаем контекстную панель
    this.contextToolbar.innerHTML = '';

    // Проверяем, есть ли выделенный узел
    if (this.model.selectedNodeId) {
      const node = this.model.getNodeById(this.model.selectedNodeId);
      if (node) {
        // Добавляем кнопки действий для узла
        this.addContextToolbarButton('Дублировать', 'duplicate', () => {
          this.controller.duplicateNode(node.id);
        });

        this.addContextToolbarButton('Удалить', 'delete', () => {
          this.model.removeNode(node.id);
        });

        // Позиционируем контекстную панель над узлом
        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          const canvasContainer = document.querySelector('.canvas-container');
          const containerRect = canvasContainer.getBoundingClientRect();

          this.contextToolbar.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
          this.contextToolbar.style.top = `${rect.top - containerRect.top - 50}px`;
          this.contextToolbar.classList.add('visible');
        }
      }
    } else {
      // Скрываем контекстную панель, если нет выделенного узла
      this.contextToolbar.classList.remove('visible');
    }
  }

  /**
   * Добавление кнопки в контекстную панель инструментов
   * @param {string} label - Текст кнопки
   * @param {string} icon - Название иконки
   * @param {Function} handler - Обработчик клика
   */
  addContextToolbarButton(label, icon, handler) {
    // Создаем кнопку
    const button = document.createElement('button');
    button.className = 'toolbar-button';
    button.setAttribute('data-tooltip', label);

    // Добавляем иконку в зависимости от типа
    let iconSvg = '';
    switch (icon) {
      case 'duplicate':
        iconSvg = '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path>';
        break;
      case 'delete':
        iconSvg = '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>';
        break;
      default:
        iconSvg = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>';
    }

    button.innerHTML = `<svg class="icon" viewBox="0 0 24 24">${iconSvg}</svg>`;

    // Добавляем обработчик
    button.addEventListener('click', handler);

    // Добавляем кнопку в панель
    this.contextToolbar.appendChild(button);
  }

  /**
   * Обновление состояния панели инструментов при изменении модели
   * @param {Object} data - Данные события
   */
  updateToolbarState(data) {
    // Обновляем состояние кнопок undo/redo
    const undoButton = document.getElementById('tool-undo');
    const redoButton = document.getElementById('tool-redo');

    if (undoButton) {
      undoButton.disabled = this.model.historyIndex <= 0;
    }

    if (redoButton) {
      redoButton.disabled = this.model.historyIndex >= this.model.history.length - 1;
    }
  }

  /**
   * Инициализация мобильной кнопки боковой панели
   */
  initMobileSidebar() {
    if (this.mobileSidebarToggle) {
      this.mobileSidebarToggle.addEventListener('click', this.toggleMobileSidebar.bind(this));
    }
  }

  /**
   * Переключение видимости боковой панели на мобильных устройствах
   */
  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-visible');
    }
  }

  /**
   * Обработка клавиатурных сокращений
   * @param {KeyboardEvent} e - Событие клавиатуры
   */
  handleKeyDown(e) {
    // Игнорируем сочетания клавиш, если активен элемент ввода
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Клавиатурные сокращения для инструментов
    switch (e.key.toLowerCase()) {
      case 'v':
        this.setActiveTool('select');
        break;
      case 'h':
        this.setActiveTool('pan');
        break;
      case 'c':
        this.setActiveTool('connect');
        break;
      case 'g':
        this.toggleGrid();
        break;
      case 's':
        if (!e.ctrlKey) { // Чтобы не мешать стандартному сохранению
          this.toggleSnap();
          e.preventDefault();
        }
        break;
    }
  }
}
