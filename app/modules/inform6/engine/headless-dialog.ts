/**
 * Minimal in-memory Dialog. Headless replay performs no real file I/O, so save /
 * restore / `script on` are not honored — the GlkOte answers any fileref prompt
 * with "cancelled", which games tolerate. Enough to satisfy `Glk.init`.
 */
export class HeadlessDialog {
  streaming = false
  // glkapi probes a handful of methods; these no-ops keep it happy. The spike
  // (Step 7) adds any further method glkapi calls (it throws with the name).
  init() {}
  open() {}
  file_clean_fixed_name(filename: string) {
    return filename
  }
  file_construct_ref() {
    return null
  }
  file_ref_exists() {
    return false
  }
  file_remove_ref() {}
  file_write() {}
  file_read() {
    return null
  }
}
