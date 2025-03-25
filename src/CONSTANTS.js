/**
 * Константы приложения
 */

export const CONSTANTS = {
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
