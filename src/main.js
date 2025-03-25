import { CONSTANTS } from './CONSTANTS';
import { DiagramController } from './DiagramController';
import { DiagramModel } from './DiagramModel';
import { DiagramView } from './DiagramView';
import { MinimapManager } from './MinimapManager';
import './style.css';
import { ToolbarManager } from './ToolbarManager';
import { TooltipManager } from './TooltipManager';

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

  // Создаем менеджер панели инструментов
  const toolbarManager = new ToolbarManager(model, controller, view);

  // Загружаем сохраненные данные
  controller.loadProject();

  // Если нет данных, добавляем начальный узел
  if (model.nodes.length === 0) {
    model.addNode(CONSTANTS.NODE.TYPES.START, { x: 300, y: 150 });
  }

  // Рендерим диаграмму
  view.render();


  // Инициализация мобильной кнопки меню
  const mobileMenuButton = document.getElementById('mobile-sidebar-toggle');
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.toggle('mobile-visible');
      }
    });
  }
  
  // Добавляем обработку изменения размера окна
  window.addEventListener('resize', () => {
    // Обновляем мини-карту и представление
    if (minimapManager) minimapManager.update();
    view.render();
  });
});