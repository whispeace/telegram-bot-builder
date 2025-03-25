import { CONSTANTS } from './CONSTANTS';

/**
 * Класс для управления мини-картой, обеспечивающей обзор диаграммы
 */
export class MinimapManager {
  /**
   * Создает экземпляр менеджера мини-карты
   * @param {DiagramModel} model - Модель данных диаграммы
   * @param {DiagramController} controller - Контроллер диаграммы
   */
  constructor(model, controller) {
    this.model = model;
    this.controller = controller;

    // DOM-элементы
    this.container = document.getElementById('minimap-container');
    this.content = document.getElementById('minimap-content');
    this.canvas = document.getElementById('minimap-canvas');
    this.viewport = document.getElementById('minimap-viewport');
    this.toggleButton = document.getElementById('minimap-toggle');
    this.closeButton = document.getElementById('minimap-close');

    // Состояние мини-карты
    this.isCollapsed = true;
    this.isDraggingViewport = false;
    this.scale = 0.1; // Масштаб мини-карты относительно основного холста
    this.contentRect = null;
    this.dragOffset = { x: 0, y: 0 };

    // Инициализация
    this.init();
  }

  /**
   * Инициализация мини-карты
   */
  init() {
    // Подписка на события модели
    this.model.subscribe('onNodeAdded', this.update.bind(this));
    this.model.subscribe('onNodeRemoved', this.update.bind(this));
    this.model.subscribe('onNodeUpdated', this.update.bind(this));
    this.model.subscribe('onSelectionChanged', this.updateSelection.bind(this));
    this.model.subscribe('onStateChanged', this.updateState.bind(this));

    // Обработчики событий UI
    this.toggleButton.addEventListener('click', this.toggle.bind(this));
    this.closeButton.addEventListener('click', this.collapse.bind(this));

    // Обработчики для перетаскивания области просмотра
    this.viewport.addEventListener('mousedown', this.startViewportDrag.bind(this));
    this.content.addEventListener('mousedown', this.handleContentClick.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.endViewportDrag.bind(this));

    // Начальное обновление
    this.update();
  }

  /**
   * Обновление мини-карты
   */
  update() {
    // Очищаем текущее содержимое
    while (this.canvas.firstChild) {
      this.canvas.removeChild(this.canvas.firstChild);
    }

    // Получаем размеры содержимого мини-карты
    this.contentRect = this.content.getBoundingClientRect();

    // Вычисляем границы диаграммы
    const bounds = this.calculateDiagramBounds();

    // Устанавливаем размеры холста мини-карты
    const canvasWidth = bounds.width * this.scale;
    const canvasHeight = bounds.height * this.scale;

    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;

    // Центрируем содержимое в видимой области
    this.centerContent(bounds, canvasWidth, canvasHeight);

    // Отрисовываем узлы
    this.renderNodes(bounds);

    // Обновляем отображение видимой области
    this.updateViewport();
  }

