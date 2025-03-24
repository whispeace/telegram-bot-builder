import './style.css';

/**
 * Константы приложения
 */
const CONSTANTS = {
  // Настройки холста
  CANVAS: {
    SCALE_MIN: 0.25,
    SCALE_MAX: 2,
    SCALE_STEP: 0.1,
    DEFAULT_POSITION: { x: 0, y: 0 },
    DEFAULT_SCALE: 1
  },
  
  // Типы и параметры узлов
  NODE: {
    TYPES: {
      START: 'start',
      MESSAGE: 'message',
      INPUT: 'input',
      LOGIC: 'logic',
      API: 'api',
      PAYMENT: 'payment',
      DATABASE: 'database'
    },
    TYPE_NAMES: {
      start: 'Начало',
      message: 'Сообщение',
      input: 'Ввод данных',
      logic: 'Условие',
      api: 'API запрос',
      payment: 'Платеж',
      database: 'База данных'
    },
    COLORS: {
      start: '#4a6bfc',
      message: '#36b37e',
      input: '#ffab00',
      logic: '#f5365c',
      api: '#4a6bfc',
      payment: '#36b37e',
      database: '#ffab00'
    },
    DEFAULT_WIDTH: 220,
    DEFAULT_HEIGHT: 100
  },
  
  // Типы и параметры элементов
  ELEMENT: {
    TYPES: {
      TEXT: 'text',
      IMAGE: 'image',
      AUDIO: 'audio',
      VIDEO: 'video',
      CHOICE: 'choice'
    },
    TYPE_NAMES: {
      text: 'Текст',
      image: 'Изображение',
      audio: 'Аудио',
      video: 'Видео',
      choice: 'Выбор варианта'
    }
  },
  
  // Параметры соединений
  CONNECTION: {
    LINE_COLOR: 'var(--accent-primary)',
    LINE_WIDTH: 2,
    PENDING_LINE_COLOR: 'rgba(74, 107, 252, 0.5)'
  }
};

/**
 * Модель данных приложения - реализует реактивную систему с публикацией событий
 */
class DiagramModel {
  constructor() {
    // Данные диаграммы
    this.nodes = [];
    this.connections = [];
    this.nextId = 1;
    
    // Состояние выделения
    this.selectedNodeId = null;
    this.selectedElementId = null;
    this.selectedConnectionId = null;
    
    // Временное соединение
    this.pendingConnection = null;
    
    // Система событий
    this.eventListeners = {
      onNodeAdded: [],
      onNodeRemoved: [],
      onNodeUpdated: [],
      onElementAdded: [],
      onElementRemoved: [],
      onElementUpdated: [],
      onConnectionAdded: [],
      onConnectionRemoved: [],
      onSelectionChanged: [],
      onStateChanged: []
    };
    
    // История изменений (для undo/redo)
    this.history = [];
    this.historyIndex = -1;
    this.isRecordingHistory = true;
  }
  
  /**
   * Подписка на события модели
   * @param {string} eventType - Тип события
   * @param {Function} callback - Функция обратного вызова
   */
  subscribe(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].push(callback);
    } else {
      console.warn(`Неизвестный тип события: ${eventType}`);
    }
  }
  
  /**
   * Публикация события
   * @param {string} eventType - Тип события
   * @param {*} data - Данные события
   */
  publish(eventType, data) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => callback(data));
    }
  }
  
  /**
   * Генерация уникального ID
   * @param {string} prefix - Префикс ID
   * @returns {string} - Уникальный ID
   */
  generateId(prefix) {
    return `${prefix}_${this.nextId++}`;
  }
  
  /**
   * Запись состояния в историю
   */
  recordHistory() {
    if (!this.isRecordingHistory) return;
    
    // Удаляем старые состояния в истории после текущего индекса
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Сохраняем текущее состояние
    const state = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      connections: JSON.parse(JSON.stringify(this.connections)),
      selectedNodeId: this.selectedNodeId,
      selectedElementId: this.selectedElementId,
      selectedConnectionId: this.selectedConnectionId
    };
    
    this.history.push(state);
    this.historyIndex = this.history.length - 1;
    
    // Ограничиваем размер истории
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }
  
  /**
   * Отмена последнего действия
   * @returns {boolean} - Успешность операции
   */
  undo() {
    if (this.historyIndex <= 0) return false;
    
    this.historyIndex--;
    this.restoreState(this.history[this.historyIndex]);
    return true;
  }
  
  /**
   * Повтор отмененного действия
   * @returns {boolean} - Успешность операции
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;
    
    this.historyIndex++;
    this.restoreState(this.history[this.historyIndex]);
    return true;
  }
  
  /**
   * Восстановление состояния из истории
   * @param {Object} state - Состояние модели
   */
  restoreState(state) {
    // Временно отключаем запись истории
    this.isRecordingHistory = false;
    
    // Восстанавливаем данные
    this.nodes = state.nodes;
    this.connections = state.connections;
    
    // Восстанавливаем выделение
    this.selectedNodeId = state.selectedNodeId;
    this.selectedElementId = state.selectedElementId;
    this.selectedConnectionId = state.selectedConnectionId;
    
    // Публикуем событие обновления состояния
    this.publish('onStateChanged', { type: 'historyRestore' });
    
    // Включаем запись истории
    this.isRecordingHistory = true;
  }
  
  /**
   * Добавление нового узла
   * @param {string} type - Тип узла
   * @param {Object} position - Позиция узла на холсте
   * @returns {string} - ID созданного узла
   */
  addNode(type, position) {
    const nodeId = this.generateId('node');
    const node = {
      id: nodeId,
      type: type,
      position: position,
      title: CONSTANTS.NODE.TYPE_NAMES[type] || 'Узел',
      elements: []
    };
    
    // Добавляем элемент текста по умолчанию для новых узлов
    const elementId = this.generateId('element');
    const defaultText = type === CONSTANTS.NODE.TYPES.START 
      ? 'Привет! Я бот-помощник. Как я могу вам помочь?'
      : 'Новый текстовый элемент';
      
    node.elements.push({
      id: elementId,
      type: CONSTANTS.ELEMENT.TYPES.TEXT,
      data: { text: defaultText }
    });
    
    this.nodes.push(node);
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onNodeAdded', { nodeId, node });
    
    return nodeId;
  }
  
  /**
   * Обновление узла
   * @param {string} nodeId - ID узла
   * @param {Object} data - Данные для обновления
   */
  updateNode(nodeId, data) {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    
    // Обновляем данные узла
    Object.assign(node, data);
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onNodeUpdated', { nodeId, node });
  }
  
  /**
   * Удаление узла
   * @param {string} nodeId - ID узла
   */
  removeNode(nodeId) {
    const nodeIndex = this.nodes.findIndex(node => node.id === nodeId);
    if (nodeIndex === -1) return;
    
    // Удаляем узел
    this.nodes.splice(nodeIndex, 1);
    
    // Удаляем все связанные с узлом соединения
    const relatedConnections = this.connections.filter(
      conn => conn.source === nodeId || conn.target === nodeId
    );
    
    relatedConnections.forEach(conn => {
      this.removeConnection(conn.id);
    });
    
    // Сбрасываем выделение, если был выделен этот узел
    if (this.selectedNodeId === nodeId) {
      this.setSelectedNode(null);
    }
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onNodeRemoved', { nodeId });
  }
  
  /**
   * Дублирование узла
   * @param {string} nodeId - ID узла
   * @returns {string} - ID нового узла
   */
  duplicateNode(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return null;
    
    // Создаем новый узел с данными исходного
    const newNodeId = this.generateId('node');
    const newNode = JSON.parse(JSON.stringify(node));
    
    // Изменяем ID и позицию
    newNode.id = newNodeId;
    newNode.position = {
      x: node.position.x + 20,
      y: node.position.y + 20
    };
    
    // Генерируем новые ID для элементов
    newNode.elements.forEach(element => {
      element.id = this.generateId('element');
    });
    
    this.nodes.push(newNode);
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onNodeAdded', { nodeId: newNodeId, node: newNode });
    
    return newNodeId;
  }
  
  /**
   * Добавление элемента в узел
   * @param {string} nodeId - ID узла
   * @param {string} type - Тип элемента
   * @returns {string} - ID созданного элемента
   */
  addElement(nodeId, type) {
    const node = this.getNodeById(nodeId);
    if (!node) return null;
    
    const elementId = this.generateId('element');
    const element = {
      id: elementId,
      type: type,
      data: {}
    };
    
    // Инициализация данных элемента по умолчанию
    switch (type) {
      case CONSTANTS.ELEMENT.TYPES.TEXT:
        element.data.text = 'Новый текстовый элемент';
        break;
      case CONSTANTS.ELEMENT.TYPES.IMAGE:
        element.data.url = '';
        element.data.caption = '';
        break;
      case CONSTANTS.ELEMENT.TYPES.AUDIO:
        element.data.url = '';
        element.data.caption = '';
        break;
      case CONSTANTS.ELEMENT.TYPES.VIDEO:
        element.data.url = '';
        element.data.caption = '';
        break;
      case CONSTANTS.ELEMENT.TYPES.CHOICE:
        element.data.question = 'Выберите вариант:';
        element.data.options = ['Вариант 1', 'Вариант 2'];
        break;
    }
    
    node.elements.push(element);
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onElementAdded', { nodeId, elementId, element });
    
    return elementId;
  }
  
  /**
   * Обновление элемента узла
   * @param {string} nodeId - ID узла
   * @param {string} elementId - ID элемента
   * @param {Object} data - Данные для обновления
   */
  updateElement(nodeId, elementId, data) {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    
    const element = node.elements.find(el => el.id === elementId);
    if (!element) return;
    
    // Обновляем данные элемента
    element.data = { ...element.data, ...data };
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onElementUpdated', { nodeId, elementId, element });
  }
  
  /**
   * Удаление элемента из узла
   * @param {string} nodeId - ID узла
   * @param {string} elementId - ID элемента
   */
  removeElement(nodeId, elementId) {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    
    const elementIndex = node.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) return;
    
    // Удаляем элемент
    node.elements.splice(elementIndex, 1);
    
    // Сбрасываем выделение, если был выделен этот элемент
    if (this.selectedNodeId === nodeId && this.selectedElementId === elementId) {
      this.setSelectedElement(nodeId, null);
    }
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onElementRemoved', { nodeId, elementId });
  }
  
  /**
   * Добавление соединения между узлами
   * @param {string} sourceId - ID исходного узла
   * @param {string} targetId - ID целевого узла
   * @returns {string} - ID созданного соединения
   */
  addConnection(sourceId, targetId) {
    // Проверка на существование узлов
    const sourceNode = this.getNodeById(sourceId);
    const targetNode = this.getNodeById(targetId);
    
    if (!sourceNode || !targetNode) {
      return null;
    }
    
    // Проверка на дубликаты
    const existingConnection = this.connections.find(
      conn => conn.source === sourceId && conn.target === targetId
    );
    
    if (existingConnection) {
      return existingConnection.id;
    }
    
    // Создаем новое соединение
    const connectionId = this.generateId('conn');
    const connection = {
      id: connectionId,
      source: sourceId,
      target: targetId
    };
    
    this.connections.push(connection);
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onConnectionAdded', { connectionId, connection });
    
    return connectionId;
  }
  
  /**
   * Удаление соединения
   * @param {string} connectionId - ID соединения
   */
  removeConnection(connectionId) {
    const connectionIndex = this.connections.findIndex(conn => conn.id === connectionId);
    if (connectionIndex === -1) return;
    
    // Удаляем соединение
    this.connections.splice(connectionIndex, 1);
    
    // Сбрасываем выделение, если было выделено это соединение
    if (this.selectedConnectionId === connectionId) {
      this.setSelectedConnection(null);
    }
    
    // Записываем в историю и публикуем событие
    this.recordHistory();
    this.publish('onConnectionRemoved', { connectionId });
  }
  
  /**
   * Получение узла по ID
   * @param {string} nodeId - ID узла
   * @returns {Object|null} - Узел или null
   */
  getNodeById(nodeId) {
    return this.nodes.find(node => node.id === nodeId) || null;
  }
  
  /**
   * Получение соединения по ID
   * @param {string} connectionId - ID соединения
   * @returns {Object|null} - Соединение или null
   */
  getConnectionById(connectionId) {
    return this.connections.find(conn => conn.id === connectionId) || null;
  }
  
  /**
   * Получение соединений, связанных с узлом
   * @param {string} nodeId - ID узла
   * @returns {Array} - Массив соединений
   */
  getConnectionsByNodeId(nodeId) {
    return this.connections.filter(
      conn => conn.source === nodeId || conn.target === nodeId
    );
  }
  
  /**
   * Установка выделенного узла
   * @param {string|null} nodeId - ID узла или null
   */
  setSelectedNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.selectedElementId = null;
    this.selectedConnectionId = null;
    
    // Публикуем событие изменения выделения
    this.publish('onSelectionChanged', { 
      type: 'node', 
      nodeId: this.selectedNodeId 
    });
  }
  
  /**
   * Установка выделенного элемента
   * @param {string} nodeId - ID узла
   * @param {string|null} elementId - ID элемента или null
   */
  setSelectedElement(nodeId, elementId) {
    this.selectedNodeId = nodeId;
    this.selectedElementId = elementId;
    this.selectedConnectionId = null;
    
    // Публикуем событие изменения выделения
    this.publish('onSelectionChanged', { 
      type: 'element', 
      nodeId: this.selectedNodeId, 
      elementId: this.selectedElementId 
    });
  }
  
  /**
   * Установка выделенного соединения
   * @param {string|null} connectionId - ID соединения или null
   */
  setSelectedConnection(connectionId) {
    this.selectedNodeId = null;
    this.selectedElementId = null;
    this.selectedConnectionId = connectionId;
    
    // Публикуем событие изменения выделения
    this.publish('onSelectionChanged', { 
      type: 'connection', 
      connectionId: this.selectedConnectionId 
    });
  }
  
  /**
   * Начало создания соединения
   * @param {string} nodeId - ID исходного узла
   * @param {Object} position - Позиция начала соединения
   */
  startConnection(nodeId, position) {
    this.pendingConnection = {
      sourceId: nodeId,
      sourcePosition: position
    };
  }
  
  /**
   * Обновление позиции временного соединения
   * @param {Object} position - Текущая позиция указателя
   */
  updatePendingConnection(position) {
    if (!this.pendingConnection) return;
    
    this.pendingConnection.targetPosition = position;
    this.publish('onStateChanged', { type: 'pendingConnectionUpdated' });
  }
  
  /**
   * Завершение создания соединения
   * @param {string} targetId - ID целевого узла
   * @returns {string|null} - ID созданного соединения или null
   */
  completePendingConnection(targetId) {
    if (!this.pendingConnection || this.pendingConnection.sourceId === targetId) {
      this.pendingConnection = null;
      return null;
    }
    
    const connectionId = this.addConnection(this.pendingConnection.sourceId, targetId);
    this.pendingConnection = null;
    
    return connectionId;
  }
  
  /**
   * Отмена создания соединения
   */
  cancelPendingConnection() {
    this.pendingConnection = null;
    this.publish('onStateChanged', { type: 'pendingConnectionCancelled' });
  }
  
  /**
   * Экспорт данных диаграммы
   * @returns {Object} - Данные диаграммы
   */
  exportData() {
    return {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      connections: JSON.parse(JSON.stringify(this.connections))
    };
  }
  
  /**
   * Импорт данных диаграммы
   * @param {Object} data - Импортируемые данные
   */
  importData(data) {
    if (!data) return;
    
    // Очищаем текущие данные
    this.nodes = [];
    this.connections = [];
    this.selectedNodeId = null;
    this.selectedElementId = null;
    this.selectedConnectionId = null;
    
    // Импортируем узлы и соединения
    if (data.nodes) this.nodes = data.nodes;
    if (data.connections) this.connections = data.connections;
    
    // Обновляем nextId, чтобы избежать конфликтов
    let maxId = 0;
    
    this.nodes.forEach(node => {
      const idNum = parseInt(node.id.split('_')[1]);
      if (idNum > maxId) maxId = idNum;
      
      node.elements.forEach(element => {
        const elIdNum = parseInt(element.id.split('_')[1]);
        if (elIdNum > maxId) maxId = elIdNum;
      });
    });
    
    this.connections.forEach(conn => {
      const connIdNum = parseInt(conn.id.split('_')[1]);
      if (connIdNum > maxId) maxId = connIdNum;
    });
    
    this.nextId = maxId + 1;
    
    // Очищаем историю и создаем новое начальное состояние
    this.history = [];
    this.historyIndex = -1;
    this.recordHistory();
    
    // Публикуем событие импорта данных
    this.publish('onStateChanged', { type: 'dataImported' });
  }
}

