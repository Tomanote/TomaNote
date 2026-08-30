export class TabDeletionHandler {
  constructor(tabManager) {
    this.tabManager = tabManager;
  }

  async deleteTabElement(tabElement) {
    if (!tabElement) return;

    const confirmationModal = window.closeTabConfirmationModal;

    if (confirmationModal) {
      const { confirmed } = await confirmationModal.open(tabElement);
      if (!confirmed) return;
    } else {
      if (
        !confirm(
          window.i18n?.t("tab.delete-confirm") ?? "Delete this tab?"
        )
      ) {
        return;
      }
    }

    this.executeDeletion(tabElement);
  }

  async executeDeletion(tabElement) {
    const tabId = tabElement.querySelector("input").id;

    // 1. Destroy the Milkdown editor for this tab (prevents orphaned editors)
    if (window.milkdownEditor?.hasEditor(tabId)) {
      await window.milkdownEditor.destroyEditor(tabId);
    }

    // 2. Remove from DOM
    tabElement.remove();

    // 3. Remove from in-memory data
    this.tabManager.tabsData = this.tabManager.tabsData.filter(
      (tab) => tab.id !== tabId
    );

    // 4. Clean up orphaned editors (editors for tabs that no longer exist in DOM)
    if (window.milkdownEditor) {
      for (const [editorTabId] of window.milkdownEditor.editors) {
        const el = document.getElementById(editorTabId);
        if (!el) {
          await window.milkdownEditor.destroyEditor(editorTabId);
        }
      }
    }

    // 5. Reassign IDs and persist
    this.tabManager.updateTabIds();
    this.tabManager.saveTabs();

    document.dispatchEvent(new CustomEvent("tabsChanged"));
  }
}