  /**
   * Вычисление границ диаграммы
   * @returns {Object} Границы диаграммы (x, y, width, height)
   */
  calculateDiagramBounds() {
    const padding = 100; // Дополнительный отступ
    const nodeWidth = CONSTANTS.NODE.DEFAULT_WIDTH;
    const nodeHeight = CONSTANTS.NODE.DEFAULT_HEIGHT;

    if (this.model.nodes.length === 0) {
      return { x: 0, y: 0, width: 1000, height: 1000 };
    }

    // Находим крайние точки для определения размеров диаграммы
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    this.model.nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    // Добавляем отступы
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Центрирование содержимого мини-карты
   * @param {Object} bounds - Границы диаграммы
   * @param {number} canvasWidth - Ширина холста мини-карты
   * @param {number} canvasHeight - Высота холста мини-карты
   */
  centerContent(bounds, canvasWidth, canvasHeight) {
    // Центрируем содержимое, если оно меньше размера мини-карты
    let offsetX = 0;
    let offsetY = 0;

    if (canvasWidth < this.contentRect.width) {
      offsetX = (this.contentRect.width - canvasWidth) / 2;
    }

    if (canvasHeight < this.contentRect.height) {
      offsetY = (this.contentRect.height - canvasHeight) / 2;
    }

    this.canvas.style.left = `${offsetX}px`;
    this.canvas.style.top = `${offsetY}px`;
  }

  /**
   * Отрисовка узлов на мини-карте
   * @param {Object} bounds - Границы диаграммы
   */
  renderNodes(bounds) {
    const nodeWidth = CONSTANTS.NODE.DEFAULT_WIDTH * this.scale;
    const nodeHeight = CONSTANTS.NODE.DEFAULT_HEIGHT * this.scale;

    // Отрисовываем каждый узел
    this.model.nodes.forEach(node => {
      const miniNode = document.createElement('div');
      miniNode.className = 'minimap-node';

      // Позиционирование узла
      const left = (node.position.x - bounds.x) * this.scale;
      const top = (node.position.y - bounds.y) * this.scale;

      miniNode.style.left = `${left}px`;
      miniNode.style.top = `${top}px`;
      miniNode.style.width = `${nodeWidth}px`;
      miniNode.style.height = `${nodeHeight}px`;

      // Устанавливаем цвет в зависимости от типа узла
      const nodeColor = CONSTANTS.NODE.COLORS[node.type];
      miniNode.style.borderColor = nodeColor;
      miniNode.style.backgroundColor = this.hexToRgba(nodeColor, 0.2);

      // Выделяем выбранный узел
      if (node.id === this.model.selectedNodeId) {
        miniNode.classList.add('selected');
      }

      // Добавляем узел на мини-карту
      this.canvas.appendChild(miniNode);
    });
  }

  /**
   * Обновление выделения на мини-карте
   */
  updateSelection() {
    // Обновляем выделение узлов
    const miniNodes = this.canvas.querySelectorAll('.minimap-node');

    miniNodes.forEach(node => {
      node.classList.remove('selected');
    });

    if (this.model.selectedNodeId) {
      const index = this.model.nodes.findIndex(node => node.id === this.model.selectedNodeId);
      if (index !== -1 && index < miniNodes.length) {
        miniNodes[index].classList.add('selected');
      }
    }
  }

  /**
   * Обновление состояния мини-карты при изменении модели
   * @param {Object} data - Данные события
   */
  updateState(data) {
    if (data.type === 'dataImported' || data.type === 'historyRestore') {
      this.update();
    }
  }

  /**
   * Обновление отображения видимой области (viewport)
   */
  updateViewport() {
    const bounds = this.calculateDiagramBounds();
    const canvasRect = this.canvas.getBoundingClientRect();
    const contentRect = this.content.getBoundingClientRect();

    // Вычисляем масштаб для преобразования координат
    const scaleX = canvasRect.width / bounds.width;
    const scaleY = canvasRect.height / bounds.height;

    // Получаем текущее положение и масштаб холста
    const position = this.controller.canvasState.position;
    const scale = this.controller.canvasState.scale;

    // Вычисляем размеры и положение области просмотра
    const viewportWidth = contentRect.width / scale * scaleX;
    const viewportHeight = contentRect.height / scale * scaleY;

    const viewportLeft = (position.x - bounds.x) * scaleX;
    const viewportTop = (position.y - bounds.y) * scaleY;

    // Обновляем стили viewport
    this.viewport.style.width = `${viewportWidth}px`;
    this.viewport.style.height = `${viewportHeight}px`;
    this.viewport.style.left = `${viewportLeft}px`;
    this.viewport.style.top = `${viewportTop}px`;
  }

  /**
   * Начало перетаскивания viewport
   * @param {MouseEvent} e - Событие мыши
   */
  startViewportDrag(e) {
    e.preventDefault();
    this.isDraggingViewport = true;

    // Запоминаем смещение для перетаскивания
    const rect = this.viewport.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Изменяем курсор
    document.body.style.cursor = 'grabbing';
  }

  /**
   * Обработка клика по области мини-карты
   * @param {MouseEvent} e - Событие мыши
   */
  handleContentClick(e) {
    // Если клик не по viewport, перемещаем viewport к месту клика
    if (e.target === this.content || e.target === this.canvas) {
      const bounds = this.calculateDiagramBounds();
      const canvasRect = this.canvas.getBoundingClientRect();
      const contentRect = this.content.getBoundingClientRect();

      // Вычисляем новое положение центра viewport
      const x = (e.clientX - canvasRect.left) / this.scale + bounds.x;
      const y = (e.clientY - canvasRect.top) / this.scale + bounds.y;

      // Обновляем положение холста
      this.controller.canvasState.position.x = x - contentRect.width / 2 / this.controller.canvasState.scale;
      this.controller.canvasState.position.y = y - contentRect.height / 2 / this.controller.canvasState.scale;

      // Обновляем трансформацию холста
      this.controller.updateCanvasTransform();

      // Обновляем viewport
      this.updateViewport();
    }
  }

  /**
   * Обработка перемещения мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseMove(e) {
    if (this.isDraggingViewport) {
      const bounds = this.calculateDiagramBounds();
      const canvasRect = this.canvas.getBoundingClientRect();
      const contentRect = this.content.getBoundingClientRect();

      // Вычисляем новое положение viewport
      const left = e.clientX - canvasRect.left - this.dragOffset.x;
      const top = e.clientY - canvasRect.top - this.dragOffset.y;

      // Обновляем положение холста
      this.controller.canvasState.position.x = left / this.scale + bounds.x;
      this.controller.canvasState.position.y = top / this.scale + bounds.y;

      // Обновляем трансформацию холста
      this.controller.updateCanvasTransform();

      // Обновляем viewport
      this.updateViewport();
    }
  }

  /**
   * Завершение перетаскивания viewport
   */
  endViewportDrag() {
    this.isDraggingViewport = false;
    document.body.style.cursor = 'default';
  }

  /**
   * Переключение видимости мини-карты
   */
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    this.toggleButton.setAttribute('aria-label', this.isCollapsed ? 'Показать мини-карту' : 'Скрыть мини-карту');
    this.toggleButton.setAttribute('data-tooltip', this.isCollapsed ? 'Показать мини-карту' : 'Скрыть мини-карту');

    // Если разворачиваем, обновляем состояние
    if (!this.isCollapsed) {
      this.update();
      this.toggleButton.classList.add('active');
    } else {
      this.toggleButton.classList.remove('active');
    }
  }

  /**
   * Свернуть мини-карту
   */
  collapse() {
    this.isCollapsed = true;
    this.container.classList.add('collapsed');
    this.toggleButton.setAttribute('aria-label', 'Показать мини-карту');
    this.toggleButton.setAttribute('data-tooltip', 'Показать мини-карту');
  }

  /**
   * Преобразование hex-цвета в rgba
   * @param {string} hex - Hex-код цвета
   * @param {number} alpha - Значение прозрачности
   * @returns {string} RGBA-представление цвета
   */
  hexToRgba(hex, alpha) {
    // Проверяем, является ли hex цветом
    if (!hex || typeof hex !== 'string') {
      return `rgba(128, 128, 128, ${alpha})`;
    }

    // Обрабатываем сокращенные hex-коды
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }

    // Преобразуем hex в rgb
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