/**
 * Класс для управления взаимодействием с пользователем
 */
class DiagramController {
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
    
    // Обработчики событий мыши с привязкой контекста
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
    
    // События мыши на холсте
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    
    // Глобальные обработчики для завершения перетаскивания вне холста
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    
    // Обработка клавиатурных сокращений
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Отключение контекстного меню браузера
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    // Drag-and-drop из боковой панели
    const draggableItems = document.querySelectorAll('[draggable="true"]');
    draggableItems.forEach(item => {
      item.addEventListener('dragstart', this.handleDragStart);
    });
    
    canvas.addEventListener('dragover', this.handleDragOver);
    canvas.addEventListener('drop', this.handleDrop);
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
  }
  
  /**
   * Обработчик нажатия кнопки мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseDown(e) {
    const canvas = document.getElementById('canvas');
    
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
          this.startNodeDrag(e, nodeId);
          
        // Клик по порту - начало создания соединения
        } else if (e.target.classList.contains('node-port')) {
          this.startConnectionCreation(e, nodeId);
          
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
    const node = this.model.getNodeById(nodeId);
    if (!node) return;
    
    const nodeElement = document.getElementById(nodeId);
    const rect = nodeElement.getBoundingClientRect();
    
    // Вычисляем смещение курсора от левого верхнего угла узла
    this.nodeDragState = {
      isDragging: true,
      nodeId: nodeId,
      startPos: { ...node.position },
      offset: {
        x: (e.clientX - rect.left) / this.canvasState.scale,
        y: (e.clientY - rect.top) / this.canvasState.scale
      }
    };
    
    // Добавляем класс для визуального эффекта перетаскивания
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
      
      this.canvasState.position.x += dx / this.canvasState.scale;
      this.canvasState.position.y += dy / this.canvasState.scale;
      
      this.canvasState.dragStartClientPos = { x: e.clientX, y: e.clientY };
      
      this.updateCanvasTransform();
    }
    
    // Перетаскивание узла
    else if (this.nodeDragState.isDragging) {
      const canvasRect = canvas.getBoundingClientRect();
      
      // Вычисляем новую позицию узла с учетом масштаба и смещения холста
      const x = (e.clientX - canvasRect.left) / this.canvasState.scale - 
                this.nodeDragState.offset.x + this.canvasState.position.x;
      const y = (e.clientY - canvasRect.top) / this.canvasState.scale - 
                this.nodeDragState.offset.y + this.canvasState.position.y;
      
      // Привязка к сетке при зажатом Shift
      if (e.shiftKey) {
        const gridSize = 20;
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedY = Math.round(y / gridSize) * gridSize;
        
        this.updateNodePosition(this.nodeDragState.nodeId, { x: snappedX, y: snappedY });
      } else {
        this.updateNodePosition(this.nodeDragState.nodeId, { x, y });
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
      if (nodeElement) {
        nodeElement.classList.remove('dragging');
        
        // Анимация "приземления" узла
        nodeElement.style.transition = 'transform 0.15s ease-out';
        nodeElement.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
          nodeElement.style.transform = 'scale(1)';
          setTimeout(() => {
            nodeElement.style.transition = '';
          }, 150);
        }, 10);
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
      this.canvasState.position.x -= e.deltaX / this.canvasState.scale;
      this.canvasState.position.y -= e.deltaY / this.canvasState.scale;
      
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
    canvas.style.transform = `translate(${-this.canvasState.position.x * this.canvasState.scale}px, ${-this.canvasState.position.y * this.canvasState.scale}px) scale(${this.canvasState.scale})`;

    // Обновляем рендеринг после изменения трансформации
    this.view.render();
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
    
    // Delete - удаление выбранного элемента
    if (e.key === 'Delete') {
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
}

/**
 * Класс системы подсказок
 */
