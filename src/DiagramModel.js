import { CONSTANTS } from './CONSTANTS';

/**
 * Модель данных приложения - реализует реактивную систему с публикацией событий
 */
export class DiagramModel {
  constructor() {
    // Данные диаграммы
    this.nodes = [];
    this.connections = [];
    this.nextId = 1;

    // Состояние выделения
    this.selectedNodeIds = new Set(); // Множество для хранения ID выделенных узлов
    this.selectedNodeId = null; // Сохраняем для обратной совместимости
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

    // Добавляем групповые свойства
    this.groupOperationsEnabled = true;
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
      selectedNodeIds: Array.from(this.selectedNodeIds),
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
    this.selectedNodeIds = new Set(state.selectedNodeIds);
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
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.selectedNodeId = nodeId;

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
    this.selectedNodeIds.clear();
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

  // Новый метод для работы с множественным выделением
  toggleNodeSelection(nodeId, exclusive = false) {
    // Если exclusive, снимаем текущее выделение
    if (exclusive) {
      this.selectedNodeIds.clear();
    }

    // Переключаем выделение узла
    if (this.selectedNodeIds.has(nodeId)) {
      this.selectedNodeIds.delete(nodeId);
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null;
      }
    } else {
      this.selectedNodeIds.add(nodeId);
      this.selectedNodeId = nodeId; // Последний выделенный становится активным для свойств
    }

    // Сбрасываем выделение элемента и соединения
    this.selectedElementId = null;
    this.selectedConnectionId = null;

    // Публикуем событие изменения выделения
    this.publish('onSelectionChanged', {
      type: 'nodes',
      nodeIds: Array.from(this.selectedNodeIds),
      primaryNodeId: this.selectedNodeId
    });

    this.recordHistory();
  }

  // Добавление метода для выделения узлов в заданной области
  selectNodesInArea(area, addToSelection = false) {
    // Если не добавляем к текущему выделению, очищаем его
    if (!addToSelection) {
      this.selectedNodeIds.clear();
    }

    // Проверяем каждый узел на попадание в область выделения
    this.nodes.forEach(node => {
      const nodeRight = node.position.x + CONSTANTS.NODE.DEFAULT_WIDTH;
      const nodeBottom = node.position.y + CONSTANTS.NODE.DEFAULT_HEIGHT;

      // Проверка пересечения с областью выделения
      if (
        node.position.x < area.endPos.x &&
        nodeRight > area.startPos.x &&
        node.position.y < area.endPos.y &&
        nodeBottom > area.startPos.y
      ) {
        this.selectedNodeIds.add(node.id);
        this.selectedNodeId = node.id; // Последний выделенный
      }
    });

    // Публикуем событие
    this.publish('onSelectionChanged', {
      type: 'nodes',
      nodeIds: Array.from(this.selectedNodeIds),
      primaryNodeId: this.selectedNodeId
    });

    this.recordHistory();
  }

  // Метод для получения всех выделенных узлов
  getSelectedNodes() {
    return this.nodes.filter(node => this.selectedNodeIds.has(node.id));
  }

  // Групповые операции
  // Перемещение группы узлов
  moveSelectedNodes(deltaX, deltaY) {
    const selectedNodes = this.getSelectedNodes();

    selectedNodes.forEach(node => {
      this.updateNode(node.id, {
        position: {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY
        }
      });
    });
  }

  // Удаление выделенных узлов
  removeSelectedNodes() {
    const nodesToRemove = Array.from(this.selectedNodeIds);

    nodesToRemove.forEach(nodeId => {
      this.removeNode(nodeId);
    });

    this.selectedNodeIds.clear();
    this.selectedNodeId = null;

    this.publish('onSelectionChanged', {
      type: 'nodes',
      nodeIds: [],
      primaryNodeId: null
    });

    this.recordHistory();
  }

  // Дублирование выделенных узлов
  duplicateSelectedNodes() {
    const selectedNodes = this.getSelectedNodes();
    const newNodeIds = new Set();

    // Сначала очищаем текущее выделение
    this.selectedNodeIds.clear();

    // Создаем копии всех выделенных узлов
    selectedNodes.forEach(node => {
      const newNodeId = this.duplicateNode(node.id);
      if (newNodeId) {
        newNodeIds.add(newNodeId);
        this.selectedNodeIds.add(newNodeId);
      }
    });

    // Устанавливаем последний созданный узел как текущий
    const newNodesArray = Array.from(newNodeIds);
    if (newNodesArray.length > 0) {
      this.selectedNodeId = newNodesArray[newNodesArray.length - 1];
    }

    this.publish('onSelectionChanged', {
      type: 'nodes',
      nodeIds: Array.from(this.selectedNodeIds),
      primaryNodeId: this.selectedNodeId
    });

    this.recordHistory();

    return newNodeIds;
  }
}
