import { Reorder, useDragControls, AnimatePresence } from "framer-motion";
import { KanbanCard } from "./KanbanCard.jsx";

/*
  KanbanColumn — one draggable-to-reorder column. Dragging starts from the
  header (title/count row), not the whole column, so clicking a card or the
  quick-add button never gets mistaken for a reorder gesture.
*/
export function KanbanColumn({ col, tasks, onOpen, onAddCard }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="section"
      value={col.key}
      dragListener={false}
      dragControls={controls}
      className="kanban-column"
      data-column={col.key}
      whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: "0 16px 44px rgba(0, 0, 0, 0.5)" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      <div
        className="kanban-column-head"
        onPointerDown={(e) => controls.start(e)}
        title="Drag from the title to reorder columns"
      >
        <span className="panel-section-title">{col.label}</span>
        <span className="kanban-column-count mono">{tasks.length}</span>
      </div>
      <div className="kanban-column-body">
        {tasks.length === 0 && !col.creatable && <span className="panel-empty">Nothing here.</span>}
        <AnimatePresence mode="popLayout">
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} onOpen={onOpen} />
          ))}
        </AnimatePresence>
        {col.creatable && (
          <button
            type="button"
            className="kanban-column-panel kanban-column-panel--button"
            onClick={() => onAddCard(col)}
            aria-label={`Add card to ${col.label}`}
            title={`Add card to ${col.label}`}
          >
            +
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}