class TooltipManager {
  constructor() {
    this.tooltipElement = null;
    this.activeTooltipTarget = null;
    this.tooltipDelay = 600; // мс
    this.tooltipTimer = null;
    
    this.init();
  }
  
  /**
   * Инициализация менеджера подсказок
   */
  init() {
    // Создаем элемент подсказки
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tooltip';
    this.tooltipElement.style.display = 'none';
    document.body.appendChild(this.tooltipElement);
    
    // Привязываем обработчики событий к документу
    document.addEventListener('mouseover', this.handleMouseOver.bind(this));
    document.addEventListener('mouseout', this.handleMouseOut.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
  }
  
  /**
   * Обработчик наведения мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseOver(e) {
    // Находим ближайший элемент с data-tooltip
    const target = e.target.closest('[data-tooltip]');
    if (!target || this.activeTooltipTarget === target) return;
    
    this.activeTooltipTarget = target;
    
    // Устанавливаем таймер для отображения подсказки
    clearTimeout(this.tooltipTimer);
    this.tooltipTimer = setTimeout(() => {
      const tooltipText = target.dataset.tooltip;
      this.showTooltip(tooltipText, e);
    }, this.tooltipDelay);
  }
  
  /**
   * Обработчик ухода мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseOut(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    
    // Если мышь ушла с элемента с подсказкой
    clearTimeout(this.tooltipTimer);
    this.hideTooltip();
    this.activeTooltipTarget = null;
  }
  
  /**
   * Обработчик перемещения мыши
   * @param {MouseEvent} e - Событие мыши
   */
  handleMouseMove(e) {
    if (this.activeTooltipTarget && this.tooltipElement.style.display !== 'none') {
      // Обновляем позицию подсказки
      this.positionTooltip(e);
    }
  }
  
  /**
   * Показать подсказку
   * @param {string} text - Текст подсказки
   * @param {MouseEvent} e - Событие мыши
   */
  showTooltip(text, e) {
    // Заполняем содержимое подсказки
    this.tooltipElement.textContent = text;
    this.tooltipElement.style.display = 'block';
    
    // Позиционируем подсказку
    this.positionTooltip(e);
    
    // Анимируем появление
    this.tooltipElement.style.opacity = '0';
    this.tooltipElement.style.transform = 'translateY(5px)';
    
    requestAnimationFrame(() => {
      this.tooltipElement.style.transition = 'opacity 0.2s, transform 0.2s';
      this.tooltipElement.style.opacity = '1';
      this.tooltipElement.style.transform = 'translateY(0)';
    });
  }
  
  /**
   * Позиционирование подсказки
   * @param {MouseEvent} e - Событие мыши
   */
  positionTooltip(e) {
    const gap = 8; // отступ от курсора
    
    // Размеры подсказки
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    // Позиционируем подсказку относительно курсора
    let left = e.clientX + gap;
    let top = e.clientY + gap;
    
    // Проверяем, не выходит ли подсказка за границы экрана
    if (left + tooltipRect.width > window.innerWidth) {
      left = e.clientX - tooltipRect.width - gap;
    }
    
    if (top + tooltipRect.height > window.innerHeight) {
      top = e.clientY - tooltipRect.height - gap;
    }
    
    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
  }
  
  /**
   * Скрыть подсказку
   */
  hideTooltip() {
    this.tooltipElement.style.opacity = '0';
    this.tooltipElement.style.transform = 'translateY(5px)';
    
    // Скрываем подсказку после завершения анимации
    setTimeout(() => {
      if (this.activeTooltipTarget === null) {
        this.tooltipElement.style.display = 'none';
      }
    }, 200);
  }
}

/**
 * Класс визуализации - отвечает за отображение диаграммы
 */
class DiagramView {
  constructor(model, controller) {
    this.model = model;
    this.controller = controller;
    
    // DOM-элементы
    this.canvas = document.getElementById('canvas');
    this.propertiesPanel = document.getElementById('properties-panel');
    
    // Временное соединение
    this.pendingConnectionSvg = null;
    
    // Состояние обновления
    this.updateQueue = [];
    this.isUpdateScheduled = false;
    
    // Инициализация
    this.initModelListeners();
  }
  
  /**
   * Инициализация слушателей модели
   */
  initModelListeners() {
    // Подписываемся на события модели
    this.model.subscribe('onNodeAdded', this.handleNodeAdded.bind(this));
    this.model.subscribe('onNodeRemoved', this.handleNodeRemoved.bind(this));
    this.model.subscribe('onNodeUpdated', this.handleNodeUpdated.bind(this));
    this.model.subscribe('onElementAdded', this.handleElementAdded.bind(this));
    this.model.subscribe('onElementRemoved', this.handleElementRemoved.bind(this));
    this.model.subscribe('onElementUpdated', this.handleElementUpdated.bind(this));
    this.model.subscribe('onConnectionAdded', this.handleConnectionAdded.bind(this));
    this.model.subscribe('onConnectionRemoved', this.handleConnectionRemoved.bind(this));
    this.model.subscribe('onSelectionChanged', this.handleSelectionChanged.bind(this));
    this.model.subscribe('onStateChanged', this.handleStateChanged.bind(this));
  }
  
  /**
   * Обработчик добавления узла
   * @param {Object} data - Данные события
   */
  handleNodeAdded(data) {
    this.renderNode(data.node, true);
    this.scheduleUpdate();
  }
  
  /**
   * Обработчик удаления узла
   * @param {Object} data - Данные события
   */
  handleNodeRemoved(data) {
    const nodeElement = document.getElementById(data.nodeId);
    if (nodeElement) {
      // Анимируем удаление узла
      nodeElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      nodeElement.style.opacity = '0';
      nodeElement.style.transform = 'scale(0.9)';
      
      // Удаляем элемент после завершения анимации
      setTimeout(() => {
        if (nodeElement.parentNode) {
          nodeElement.parentNode.removeChild(nodeElement);
        }
      }, 300);
    }
    
    this.scheduleUpdate();
  }
  
  /**
   * Обработчик обновления узла
   * @param {Object} data - Данные события
   */
  handleNodeUpdated(data) {
    this.renderNode(data.node);
    
    // Обновляем связанные соединения
    const connections = this.model.getConnectionsByNodeId(data.nodeId);
    connections.forEach(connection => {
      this.renderConnection(connection);
    });
    
    this.scheduleUpdate();
  }
  
  /**
   * Обработчик добавления элемента
   * @param {Object} data - Данные события
   */
  handleElementAdded(data) {
    const node = this.model.getNodeById(data.nodeId);
    if (node) {
      this.renderNode(node);
      this.scheduleUpdate();
    }
    
    // Обновляем панель свойств, если выбран элемент
    if (this.model.selectedNodeId === data.nodeId && 
        this.model.selectedElementId === data.elementId) {
      this.updatePropertiesPanel();
    }
  }
  
  /**
   * Обработчик удаления элемента
   * @param {Object} data - Данные события
   */
  handleElementRemoved(data) {
    const node = this.model.getNodeById(data.nodeId);
    if (node) {
      this.renderNode(node);
      this.scheduleUpdate();
    }
    
    // Обновляем панель свойств
    if (this.model.selectedNodeId === data.nodeId) {
      this.updatePropertiesPanel();
    }
  }
  
  /**
   * Обработчик обновления элемента
   * @param {Object} data - Данные события
   */
  handleElementUpdated(data) {
    const node = this.model.getNodeById(data.nodeId);
    if (node) {
      this.renderNode(node);
      this.scheduleUpdate();
    }
    
    // Обновляем панель свойств, если выбран элемент
    if (this.model.selectedNodeId === data.nodeId && 
        this.model.selectedElementId === data.elementId) {
      this.updatePropertiesPanel();
    }
  }
  
  /**
   * Обработчик добавления соединения
   * @param {Object} data - Данные события
   */
  handleConnectionAdded(data) {
    const connection = this.model.getConnectionById(data.connectionId);
    if (connection) {
      this.renderConnection(connection);
      this.scheduleUpdate();
    }
  }
  
  /**
   * Обработчик удаления соединения
   * @param {Object} data - Данные события
   */
  handleConnectionRemoved(data) {
    const connectionElement = document.getElementById(data.connectionId);
    if (connectionElement) {
      // Анимируем удаление соединения
      connectionElement.style.transition = 'opacity 0.3s ease';
      connectionElement.style.opacity = '0';
      
      // Удаляем элемент после завершения анимации
      setTimeout(() => {
        if (connectionElement.parentNode) {
          connectionElement.parentNode.removeChild(connectionElement);
        }
      }, 300);
    }
    
    this.scheduleUpdate();
  }
  
  /**
   * Обработчик изменения выделения
   * @param {Object} data - Данные события
   */
  handleSelectionChanged(data) {
    // Обновляем выделение узлов
    document.querySelectorAll('.node.selected').forEach(node => {
      node.classList.remove('selected');
    });
    
    // Обновляем выделение соединений
    document.querySelectorAll('.connection.selected').forEach(connection => {
      connection.classList.remove('selected');
    });
    
    // Обновляем выделение элементов
    document.querySelectorAll('.node-element.selected').forEach(element => {
      element.classList.remove('selected');
    });
    
    // Устанавливаем новое выделение
    if (data.type === 'node' && data.nodeId) {
      const nodeElement = document.getElementById(data.nodeId);
      if (nodeElement) {
        nodeElement.classList.add('selected');
      }
    } else if (data.type === 'element' && data.nodeId && data.elementId) {
      const nodeElement = document.getElementById(data.nodeId);
      if (nodeElement) {
        nodeElement.classList.add('selected');
        
        const elementElement = nodeElement.querySelector(`.node-element[data-element-id="${data.elementId}"]`);
        if (elementElement) {
          elementElement.classList.add('selected');
        }
      }
    } else if (data.type === 'connection' && data.connectionId) {
      const connectionElement = document.getElementById(data.connectionId);
      if (connectionElement) {
        connectionElement.classList.add('selected');
      }
    }
    
    // Обновляем панель свойств
    this.updatePropertiesPanel();
    
    this.scheduleUpdate();
  }
  
