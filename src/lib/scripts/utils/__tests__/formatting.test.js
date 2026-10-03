import { describe, it, expect, beforeEach, vi } from "vitest";
import { FormattingUtils } from "../formatting.js";

// Mock of DOM
const mockElement = {
  classList: {
    contains: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
  parentElement: null,
  hasAttribute: vi.fn(),
  nodeType: Node.ELEMENT_NODE,
  appendChild: vi.fn(),
  firstChild: null,
  parentNode: {
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
  },
};

const mockTextNode = {
  nodeType: Node.TEXT_NODE,
  parentElement: mockElement,
};

const mockRange = {
  commonAncestorContainer: mockTextNode,
  collapsed: false,
  surroundContents: vi.fn(),
  extractContents: vi.fn(),
  insertNode: vi.fn(),
  toString: vi.fn().mockReturnValue("selected text"),
};

const mockSelection = {
  rangeCount: 1,
  isCollapsed: false,
  getRangeAt: vi.fn().mockReturnValue(mockRange),
};

// Mock window.getSelection
Object.defineProperty(window, "getSelection", {
  writable: true,
  value: vi.fn().mockReturnValue(mockSelection),
});

// Mock document.createElement
Object.defineProperty(document, "createElement", {
  writable: true,
  value: vi.fn().mockReturnValue(mockElement),
});

describe("FormattingUtils - Ciclo de Negrita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelection.rangeCount = 1;
    mockSelection.isCollapsed = false;
    mockRange.collapsed = false;
  });

  it("Do nothing if there is no selection", () => {
    mockSelection.rangeCount = 0;
    FormattingUtils.cycleBold();
    expect(window.getSelection).toHaveBeenCalled();
    // You shouldn't create elements
    expect(document.createElement).not.toHaveBeenCalled();
  });

  it("Do nothing if the selection is collapsed", () => {
    mockSelection.isCollapsed = true;
    FormattingUtils.cycleBold();
    expect(document.createElement).not.toHaveBeenCalled();
  });

  it("Applies semibold to a new selection", () => {
    mockElement.classList.contains.mockReturnValue(false);
    mockRange.surroundContents.mockImplementation(() => {});

    FormattingUtils.cycleBold();

    expect(document.createElement).toHaveBeenCalledWith("span");
    expect(mockElement.className).toBe("bold-semibold");
    expect(mockRange.surroundContents).toHaveBeenCalledWith(mockElement);
  });

  it("Cycles from semibold to extrabold", () => {
    const boldElement = {
      ...mockElement,
      classList: {
        ...mockElement.classList,
        contains: vi.fn().mockReturnValue(true),
      },
    };
    mockTextNode.parentElement = boldElement;
    mockRange.commonAncestorContainer = mockTextNode;

    FormattingUtils.findBoldWrapper = vi.fn().mockReturnValue(boldElement);

    FormattingUtils.cycleBold();

    expect(boldElement.classList.remove).toHaveBeenCalledWith("bold-semibold");
    expect(boldElement.classList.add).toHaveBeenCalledWith("bold-extrabold");
  });

  it("Cycles from extrabold to normal (removes the wrapper)", () => {
    const boldElement = {
      ...mockElement,
      classList: {
        contains: vi.fn((cls) => cls === "bold-extrabold"),
        remove: vi.fn(),
      },
      firstChild: null,
      parentNode: { insertBefore: vi.fn(), removeChild: vi.fn() },
    };
    mockTextNode.parentElement = boldElement;

    FormattingUtils.findBoldWrapper = vi.fn().mockReturnValue(boldElement);

    FormattingUtils.cycleBold();

    expect(boldElement.classList.remove).toHaveBeenCalledWith("bold-extrabold");
    // Should unwrap
  });

  it("Handles surroundContents failing with extractContents+insertNode", () => {
    const testRange = {
      commonAncestorContainer: mockTextNode,
      surroundContents: vi.fn(() => {
        throw new Error("Failed to execute 'surroundContents'");
      }),
      extractContents: vi.fn(),
      insertNode: vi.fn(),
    };

    FormattingUtils.applyNewBold(testRange);

    expect(testRange.extractContents).toHaveBeenCalled();
    expect(testRange.insertNode).toHaveBeenCalled();
  });
});
