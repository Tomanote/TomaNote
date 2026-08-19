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

  executeDeletion(tabElement) {
    const tabId = tabElement.querySelector("input").id;

    tabElement.remove();

    this.tabManager.tabsData = this.tabManager.tabsData.filter(
      (tab) => tab.id !== tabId
    );

    this.tabManager.updateTabIds();
    this.tabManager.saveTabs();

    document.dispatchEvent(new CustomEvent("tabsChanged"));
  }
}