  /**
   * Обработчик изменения состояния
   * @param {Object} data - Данные события
   */
  handleStateChanged(data) {
    if (data.type === 'pendingConnectionUpdated') {
      if (this.model.pendingConnection) {
        this.renderPendingConnection(
          this.model.pendingConnection.sourcePosition,
          this.model.pendingConnection.targetPosition
        );
      }
    } else if (data.type === 'pendingConnectionCancelled') {
      this.clearPendingConnection();
    } else if (data.type === 'dataImported' || data.type === 'historyRestore') {
      // Полная перерисовка при импорте данных или восстановлении из истории
      this.render();
    }
    
    this.scheduleUpdate();
  }
  
  /**
   * Планирование обновления представления
   */
  scheduleUpdate() {
    if (!this.isUpdateScheduled) {
      this.isUpdateScheduled = true;
      
      // Используем requestAnimationFrame для оптимизации производительности
      requestAnimationFrame(() => {
        this.processPendingUpdates();
        this.isUpdateScheduled = false;
      });
    }
  }
  
  /**
   * Обработка отложенных обновлений
   */
  processPendingUpdates() {
    // Место для возможной оптимизации обновлений
    // Например, группировка сходных обновлений или отложенный рендеринг
  }
  
  /**
   * Получение видимой области с учетом масштаба и позиции холста
   */
  getVisibleRect() {
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();
    const position = this.controller.canvasState.position;
    const scale = this.controller.canvasState.scale;

    return {
      left: position.x,
      top: position.y,
      right: position.x + rect.width / scale,
      bottom: position.y + rect.height / scale
    };
  }

  /**
   * Проверка, находится ли узел в видимой области
   */
  isNodeInVisibleRect(node, visibleRect) {
    if (!node) return false;

    const padding = 100; // Отступ для плавной загрузки
    const nodeWidth = CONSTANTS.NODE.DEFAULT_WIDTH;
    const nodeHeight = CONSTANTS.NODE.DEFAULT_HEIGHT;

    const nodeRight = node.position.x + nodeWidth;
    const nodeBottom = node.position.y + nodeHeight;

    return !(nodeRight < visibleRect.left - padding ||
             node.position.x > visibleRect.right + padding ||
             nodeBottom < visibleRect.top - padding ||
             node.position.y > visibleRect.bottom + padding);
  }

  /**
   * Модифицированный метод рендеринга с виртуализацией
   */
  render() {
    this.cleanupOffscreenElements();

    const visibleRect = this.getVisibleRect();

    // Рендерим только видимые узлы
    this.model.nodes.forEach(node => {
      if (this.isNodeInVisibleRect(node, visibleRect)) {
        this.renderNode(node);
      }
    });

    // Рендерим только соединения между видимыми узлами
    this.model.connections.forEach(connection => {
      const sourceNode = this.model.getNodeById(connection.source);
      const targetNode = this.model.getNodeById(connection.target);

      if ((sourceNode && this.isNodeInVisibleRect(sourceNode, visibleRect)) ||
          (targetNode && this.isNodeInVisibleRect(targetNode, visibleRect))) {
        this.renderConnection(connection);
      }
    });

    // Рендерим временное соединение, если есть
    if (this.model.pendingConnection) {
      this.renderPendingConnection(
        this.model.pendingConnection.sourcePosition,
        this.model.pendingConnection.targetPosition
      );
    }
  }

  /**
   * Удаление невидимых элементов из DOM
   */
  cleanupOffscreenElements() {
    const visibleRect = this.getVisibleRect();

    // Удаляем невидимые узлы
    document.querySelectorAll('.node').forEach(nodeElement => {
      const nodeId = nodeElement.id;
      const node = this.model.getNodeById(nodeId);

      if (node && !this.isNodeInVisibleRect(node, visibleRect)) {
        nodeElement.remove();
      }
    });

    // Удаляем невидимые соединения
    document.querySelectorAll('.connection').forEach(connectionElement => {
      const connectionId = connectionElement.id;
      const connection = this.model.getConnectionById(connectionId);

      if (connection) {
        const sourceNode = this.model.getNodeById(connection.source);
        const targetNode = this.model.getNodeById(connection.target);

        if ((!sourceNode || !this.isNodeInVisibleRect(sourceNode, visibleRect)) &&
            (!targetNode || !this.isNodeInVisibleRect(targetNode, visibleRect))) {
          connectionElement.remove();
        }
      }
    });
  }
  
  /**
   * Отрисовка узла
   * @param {Object} node - Данные узла
   * @param {boolean} animate - Флаг анимации появления
   */
  renderNode(node, animate = false) {
    // Проверяем, существует ли уже элемент для этого узла
    let nodeElement = document.getElementById(node.id);
    
    if (!nodeElement) {
      // Создаем новый элемент узла
      nodeElement = document.createElement('div');
      nodeElement.id = node.id;
      nodeElement.className = 'node';
      nodeElement.dataset.nodeType = node.type;
      
      // Добавляем в DOM
      this.canvas.appendChild(nodeElement);
      
      // Добавляем анимацию появления
      if (animate) {
        nodeElement.style.opacity = '0';
        nodeElement.style.transform = 'scale(0.9)';
        
        // После добавления в DOM, анимируем появление
        setTimeout(() => {
          nodeElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          nodeElement.style.opacity = '1';
          nodeElement.style.transform = 'scale(1)';
          
          // Убираем transition после завершения анимации
          setTimeout(() => {
            nodeElement.style.transition = '';
          }, 300);
        }, 10);
      }
    }
    
    // Обновляем класс выбранного узла
    if (this.model.selectedNodeId === node.id) {
      nodeElement.classList.add('selected');
    } else {
      nodeElement.classList.remove('selected');
    }
    
    // Обновляем позицию узла
    nodeElement.style.left = `${node.position.x}px`;
    nodeElement.style.top = `${node.position.y}px`;
    
    // Обновляем содержимое узла
    this.renderNodeContent(nodeElement, node);
  }
  
