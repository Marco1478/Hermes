import { Reorder, useDragControls, AnimatePresence } from "framer-motion";
import { KanbanCard } from "./KanbanCard.jsx";

/*
  KanbanColumn — one draggable-to-reorder column. The drag handle is a
  small dedicated grip (not the whole column) so clicking a card or the
  add-card button never gets mistaken for a reorder gesture.
*/
export function KanbanColumn({ col, tasks, onOpen, onAddCard }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={col.key}
      dragListener={false}
      dragControls={controls}
      className="kanban-column"
      data-column={col.key}
      whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: "0 16px 44px rgba(0, 0, 0, 0.5)" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      <div className="kanban-column-head">
        <button
          type="button"
          className="kanban-column-drag"
          onPointerDown={(e) => controls.start(e)}
          title="Drag to reorder columns"
          aria-label={`Reorder ${col.label} column`}
        >
          ⠿
        </button>
        <span className="kanban-column-label">
          {col.dot && <span className={`led-dot led-dot--${col.dot}${col.key === "in_progress" ? " led-dot--pulse" : ""}`} />}
          {col.label}
        </span>
        <span className="kanban-column-count mono">{tasks.length}</span>
      </div>
      <div className="kanban-column-body">
        {tasks.length === 0 && !col.creatable && (
          <div className="kanban-column-panel">
            <span className="panel-empty">Nothing here.</span>
          </div>
        )}
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
