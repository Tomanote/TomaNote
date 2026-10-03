import { describe, it, expect, beforeEach, vi } from "vitest";
import { CloseTabConfirmation } from "../close-tab-confirmation.js";

describe("CloseTabConfirmation", () => {
  let modal;
  let mockModal;
  let mockDeleteBtn;
  let mockCancelBtn;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeleteBtn = {
      addEventListener: vi.fn(),
    };
    mockCancelBtn = {
      addEventListener: vi.fn(),
    };

    mockModal = {
      querySelector: vi.fn((selector) => {
        if (selector === "[data-action='delete']") return mockDeleteBtn;
        if (selector === "[data-action='cancel']") return mockCancelBtn;
        return null;
      }),
      addEventListener: vi.fn(),
      showModal: vi.fn(),
      close: vi.fn(),
    };

    modal = new CloseTabConfirmation();
    modal.modal = mockModal;
  });

  describe("init", () => {
    it("should return `this` if the modal does not exist", async () => {
      modal.modal = null;
      const result = await modal.init();
      expect(result).toBe(modal);
    });
  });

  describe("open", () => {
    it("You must save pendingTabElement and call showModal", () => {
      const mockTabElement = { id: "tab-1" };
      const promise = modal.open(mockTabElement);

      expect(modal.pendingTabElement).toBe(mockTabElement);
      expect(mockModal.showModal).toHaveBeenCalled();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe("handleConfirm", () => {
    it("You must close the modal, clear pendingTabElement, and resolve true", async () => {
      const mockTabElement = { id: "tab-1" };
      modal.pendingTabElement = mockTabElement;

      const promise = modal.open(mockTabElement);
      modal.handleConfirm();

      expect(mockModal.close).toHaveBeenCalled();
      expect(modal.pendingTabElement).toBeNull();

      const result = await promise;
      expect(result).toEqual({ confirmed: true, tabElement: mockTabElement });
    });
  });

  describe("handleCancel", () => {
    it("You must close the modal, clear pendingTabElement, and resolve false", async () => {
      const mockTabElement = { id: "tab-1" };
      modal.pendingTabElement = mockTabElement;

      const promise = modal.open(mockTabElement);
      modal.handleCancel();

      expect(mockModal.close).toHaveBeenCalled();
      expect(modal.pendingTabElement).toBeNull();

      const result = await promise;
      expect(result).toEqual({ confirmed: false, tabElement: null });
    });
  });

  describe("setupEventListeners", () => {
    it("Registers a click listener on the delete button", () => {
      modal.setupEventListeners();

      expect(mockDeleteBtn.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });

    it("Registers a click listener on the cancel button", () => {
      modal.setupEventListeners();

      expect(mockCancelBtn.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });

    it("Registers a cancel event listener on the modal", () => {
      modal.setupEventListeners();

      expect(mockModal.addEventListener).toHaveBeenCalledWith("cancel", expect.any(Function));
    });

    it("The cancel event calls handleCancel and prevents default", () => {
      let cancelHandler;
      mockModal.addEventListener = vi.fn((event, handler) => {
        if (event === "cancel") cancelHandler = handler;
      });

      modal.setupEventListeners();

      const mockEvent = { preventDefault: vi.fn() };
      cancelHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockModal.close).toHaveBeenCalled();
    });
  });

  describe("init", () => {
    it("Calls setupEventListeners when the modal exists", async () => {
      document.getElementById = vi.fn().mockReturnValue(mockModal);
      const setupSpy = vi.spyOn(modal, "setupEventListeners");

      await modal.init();

      expect(setupSpy).toHaveBeenCalled();
    });

    it("Does not call setupEventListeners when the modal is missing", async () => {
      document.getElementById = vi.fn().mockReturnValue(null);
      modal.modal = null;
      const setupSpy = vi.spyOn(modal, "setupEventListeners");

      await modal.init();

      expect(setupSpy).not.toHaveBeenCalled();
    });
  });
});