  /**
   * Отрисовка содержимого узла
   * @param {HTMLElement} nodeElement - DOM-элемент узла
   * @param {Object} node - Данные узла
   */
  renderNodeContent(nodeElement, node) {
    // Создаем заголовок узла
    const headerHTML = `
      <div class="node-header">
        <div class="title">
          <div class="indicator ${node.type}"></div>
          <span>${node.title || CONSTANTS.NODE.TYPE_NAMES[node.type] || 'Узел'}</span>
        </div>
        <div class="actions">
          <button class="btn-icon" aria-label="Дублировать" data-tooltip="Дублировать">
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path>
            </svg>
          </button>
          <button class="btn-icon" aria-label="Удалить" data-tooltip="Удалить">
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Создаем содержимое узла
    let contentHTML = '<div class="node-content">';
    
    // Добавляем элементы узла
    node.elements.forEach(element => {
      contentHTML += this.renderNodeElement(element, node.id);
    });
    
    // Добавляем кнопку для добавления элемента
    contentHTML += `
      <div class="node-add-element">
        <button>+ Добавить элемент</button>
      </div>
    </div>
    `;
    
    // Добавляем порты для соединений
    const portsHTML = `
      <div class="node-port node-port-in"></div>
      <div class="node-port node-port-out"></div>
    `;
    
    // Обновляем содержимое
    nodeElement.innerHTML = headerHTML + contentHTML + portsHTML;
    
    // Добавляем обработчики событий для кнопок
    this.addNodeEventListeners(nodeElement, node.id);
  }
  
  /**
   * Отрисовка элемента узла
   * @param {Object} element - Данные элемента
   * @param {string} nodeId - ID узла
   * @returns {string} - HTML элемента
   */
  renderNodeElement(element, nodeId) {
    // Проверка, выбран ли элемент
    const isSelected = this.model.selectedNodeId === nodeId && 
                      this.model.selectedElementId === element.id;
    
    // Создаем класс для выделения
    const selectedClass = isSelected ? 'selected' : '';
    
    // Заголовок элемента
    let html = `
      <div class="node-element ${selectedClass}" data-element-id="${element.id}">
        <div class="node-element-header">
          <span>${CONSTANTS.ELEMENT.TYPE_NAMES[element.type] || 'Элемент'}</span>
          <button class="btn-icon" aria-label="Удалить элемент" data-tooltip="Удалить элемент" style="width: 20px; height: 20px;">
            <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
            </svg>
          </button>
        </div>
    `;
    
    // Содержимое элемента в зависимости от типа
    html += '<div class="node-element-content">';
    
    switch (element.type) {
      case CONSTANTS.ELEMENT.TYPES.TEXT:
        html += `<div class="element-text">${element.data.text || 'Пустой текст'}</div>`;
        break;
      case CONSTANTS.ELEMENT.TYPES.IMAGE:
        html += `
          <div class="element-image">
            ${element.data.url ? 
              `<div class="image-preview">
                <img src="${element.data.url}" alt="${element.data.caption || 'Изображение'}" onerror="this.src='/api/placeholder/150/100';this.onerror=null;" style="max-width:100%;max-height:80px;object-fit:contain;" />
               </div>` : 
              'Изображение: [не задано]'}
            ${element.data.caption ? `<div class="image-caption">${element.data.caption}</div>` : ''}
          </div>`;
        break;
      case CONSTANTS.ELEMENT.TYPES.AUDIO:
        html += `<div class="element-audio">Аудио: ${element.data.url ? element.data.url : '[не задано]'}</div>`;
        break;
      case CONSTANTS.ELEMENT.TYPES.VIDEO:
        html += `<div class="element-video">Видео: ${element.data.url ? element.data.url : '[не задано]'}</div>`;
        break;
      case CONSTANTS.ELEMENT.TYPES.CHOICE:
        html += `
          <div class="element-choice">
            <div class="element-choice-question">${element.data.question || 'Выберите вариант:'}</div>
            <div class="element-choice-options">
              ${(element.data.options || []).map(option => 
                `<div class="element-choice-option">${option}</div>`
              ).join('')}
            </div>
          </div>
        `;
        break;
      default:
        html += `<div>Неизвестный тип элемента: ${element.type}</div>`;
    }
    
    html += '</div></div>';
    
    return html;
  }
  
  /**
   * Добавление обработчиков событий для узла
   * @param {HTMLElement} nodeElement - DOM-элемент узла
   * @param {string} nodeId - ID узла
   */
  addNodeEventListeners(nodeElement, nodeId) {
    // Кнопка дублирования узла
    const duplicateBtn = nodeElement.querySelector('.node-header .actions button[aria-label="Дублировать"]');
    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.duplicateNode(nodeId);
      });
    }
    
    // Кнопка удаления узла
    const removeBtn = nodeElement.querySelector('.node-header .actions button[aria-label="Удалить"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.model.removeNode(nodeId);
      });
    }
    
    // Кнопка добавления элемента
    const addElementBtn = nodeElement.querySelector('.node-add-element button');
    if (addElementBtn) {
      addElementBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showElementPanel(nodeElement, nodeId);
      });
    }
    
    // Обработчики для элементов узла
    const elements = nodeElement.querySelectorAll('.node-element');
    elements.forEach(element => {
      const elementId = element.dataset.elementId;
      
      // Кнопка удаления элемента
      const removeElementBtn = element.querySelector('.node-element-header button');
      if (removeElementBtn) {
        removeElementBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.model.removeElement(nodeId, elementId);
        });
      }
      
      // Выбор элемента при клике
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this.model.setSelectedElement(nodeId, elementId);
        this.controller.showPropertiesPanel();
      });
    });
    
    // Обработчик для заголовка (начало перетаскивания)
    const header = nodeElement.querySelector('.node-header');
    if (header) {
      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; // Игнорируем клики по кнопкам
        
        // Начинаем перетаскивание узла
        this.controller.startNodeDrag(e, nodeId);
      });
    }
    
    // Обработчики для портов (создание соединений)
    const outputPort = nodeElement.querySelector('.node-port-out');
    if (outputPort) {
      outputPort.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.controller.startConnectionCreation(e, nodeId);
      });
    }
    
    // Обработчик для клика по узлу (выделение)
    nodeElement.addEventListener('click', (e) => {
      // Игнорируем клики по элементам и кнопкам
      if (e.target.closest('.node-element') || e.target.closest('button') || e.target.closest('.node-port')) {
        return;
      }
      
      this.model.setSelectedNode(nodeId);
      this.controller.showPropertiesPanel();
    });
  }
  
  /**
   * Показ панели выбора элемента
   * @param {HTMLElement} nodeElement - DOM-элемент узла
   * @param {string} nodeId - ID узла
   */
  showElementPanel(nodeElement, nodeId) {
    // Проверяем, существует ли уже панель выбора элемента
    let elementPanel = document.getElementById('element-panel');
    
    // Если панель не существует, создаем ее
    if (!elementPanel) {
      elementPanel = document.createElement('div');
      elementPanel.id = 'element-panel';
      elementPanel.className = 'element-panel';
      document.body.appendChild(elementPanel);
      
      // Создаем содержимое панели
      elementPanel.innerHTML = `
        <div class="element-panel-header">
          Добавить элемент
        </div>
        <div class="element-panel-body">
          <div class="element-type" data-element-type="text">
            <div class="icon-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"></path>
              </svg>
            </div>
            <span>Текст</span>
          </div>
          <div class="element-type" data-element-type="image">
            <div class="icon-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"></path>
              </svg>
            </div>
            <span>Изображение</span>
          </div>
          <div class="element-type" data-element-type="audio">
            <div class="icon-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"></path>
              </svg>
            </div>
            <span>Аудио</span>
          </div>
          <div class="element-type" data-element-type="video">
            <div class="icon-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path>
              </svg>
            </div>
            <span>Видео</span>
          </div>
          <div class="element-type" data-element-type="choice">
            <div class="icon-container">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
              </svg>
            </div>
            <span>Выбор варианта</span>
          </div>
        </div>
      `;
      
      // Добавляем обработчики для типов элементов
      const elementTypes = elementPanel.querySelectorAll('.element-type');
      elementTypes.forEach(typeElement => {
        typeElement.addEventListener('click', () => {
          const elementType = typeElement.dataset.elementType;
          const panelNodeId = elementPanel.dataset.nodeId;
          
          if (panelNodeId && elementType) {
            // Добавляем новый элемент
            const elementId = this.model.addElement(panelNodeId, elementType);
            
            // Выбираем созданный элемент
            if (elementId) {
              this.model.setSelectedElement(panelNodeId, elementId);
              this.controller.showPropertiesPanel();
            }
            
            // Скрываем панель
            elementPanel.style.display = 'none';
          }
        });
      });
      
      // Закрытие панели при клике вне ее
      document.addEventListener('click', (e) => {
        if (elementPanel.style.display !== 'none' && 
            !elementPanel.contains(e.target) && 
            !e.target.closest('.node-add-element button')) {
          elementPanel.style.display = 'none';
        }
      });
    }
    
    // Позиционируем панель под узлом
    const rect = nodeElement.getBoundingClientRect();
    elementPanel.style.position = 'absolute';
    elementPanel.style.left = `${rect.left}px`;
    elementPanel.style.top = `${rect.bottom + 10}px`;
    
    // Проверяем, не выходит ли панель за границы экрана
    const elementPanelRect = elementPanel.getBoundingClientRect();
    if (rect.left + elementPanelRect.width > window.innerWidth) {
      elementPanel.style.left = `${window.innerWidth - elementPanelRect.width - 10}px`;
    }
    
    // Сохраняем ID узла
    elementPanel.dataset.nodeId = nodeId;
    
    // Показываем панель с анимацией
    elementPanel.style.display = 'block';
    elementPanel.style.opacity = '0';
    elementPanel.style.transform = 'translateY(-10px)';
    
    // Анимируем появление
    requestAnimationFrame(() => {
      elementPanel.style.transition = 'opacity 0.2s, transform 0.2s';
      elementPanel.style.opacity = '1';
      elementPanel.style.transform = 'translateY(0)';
    });
  }
  
  /**
   * Отрисовка соединения
   * @param {Object} connection - Данные соединения
   */
  renderConnection(connection) {
    const sourceNode = this.model.getNodeById(connection.source);
    const targetNode = this.model.getNodeById(connection.target);
    
    if (!sourceNode || !targetNode) return;
    
    // Проверяем, существует ли уже элемент для этого соединения
    let connectionElement = document.getElementById(connection.id);
    
    // Если элемент существует, удаляем его для перерисовки
    if (connectionElement) {
      connectionElement.remove();
    }
    
    // Создаем SVG для соединения
    connectionElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connectionElement.setAttribute('class', 'connection');
    connectionElement.setAttribute('id', connection.id);
    
    // Проверяем, выбрано ли соединение
    if (this.model.selectedConnectionId === connection.id) {
      connectionElement.classList.add('selected');
    }
    
    // Получаем DOM-элементы узлов
    const sourceElement = document.getElementById(connection.source);
    const targetElement = document.getElementById(connection.target);
    
    if (!sourceElement || !targetElement) return;
    
    // Получаем порты узлов
    const sourcePort = sourceElement.querySelector('.node-port-out');
    const targetPort = targetElement.querySelector('.node-port-in');
    
    if (!sourcePort || !targetPort) return;
    
    // Вычисляем координаты портов
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    
    // Позиция исходного порта
    const sourceX = sourceNode.position.x + sourceRect.width / 2;
    const sourceY = sourceNode.position.y + sourceRect.height;
    
    // Позиция целевого порта
    const targetX = targetNode.position.x + targetRect.width / 2;
    const targetY = targetNode.position.y;
    
    // Отрисовываем соединение
    this.drawConnection(connectionElement, sourceX, sourceY, targetX, targetY);
    
    // Добавляем в DOM
    this.canvas.appendChild(connectionElement);
    
    // Добавляем обработчик для выбора соединения
    connectionElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.model.setSelectedConnection(connection.id);
    });
  }
  
  /**
   * Отрисовка временного соединения
   * @param {Object} sourcePosition - Позиция исходного порта
   * @param {Object} targetPosition - Позиция курсора
   */
  renderPendingConnection(sourcePosition, targetPosition) {
    // Удаляем предыдущее временное соединение
    this.clearPendingConnection();
    
    // Создаем SVG для временного соединения
    this.pendingConnectionSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.pendingConnectionSvg.setAttribute('class', 'connection pending');
    this.pendingConnectionSvg.setAttribute('id', 'pending-connection');
    
    // Создаем путь для соединения с пунктирной линией
    this.drawConnection(
      this.pendingConnectionSvg, 
      sourcePosition.x, 
      sourcePosition.y, 
      targetPosition.x, 
      targetPosition.y,
      true
    );
    
    // Добавляем в DOM
    this.canvas.appendChild(this.pendingConnectionSvg);
  }
  
  /**
   * Удаление временного соединения
   */
  clearPendingConnection() {
    if (this.pendingConnectionSvg) {
      this.pendingConnectionSvg.remove();
      this.pendingConnectionSvg = null;
    }
  }
  
  /**
   * Отрисовка пути соединения
   * @param {SVGElement} svg - SVG-элемент соединения
   * @param {number} x1 - X-координата исходной точки
   * @param {number} y1 - Y-координата исходной точки
   * @param {number} x2 - X-координата целевой точки
   * @param {number} y2 - Y-координата целевой точки
   * @param {boolean} isPending - Флаг временного соединения
   */
  drawConnection(svg, x1, y1, x2, y2, isPending = false) {
    // Вычисляем размеры и позицию SVG
    const padding = 20; // Отступ для SVG
    const left = Math.min(x1, x2) - padding;
    const top = Math.min(y1, y2) - padding;
    const width = Math.abs(x2 - x1) + 2 * padding;
    const height = Math.abs(y2 - y1) + 2 * padding;
    
    svg.style.left = `${left}px`;
    svg.style.top = `${top}px`;
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    
    // Координаты относительно SVG
    const sx = x1 - left;
    const sy = y1 - top;
    const tx = x2 - left;
    const ty = y2 - top;
    
    // Контрольные точки для кривой Безье
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    const controlPointDistance = Math.min(100, Math.max(dx, dy) * 0.5);
    
    // Создаем путь для соединения
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${sx} ${sy} C ${sx} ${sy + controlPointDistance}, ${tx} ${ty - controlPointDistance}, ${tx} ${ty}`;
    
    path.setAttribute('d', d);
    
    // Для временного соединения добавляем пунктирную линию
    if (isPending) {
      path.setAttribute('stroke-dasharray', '5,5');
      path.setAttribute('class', 'pending');
    }
    
    // Добавляем стрелку на конце соединения
    const arrowMarker = this.createArrowMarker(tx, ty, tx, ty - controlPointDistance);
    
    // Добавляем элементы в SVG
    svg.appendChild(path);
    svg.appendChild(arrowMarker);
    
    // Добавляем анимацию для новых соединений (не временных)
    if (!isPending && !document.getElementById(svg.id)) {
      path.style.strokeDasharray = '200';
      path.style.strokeDashoffset = '200';
      path.style.transition = 'stroke-dashoffset 0.5s ease';
      
      // После добавления в DOM, анимируем появление
      setTimeout(() => {
        path.style.strokeDashoffset = '0';
      }, 10);
    }
  }
  
