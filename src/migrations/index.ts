import * as migration_20261124_094915_initial from './20261124_094915_initial';
import * as migration_20261124_122358_phase2_catalog from './20261124_122358_phase2_catalog';

export const migrations = [
  {
    up: migration_20261124_094915_initial.up,
    down: migration_20261124_094915_initial.down,
    name: '20261124_094915_initial',
  },
  {
    up: migration_20261124_122358_phase2_catalog.up,
    down: migration_20261124_122358_phase2_catalog.down,
    name: '20261124_122358_phase2_catalog'
  },
];
