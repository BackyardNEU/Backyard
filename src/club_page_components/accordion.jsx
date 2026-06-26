import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import "./ModuleAccordion.css";

const initialModules = [
  {
    id: "links",
    title: "Links Module",
    content: "This is where the links module will display",
    included: true,
  },
  {
    id: "faq",
    title: "FAQ Module",
    content: "This is where the FAQ module will display",
    included: true,
  },
  {
    id: "members",
    title: "Featured Members Module",
    content: "This is where the featured members module will display",
    included: true,
  },
];

export default function ModuleAccordion() {
  const [modules, setModules] = useState(initialModules);
  const [openIds, setOpenIds] = useState(["links"]);

  const toggleOpen = (id) => {
    setOpenIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleIncluded = (id) => {
    setModules((prev) =>
      prev.map((module) =>
        module.id === id
          ? {
              ...module,
              included: !module.included,
            }
          : module
      )
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setModules((items) => {
      const oldIndex = items.findIndex(
        (item) => item.id === active.id
      );

      const newIndex = items.findIndex(
        (item) => item.id === over.id
      );

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  return (
    <div className="accordion">

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {modules.map((module) => (
            <SortableModule
              key={module.id}
              module={module}
              isOpen={openIds.includes(module.id)}
              onToggleOpen={() =>
                toggleOpen(module.id)
              }
              onToggleIncluded={() =>
                toggleIncluded(module.id)
              }
            />
          ))}
        </SortableContext>
      </DndContext>

    </div>
  );
}

function SortableModule({
  module,
  isOpen,
  onToggleOpen,
  onToggleIncluded,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(
      transform
    ),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item ${
        isOpen ? "active" : ""
      } ${isDragging ? "dragging" : ""}`}
    >
      <button
        className="header"
        onClick={onToggleOpen}
      >
        <div className="controls">

          <div
            className="drag-control"
            {...attributes}
            {...listeners}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <span className="drag-handle">
              ⋮⋮
            </span>
          </div>

          <div
            className="include-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleIncluded();
            }}
          >
            <span
              className={`pill ${
                module.included
                  ? "included"
                  : "excluded"
              }`}
            >
              {module.included
                ? "Included"
                : "Not Included"}
            </span>
          </div>

        </div>

        <span className="question">
          {module.title}
        </span>

        <span className="icon">
          +
        </span>
      </button>

      <div className="content">
        <p>{module.content}</p>
      </div>
    </div>
  );
}