  /**
   * Создание стрелки для соединения
   * @param {number} x - X-координата конечной точки
   * @param {number} y - Y-координата конечной точки
   * @param {number} cx - X-координата контрольной точки
   * @param {number} cy - Y-координата контрольной точки
   * @returns {SVGPathElement} - Элемент стрелки
   */
  createArrowMarker(x, y, cx, cy) {
    // Вычисляем угол стрелки
    const dx = x - cx;
    const dy = y - cy;
    const angle = Math.atan2(dy, dx);
    
    // Размер стрелки
    const arrowSize = 8;
    
    // Точки стрелки
    const p1 = {
      x: x - arrowSize * Math.cos(angle - Math.PI/6),
      y: y - arrowSize * Math.sin(angle - Math.PI/6)
    };
    
    const p2 = {
      x: x - arrowSize * Math.cos(angle + Math.PI/6),
      y: y - arrowSize * Math.sin(angle + Math.PI/6)
    };
    
    // Создаем элемент стрелки
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', `M ${x} ${y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`);
    arrow.setAttribute('class', 'connection-arrow');
    
    return arrow;
  }
  
  /**
   * Обновление панели свойств
   */
  updatePropertiesPanel() {
    if (!this.propertiesPanel) return;
    
    // Заголовок панели
    const propertiesTitle = this.propertiesPanel.querySelector('.properties-title');
    const propertiesIcon = this.propertiesPanel.querySelector('.properties-icon');
    const propertiesContent = this.propertiesPanel.querySelector('.properties-panel-body');
    
    if (!propertiesTitle || !propertiesIcon || !propertiesContent) return;
    
    // Получаем выбранный элемент
    if (this.model.selectedNodeId) {
      const node = this.model.getNodeById(this.model.selectedNodeId);
      if (!node) return;
      
      // Обновляем заголовок и иконку
      propertiesTitle.querySelector('span').textContent = node.title;
      propertiesIcon.innerHTML = this.getNodeTypeIcon(node.type);
      
      // Обновляем форму свойств
      if (this.model.selectedElementId) {
        // Показываем свойства элемента
        this.updateElementPropertiesForm(node, this.model.selectedElementId);
      } else {
        // Показываем свойства узла
        this.updateNodePropertiesForm(node);
      }
      
    } else if (this.model.selectedConnectionId) {
      // Показываем свойства соединения
      const connection = this.model.getConnectionById(this.model.selectedConnectionId);
      if (connection) {
        this.updateConnectionPropertiesForm(connection);
      }
    }
  }
  
