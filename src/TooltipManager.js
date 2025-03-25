/**
 * Класс системы подсказок
 */
export class TooltipManager {
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
