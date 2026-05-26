// Shared mutable state for gizmo dragging detection
// Used by Controls.tsx to disable camera movement during gizmo interaction
export const gizmoState = { isDragging: false, precisionMode: false, snapEdges: false, hotspotLocked: true, orthoZoom: 1, showOutlines: true, pivotAtBase: true };
