# Asistencia App - SDD Task Plan

## Goal
Implement a robust routine for version control, improve multi-tenant UX (Admin school switching), compact the UI for the student list, and clean up the evaluations module screen space.

## Phases

### Phase 1: Automated Versioning Routine
- **Goal:** Provide an automated agent/script to handle versioning bumps easily.
- **Files:** `scripts/bump_version.sh` (new)
- **Status:** COMPLETE

### Phase 2: Multi-Tenant Onboarding & Admin Switching
- **Goal:** Admins should have a clear way to see their current school, switch schools, or request roles at new schools, even if they only have 1 active school.
- **Files:** `js/ui.js`
- **Status:** COMPLETE

### Phase 3: Compact Student Chips
- **Goal:** The "Situación" chips in `estudiantes.js` are too large. Make them compact (`text-[10px]`, small padding) so more students fit on screen.
- **Files:** `js/estudiantes.js`
- **Status:** COMPLETE

### Phase 4: Evaluations Admin Settings Cleanup
- **Goal:** The configuration panel for periods/columns in `evaluaciones.js` takes up too much space. Wrap it in a collapsible `<details>` tag or similar, only visible for Admin/SuperAdmin, defaulting to collapsed.
- **Files:** `js/evaluaciones.js`
- **Status:** COMPLETE

## Current Progress
- Just initialized task plan based on user spec.
