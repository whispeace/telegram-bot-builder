import { CONSTANTS } from './CONSTANTS';
import { DiagramController } from './DiagramController';
import './style.css';

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

    // Создаем классдля выделения
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
        // this.controller.startNodeDrag(e, nodeId);
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
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path>
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
      x: x - arrowSize * Math.cos(angle - Math.PI / 6),
      y: y - arrowSize * Math.sin(angle - Math.PI / 6)
    };

    const p2 = {
      x: x - arrowSize * Math.cos(angle + Math.PI / 6),
      y: y - arrowSize * Math.sin(angle + Math.PI / 6)
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
          `<div class="element-choice-option">${option}</div>`
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
          this.model.updateElement(node.id, newElementId, { ...element.data });
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
   * Добавление обработчиков к форме свойств узла
   * @param {HTMLElement} form - DOM-элемент формы
   * @param {Object} node - Данные узла
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
 * Класс для управления мини-картой, обеспечивающей обзор диаграммы
 */
class MinimapManager {
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
    this.isCollapsed = false;
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

  // Создаем менеджер мини-карты
  const minimapManager = new MinimapManager(model, controller);

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