  /**
   * Получение иконки для типа узла
   * @param {string} nodeType - Тип узла
   * @returns {string} - HTML иконки
   */
  getNodeTypeIcon(nodeType) {
    let iconPath = '';
    
    switch (nodeType) {
      case CONSTANTS.NODE.TYPES.START:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-primary);"><path d="M8 5v14l11-7z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.MESSAGE:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-success);"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22л4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.INPUT:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-warning);"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.LOGIC:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-danger);"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.API:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-primary);"><path d="M14 12l-2 2-2-2 2-2 2 2zm-2-6l2.12 2.12 2.5-2.5L12 1 7.38 5.62л2.5 2.5L12 6zm-6 6l2.12-2.12-2.5-2.5L1 12l4.62 4.62 2.5-2.5L6 12zm12 0l-2.12 2.12 2.5 2.5L23 12l-4.62-4.62-2.5 2.5L18 12zm-6 6l-2.12-2.12-2.5 2.5L12 23l4.62-4.62-2.5-2.5L12 18z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.PAYMENT:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-success);"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"></path></svg>';
        break;
      case CONSTANTS.NODE.TYPES.DATABASE:
        iconPath = '<svg class="icon" viewBox="0 0 24 24" style="color: var(--accent-warning);"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"></path></svg>';
        break;
      default:
        iconPath = '<svg class="icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 15.5h-2V14h-2v-2h2V9.5h2V12h2v2h-2v4.5z"></path></svg>';
    }
    
    return iconPath;
  }
  
  /**
   * Обновление формы свойств узла
   * @param {Object} node - Данные узла
   */
  updateNodePropertiesForm(node) {
    const form = this.createNodePropertiesForm(node);
    const propertiesContent = this.propertiesPanel.querySelector('.properties-panel-body');
    
    // Очищаем содержимое
    propertiesContent.innerHTML = '';
    
    // Добавляем превью узла
    const preview = document.createElement('div');
    preview.className = 'properties-preview';
    preview.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary);">
        ${this.getNodeTypeIcon(node.type)}
        <div style="margin-top: 12px;">${CONSTANTS.NODE.TYPE_NAMES[node.type]}</div>
        <div style="margin-top: 4px; font-size: 12px; opacity: 0.7;">ID: ${node.id}</div>
      </div>
    `;
    
    propertiesContent.appendChild(preview);
    propertiesContent.appendChild(form);
    
    // Добавляем обработчики для формы
    this.addNodeFormEventListeners(form, node);
    
    // Обновляем кнопки на панели
    const deleteButton = this.propertiesPanel.querySelector('#delete-element');
    const duplicateButton = this.propertiesPanel.querySelector('#duplicate-element');
    
    if (deleteButton) {
      deleteButton.innerText = 'Удалить';
      deleteButton.onclick = () => this.model.removeNode(node.id);
    }
    
    if (duplicateButton) {
      duplicateButton.innerText = 'Дублировать';
      duplicateButton.onclick = () => this.controller.duplicateNode(node.id);
    }
  }
  
  /**
   * Создание формы свойств узла
   * @param {Object} node - Данные узла
   * @returns {HTMLElement} - DOM-элемент формы
   */
  createNodePropertiesForm(node) {
    const form = document.createElement('div');
    form.className = 'properties-form';
    
    // Общие настройки
    const generalSection = document.createElement('div');
    generalSection.className = 'properties-section';
    generalSection.innerHTML = `
      <h3 class="properties-section-title">Общие настройки</h3>
      <div class="form-group">
        <label for="node-name">Название</label>
        <input type="text" id="node-name" class="form-control" value="${node.title || ''}">
      </div>
      <div class="form-group">
        <label for="node-description">Описание</label>
        <textarea id="node-description" class="form-control" placeholder="Описание узла...">${node.description || ''}</textarea>
      </div>
    `;
    
    form.appendChild(generalSection);
    
    // Дополнительные настройки в зависимости от типа узла
    switch (node.type) {
      case CONSTANTS.NODE.TYPES.START:
        // Нет дополнительных настроек
        break;
      case CONSTANTS.NODE.TYPES.MESSAGE:
        // Нет дополнительных настроек
        break;
      case CONSTANTS.NODE.TYPES.INPUT:
        const inputSection = document.createElement('div');
        inputSection.className = 'properties-section';
        inputSection.innerHTML = `
          <h3 class="properties-section-title">Настройки ввода</h3>
          <div class="form-group">
            <label for="input-validator">Валидатор</label>
            <select id="input-validator" class="form-control">
              <option value="none" ${!node.validator || node.validator === 'none' ? 'selected' : ''}>Нет</option>
              <option value="text" ${node.validator === 'text' ? 'selected' : ''}>Текст</option>
              <option value="number" ${node.validator === 'number' ? 'selected' : ''}>Число</option>
              <option value="email" ${node.validator === 'email' ? 'selected' : ''}>Email</option>
              <option value="phone" ${node.validator === 'phone' ? 'selected' : ''}>Телефон</option>
              <option value="regex" ${node.validator === 'regex' ? 'selected' : ''}>Регулярное выражение</option>
            </select>
          </div>
        `;
        
        form.appendChild(inputSection);
        break;
      case CONSTANTS.NODE.TYPES.LOGIC:
        const logicSection = document.createElement('div');
        logicSection.className = 'properties-section';
        logicSection.innerHTML = `
          <h3 class="properties-section-title">Настройки условия</h3>
          <div class="form-group">
            <label for="condition-type">Тип условия</label>
            <select id="condition-type" class="form-control">
              <option value="variable" ${!node.conditionType || node.conditionType === 'variable' ? 'selected' : ''}>Переменная</option>
              <option value="comparison" ${node.conditionType === 'comparison' ? 'selected' : ''}>Сравнение</option>
              <option value="complex" ${node.conditionType === 'complex' ? 'selected' : ''}>Сложное условие</option>
            </select>
          </div>
        `;
        
        form.appendChild(logicSection);
        break;
    }
    
    return form;
  }
  
  /**
   * Добавление обработчиков к форме свойств узла
   * @param {HTMLElement} form - DOM-элемент формы
   * @param {Object} node - Данные узла
   */
  addNodeFormEventListeners(form, node) {
    // Обработчик изменения названия
    const nameInput = form.querySelector('#node-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.model.updateNode(node.id, { title: nameInput.value });
      });
    }
    
    // Обработчик изменения описания
    const descriptionTextarea = form.querySelector('#node-description');
    if (descriptionTextarea) {
      descriptionTextarea.addEventListener('input', () => {
        this.model.updateNode(node.id, { description: descriptionTextarea.value });
      });
    }
    
    // Обработчики для специфичных полей узлов
    switch (node.type) {
      case CONSTANTS.NODE.TYPES.INPUT:
        const validatorSelect = form.querySelector('#input-validator');
        if (validatorSelect) {
          validatorSelect.addEventListener('change', () => {
            this.model.updateNode(node.id, { validator: validatorSelect.value });
          });
        }
        break;
      case CONSTANTS.NODE.TYPES.LOGIC:
        const conditionTypeSelect = form.querySelector('#condition-type');
        if (conditionTypeSelect) {
          conditionTypeSelect.addEventListener('change', () => {
            this.model.updateNode(node.id, { conditionType: conditionTypeSelect.value });
          });
        }
        break;
    }
  }
  
  /**
   * Обновление формы свойств элемента
   * @param {Object} node - Данные узла
   * @param {string} elementId - ID элемента
   */
  updateElementPropertiesForm(node, elementId) {
    const element = node.elements.find(el => el.id === elementId);
    if (!element) return;
    
    const form = this.createElementPropertiesForm(node, element);
    const propertiesContent = this.propertiesPanel.querySelector('.properties-panel-body');
    
    // Очищаем содержимое
    propertiesContent.innerHTML = '';
    
    // Добавляем превью элемента
    const preview = document.createElement('div');
    preview.className = 'properties-preview';
    
    // Создаем превью в зависимости от типа элемента
    switch (element.type) {
      case CONSTANTS.ELEMENT.TYPES.TEXT:
        preview.innerHTML = `
          <div style="padding: 16px; background-color: var(--bg-tertiary); border-radius: var(--radius-medium); text-align: center;">
            <div class="element-text" style="max-height: 120px; overflow: auto;">${element.data.text || 'Пустой текст'}</div>
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.IMAGE:
        preview.innerHTML = `
          <div style="padding: 16px; background-color: var(--bg-tertiary); border-radius: var(--radius-medium); text-align: center;">
            ${element.data.url ? 
              `<img src="${element.data.url}" alt="${element.data.caption || 'Изображение'}" onerror="this.src='/api/placeholder/220/150';this.onerror=null;" style="max-width:100%; max-height:120px; object-fit:contain;" />` : 
              '<div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">Изображение не задано</div>'}
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.AUDIO:
        preview.innerHTML = `
          <div style="padding: 16px; background-color: var(--bg-tertiary); border-radius: var(--radius-medium); text-align: center;">
            <svg class="icon" viewBox="0 0 24 24" style="width: 48px; height: 48px; color: var(--text-secondary);">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"></path>
            </svg>
            <div style="margin-top: 8px; color: var(--text-secondary);">
              ${element.data.url ? element.data.url : 'Аудио не задано'}
            </div>
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.VIDEO:
        preview.innerHTML = `
          <div style="padding: 16px; background-color: var(--bg-tertiary); border-radius: var(--radius-medium); text-align: center;">
            <svg class="icon" viewBox="0 0 24 24" style="width: 48px; height: 48px; color: var(--text-secondary);">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11л-4 4z"></path>
            </svg>
            <div style="margin-top: 8px; color: var(--text-secondary);">
              ${element.data.url ? element.data.url : 'Видео не задано'}
            </div>
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.CHOICE:
        preview.innerHTML = `
          <div style="padding: 16px; background-color: var(--bg-tertiary); border-radius: var(--radius-medium);">
            <div class="element-choice-question" style="margin-bottom: 8px; font-weight: 500;">${element.data.question || 'Выберите вариант:'}</div>
            <div class="element-choice-options" style="display: flex; flex-direction: column; gap: 4px;">
              ${(element.data.options || []).map(option => 
                `<div class="element-choice-option" style="padding: 6px 12px; background-color: var(--bg-primary); border-radius: var(--radius-small);">${option}</div>`
              ).join('')}
            </div>
          </div>
        `;
        break;
    }
    
    propertiesContent.appendChild(preview);
    propertiesContent.appendChild(form);
    
    // Добавляем обработчики для формы
    this.addElementFormEventListeners(form, node, element);
    
    // Обновляем кнопки на панели
    const deleteButton = this.propertiesPanel.querySelector('#delete-element');
    const duplicateButton = this.propertiesPanel.querySelector('#duplicate-element');
    
    if (deleteButton) {
      deleteButton.innerText = 'Удалить элемент';
      deleteButton.onclick = () => this.model.removeElement(node.id, element.id);
    }
    
    if (duplicateButton) {
      duplicateButton.innerText = 'Дублировать элемент';
      duplicateButton.onclick = () => {
        const newElementId = this.model.addElement(node.id, element.type);
        const newElement = node.elements.find(el => el.id === newElementId);
        if (newElement) {
          // Копируем данные из исходного элемента
          this.model.updateElement(node.id, newElementId, {...element.data});
          this.model.setSelectedElement(node.id, newElementId);
        }
      };
    }
  }
  
  /**
   * Создание формы свойств элемента
   * @param {Object} node - Данные узла
   * @param {Object} element - Данные элемента
   * @returns {HTMLElement} - DOM-элемент формы
   */
  createElementPropertiesForm(node, element) {
    const form = document.createElement('div');
    form.className = 'properties-form';
    
    // Заголовок и общие настройки
    const generalSection = document.createElement('div');
    generalSection.className = 'properties-section';
    generalSection.innerHTML = `
      <h3 class="properties-section-title">Общие настройки</h3>
      <div class="form-group">
        <label for="element-type">Тип элемента</label>
        <select id="element-type" class="form-control" disabled>
          <option value="text" ${element.type === 'text' ? 'selected' : ''}>Текст</option>
          <option value="image" ${element.type === 'image' ? 'selected' : ''}>Изображение</option>
          <option value="audio" ${element.type === 'audio' ? 'selected' : ''}>Аудио</option>
          <option value="video" ${element.type === 'video' ? 'selected' : ''}>Видео</option>
          <option value="choice" ${element.type === 'choice' ? 'selected' : ''}>Выбор варианта</option>
        </select>
      </div>
    `;
    
    form.appendChild(generalSection);
    
    // Контент элемента
    const contentSection = document.createElement('div');
    contentSection.className = 'properties-section';
    contentSection.innerHTML = `<h3 class="properties-section-title">Содержимое</h3>`;
    
    // Поля в зависимости от типа элемента
    switch (element.type) {
      case CONSTANTS.ELEMENT.TYPES.TEXT:
        contentSection.innerHTML += `
          <div class="form-group">
            <label for="element-text">Текст сообщения</label>
            <textarea id="element-text" class="form-control" rows="6">${element.data.text || ''}</textarea>
          </div>
          <div class="form-group d-flex justify-content-between">
            <label>Форматирование</label>
            <div>
              <button class="btn-icon" aria-label="Жирный" data-tooltip="Жирный текст" data-format="bold">
                <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                  <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"></path>
                </svg>
              </button>
              <button class="btn-icon" aria-label="Курсив" data-tooltip="Курсив" data-format="italic">
                <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                  <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"></path>
                </svg>
              </button>
              <button class="btn-icon" aria-label="Ссылка" data-tooltip="Вставить ссылку" data-format="link">
                <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                  <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.IMAGE:
        contentSection.innerHTML += `
          <div class="form-group">
            <label for="element-image-url">URL изображения</label>
            <input type="text" id="element-image-url" class="form-control" value="${element.data.url || ''}">
          </div>
          <div class="form-group">
            <label for="element-image-caption">Подпись</label>
            <input type="text" id="element-image-caption" class="form-control" value="${element.data.caption || ''}">
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.AUDIO:
        contentSection.innerHTML += `
          <div class="form-group">
            <label for="element-audio-url">URL аудио файла</label>
            <input type="text" id="element-audio-url" class="form-control" value="${element.data.url || ''}">
          </div>
          <div class="form-group">
            <label for="element-audio-caption">Подпись</label>
            <input type="text" id="element-audio-caption" class="form-control" value="${element.data.caption || ''}">
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.VIDEO:
        contentSection.innerHTML += `
          <div class="form-group">
            <label for="element-video-url">URL видео</label>
            <input type="text" id="element-video-url" class="form-control" value="${element.data.url || ''}">
          </div>
          <div class="form-group">
            <label for="element-video-caption">Подпись</label>
            <input type="text" id="element-video-caption" class="form-control" value="${element.data.caption || ''}">
          </div>
        `;
        break;
      case CONSTANTS.ELEMENT.TYPES.CHOICE:
        // Создаем вопрос
        contentSection.innerHTML += `
          <div class="form-group">
            <label for="element-choice-question">Вопрос</label>
            <input type="text" id="element-choice-question" class="form-control" value="${element.data.question || 'Выберите вариант:'}">
          </div>
          <div class="form-group">
            <label>Варианты ответа</label>
            <div id="element-choice-options">
              ${(element.data.options || []).map((option, index) => `
                <div class="form-group d-flex" style="margin-bottom: 8px;">
                  <input type="text" class="form-control choice-option" data-index="${index}" value="${option}" style="flex: 1;">
                  <button class="btn-icon remove-option" data-index="${index}" aria-label="Удалить вариант" data-tooltip="Удалить вариант" style="margin-left: 8px;">
                    <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
                    </svg>
                  </button>
                </div>
              `).join('')}
            </div>
            <button class="btn btn-secondary" id="add-option" style="margin-top: 8px;">+ Добавить вариант</button>
          </div>
        `;
        break;
    }
    
    form.appendChild(contentSection);
    
    return form;
  }
  
  /**
   * Добавление обработчиков к форме свойств элемента
   * @param {HTMLElement} form - DOM-элемент формы
   * @param {Object} node - Данные узла
   * @param {Object} element - Данные элемента
   */
  addElementFormEventListeners(form, node, element) {
    // Обработчики в зависимости от типа элемента
    switch (element.type) {
      case CONSTANTS.ELEMENT.TYPES.TEXT:
        const textArea = form.querySelector('#element-text');
        if (textArea) {
          textArea.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { text: textArea.value });
          });
        }
        
        // Обработчики для кнопок форматирования
        const formatButtons = form.querySelectorAll('[data-format]');
        formatButtons.forEach(button => {
          button.addEventListener('click', () => {
            const format = button.dataset.format;
            const textarea = form.querySelector('#element-text');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            
            let newText = '';
            switch (format) {
              case 'bold':
                newText = `**${selectedText}**`;
                break;
              case 'italic':
                newText = `_${selectedText}_`;
                break;
              case 'link':
                newText = `[${selectedText}](https://example.com)`;
                break;
            }
            
            // Вставляем отформатированный текст
            textarea.setRangeText(newText, start, end, 'select');
            
            // Обновляем данные элемента
            this.model.updateElement(node.id, element.id, { text: textarea.value });
            
            // Фокусируемся на текстовом поле
            textarea.focus();
          });
        });
        break;
      case CONSTANTS.ELEMENT.TYPES.IMAGE:
        const imageUrl = form.querySelector('#element-image-url');
        if (imageUrl) {
          imageUrl.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { url: imageUrl.value });
          });
        }
        
        const imageCaption = form.querySelector('#element-image-caption');
        if (imageCaption) {
          imageCaption.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { caption: imageCaption.value });
          });
        }
        break;
      case CONSTANTS.ELEMENT.TYPES.AUDIO:
        const audioUrl = form.querySelector('#element-audio-url');
        if (audioUrl) {
          audioUrl.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { url: audioUrl.value });
          });
        }
        
        const audioCaption = form.querySelector('#element-audio-caption');
        if (audioCaption) {
          audioCaption.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { caption: audioCaption.value });
          });
        }
        break;
      case CONSTANTS.ELEMENT.TYPES.VIDEO:
        const videoUrl = form.querySelector('#element-video-url');
        if (videoUrl) {
          videoUrl.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { url: videoUrl.value });
          });
        }
        
        const videoCaption = form.querySelector('#element-video-caption');
        if (videoCaption) {
          videoCaption.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { caption: videoCaption.value });
          });
        }
        break;
      case CONSTANTS.ELEMENT.TYPES.CHOICE:
        const questionInput = form.querySelector('#element-choice-question');
        if (questionInput) {
          questionInput.addEventListener('input', () => {
            this.model.updateElement(node.id, element.id, { 
              question: questionInput.value,
              options: element.data.options 
            });
          });
        }
        
        // Обработчики для вариантов ответа
        const optionInputs = form.querySelectorAll('.choice-option');
        optionInputs.forEach(input => {
          input.addEventListener('input', () => {
            const options = [...element.data.options];
            const index = parseInt(input.dataset.index);
            options[index] = input.value;
            
            this.model.updateElement(node.id, element.id, { 
              question: element.data.question,
              options: options 
            });
          });
        });
        
        // Кнопки удаления вариантов
        const removeButtons = form.querySelectorAll('.remove-option');
        removeButtons.forEach(button => {
          button.addEventListener('click', () => {
            const options = [...element.data.options];
            const index = parseInt(button.dataset.index);
            options.splice(index, 1);
            
            this.model.updateElement(node.id, element.id, { 
              question: element.data.question,
              options: options 
            });
          });
        });
        
        // Кнопка добавления варианта
        const addButton = form.querySelector('#add-option');
        if (addButton) {
          addButton.addEventListener('click', () => {
            const options = [...(element.data.options || [])];
            options.push(`Вариант ${options.length + 1}`);
            
            this.model.updateElement(node.id, element.id, { 
              question: element.data.question || 'Выберите вариант:',
              options: options 
            });
          });
        }
        break;
    }
  }
  
  /**
   * Обновление формы свойств соединения
   * @param {Object} connection - Данные соединения
   */
  updateConnectionPropertiesForm(connection) {
    const sourceNode = this.model.getNodeById(connection.source);
    const targetNode = this.model.getNodeById(connection.target);
    
    if (!sourceNode || !targetNode) return;
    
    const form = document.createElement('div');
    form.className = 'properties-form';
    
    // Предварительный просмотр соединения
    const preview = document.createElement('div');
    preview.className = 'properties-preview';
    preview.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary);">
        <svg class="icon" viewBox="0 0 24 24" style="width: 36px; height: 36px; margin-bottom: 12px; color: var(--accent-primary);">
          <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"></path>
        </svg>
        <div>Соединение</div>
        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="padding: 4px 8px; background-color: var(--bg-tertiary); border-radius: var(--radius-small);">${sourceNode.title}</span>
          <svg class="icon" viewBox="0 0 24 24" style="color: var(--text-secondary);">
            <path d="M8 16l4-4-4-4" />
          </svg>
          <span style="padding: 4px 8px; background-color: var(--bg-tertiary); border-radius: var(--radius-small);">${targetNode.title}</span>
        </div>
      </div>
    `;
    
    // Основная информация
    const infoSection = document.createElement('div');
    infoSection.className = 'properties-section';
    infoSection.innerHTML = `
      <h3 class="properties-section-title">Информация</h3>
      <div class="form-group">
        <label>Источник</label>
        <input type="text" class="form-control" value="${sourceNode.title}" disabled>
      </div>
      <div class="form-group">
        <label>Назначение</label>
        <input type="text" class="form-control" value="${targetNode.title}" disabled>
      </div>
    `;
    
    // Настройки переходов
    const transitionSection = document.createElement('div');
    transitionSection.className = 'properties-section';
    transitionSection.innerHTML = `
      <h3 class="properties-section-title">Настройки перехода</h3>
      <div class="form-group">
        <label for="transition-condition">Условие перехода</label>
        <select id="transition-condition" class="form-control">
          <option value="always" ${!connection.condition || connection.condition === 'always' ? 'selected' : ''}>Всегда</option>
          <option value="variable" ${connection.condition === 'variable' ? 'selected' : ''}>По переменной</option>
          <option value="custom" ${connection.condition === 'custom' ? 'selected' : ''}>Пользовательское условие</option>
        </select>
      </div>
      <div class="form-group" id="condition-variable-container" style="display: ${connection.condition === 'variable' ? 'block' : 'none'}">
        <label for="condition-variable">Переменная</label>
        <input type="text" id="condition-variable" class="form-control" value="${connection.conditionVariable || ''}">
      </div>
      <div class="form-group" id="condition-expression-container" style="display: ${connection.condition === 'custom' ? 'block' : 'none'}">
        <label for="condition-expression">Выражение</label>
        <textarea id="condition-expression" class="form-control" rows="3">${connection.conditionExpression || ''}</textarea>
      </div>
    `;
    
    // Добавляем секции в форму
    const propertiesContent = this.propertiesPanel.querySelector('.properties-panel-body');
    propertiesContent.innerHTML = '';
    propertiesContent.appendChild(preview);
    propertiesContent.appendChild(form);
    form.appendChild(infoSection);
    form.appendChild(transitionSection);
    
    // Добавляем обработчики
    const transitionCondition = form.querySelector('#transition-condition');
    const conditionVariableContainer = form.querySelector('#condition-variable-container');
    const conditionExpressionContainer = form.querySelector('#condition-expression-container');
    
    if (transitionCondition) {
      transitionCondition.addEventListener('change', () => {
        const condition = transitionCondition.value;
        
        // Обновляем видимость контейнеров
        conditionVariableContainer.style.display = condition === 'variable' ? 'block' : 'none';
        conditionExpressionContainer.style.display = condition === 'custom' ? 'block' : 'none';
        
        // Обновляем данные соединения
        const updatedConnection = { condition };
        this.model.updateConnection(connection.id, updatedConnection);
      });
    }
    
    const conditionVariable = form.querySelector('#condition-variable');
    if (conditionVariable) {
      conditionVariable.addEventListener('input', () => {
        this.model.updateConnection(connection.id, { conditionVariable: conditionVariable.value });
      });
    }
    
    const conditionExpression = form.querySelector('#condition-expression');
    if (conditionExpression) {
      conditionExpression.addEventListener('input', () => {
        this.model.updateConnection(connection.id, { conditionExpression: conditionExpression.value });
      });
    }
    
    // Обновляем кнопки на панели
    const deleteButton = this.propertiesPanel.querySelector('#delete-element');
    const duplicateButton = this.propertiesPanel.querySelector('#duplicate-element');
    
    if (deleteButton) {
      deleteButton.innerText = 'Удалить соединение';
      deleteButton.onclick = () => this.model.removeConnection(connection.id);
    }
    
    if (duplicateButton) {
      duplicateButton.style.display = 'none'; // Скрываем кнопку дублирования для соединений
    }
  }
}

/**
 * Инициализация приложения
 */
document.addEventListener('DOMContentLoaded', () => {
  // Создаем модель данных
  const model = new DiagramModel();
  
  // Создаем контроллер
  const controller = new DiagramController(model);
  
  // Создаем представление
  const view = new DiagramView(model, controller);
  
  // Устанавливаем представление в контроллер
  controller.setView(view);
  
  // Создаем менеджер подсказок
  const tooltipManager = new TooltipManager();
  
  // Загружаем сохраненные данные
  controller.loadProject();
  
  // Если нет данных, добавляем начальный узел
  if (model.nodes.length === 0) {
    model.addNode(CONSTANTS.NODE.TYPES.START, { x: 300, y: 150 });
  }
  
  // Рендерим диаграмму
  view.render();
});