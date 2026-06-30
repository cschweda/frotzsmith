import { migrateStorageKeys } from '~/composables/useStorageMigration'

/**
 * Run once on every client boot — BEFORE any component mounts — to move
 * legacy un-prefixed `frotzsmith:<key>` entries to the per-language namespace
 * `frotzsmith:i6:<key>`.
 *
 * The target is always 'i6': the old un-prefixed keys were written by the
 * pre-Task-4 IDE which only supported Inform 6, so they belong to the i6
 * namespace regardless of which language the user later activates.
 *
 * Named `00.` so Nuxt registers it first among all client plugins, guaranteeing
 * migration completes before useIde / TestScriptPanel / useTestScripts read keys.
 *
 * migrateStorageKeys is idempotent — if the new key already exists (or the old
 * key is absent) it skips silently, so subsequent boots are no-ops.
 */
export default defineNuxtPlugin(() => {
  migrateStorageKeys('i6')
})
