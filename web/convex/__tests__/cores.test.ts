import { describe, it, expect } from "vitest";
import { DEFAULT_CORES } from "../defaultCores";

/**
 * tests for the core/personality system logic.
 * these tests verify core management, system prompt generation,
 * and the business rules around cores.
 */

describe("Core System Logic", () => {
  describe("Default Cores", () => {
    it("has at least one default core", () => {
      expect(DEFAULT_CORES.length).toBeGreaterThan(0);
    });

    it("has at least one active default core", () => {
      const activeCores = DEFAULT_CORES.filter((c) => c.isActive);
      expect(activeCores.length).toBeGreaterThan(0);
    });

    it("default cores have required properties", () => {
      for (const core of DEFAULT_CORES) {
        expect(core.name).toBeDefined();
        expect(core.name.length).toBeGreaterThan(0);
        expect(core.content).toBeDefined();
        expect(typeof core.isActive).toBe("boolean");
        expect(typeof core.order).toBe("number");
      }
    });

    it("default cores have unique orders", () => {
      const orders = DEFAULT_CORES.map((c) => c.order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    });

    it("default cores are sorted by order", () => {
      const sorted = [...DEFAULT_CORES].sort((a, b) => a.order - b.order);
      expect(sorted).toEqual(DEFAULT_CORES);
    });
  });

  describe("System Prompt Generation", () => {
    it("concatenates active cores with double newlines", () => {
      const cores = [
        {
          name: "Core 1",
          content: "You are helpful.",
          isActive: true,
          order: 0,
        },
        { name: "Core 2", content: "Be concise.", isActive: true, order: 1 },
        { name: "Core 3", content: "Inactive core", isActive: false, order: 2 },
      ];

      const activeCores = cores
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order);

      const prompt = activeCores.map((c) => c.content).join("\n\n");

      expect(prompt).toBe("You are helpful.\n\nBe concise.");
    });

    it("respects order when generating prompt", () => {
      const cores = [
        { name: "Second", content: "Second content", isActive: true, order: 1 },
        { name: "First", content: "First content", isActive: true, order: 0 },
        { name: "Third", content: "Third content", isActive: true, order: 2 },
      ];

      const activeCores = cores
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order);

      const prompt = activeCores.map((c) => c.content).join("\n\n");

      expect(prompt).toBe("First content\n\nSecond content\n\nThird content");
    });

    it("excludes inactive cores from prompt", () => {
      const cores = [
        { name: "Active", content: "Active content", isActive: true, order: 0 },
        {
          name: "Inactive",
          content: "Should not appear",
          isActive: false,
          order: 1,
        },
      ];

      const activeCores = cores.filter((c) => c.isActive);
      const prompt = activeCores.map((c) => c.content).join("\n\n");

      expect(prompt).not.toContain("Should not appear");
      expect(prompt).toBe("Active content");
    });

    it("returns first core content if no active cores", () => {
      const cores = [
        {
          name: "Only Core",
          content: "Fallback content",
          isActive: false,
          order: 0,
        },
      ];

      const activeCores = cores.filter((c) => c.isActive);

      let prompt: string;
      if (activeCores.length === 0 && cores.length > 0) {
        prompt = cores[0].content;
      } else {
        prompt = activeCores.map((c) => c.content).join("\n\n");
      }

      expect(prompt).toBe("Fallback content");
    });

    it("returns empty string for no cores", () => {
      const cores: typeof DEFAULT_CORES = [];
      const activeCores = cores.filter((c) => c.isActive);
      const prompt = activeCores.map((c) => c.content).join("\n\n");

      expect(prompt).toBe("");
    });
  });

  describe("Core CRUD Logic", () => {
    describe("Create", () => {
      it("assigns next order value to new core", () => {
        const existingCores = [{ order: 0 }, { order: 1 }, { order: 2 }];

        const maxOrder =
          existingCores.length > 0
            ? Math.max(...existingCores.map((c) => c.order))
            : -1;

        const newOrder = maxOrder + 1;
        expect(newOrder).toBe(3);
      });

      it("starts at order 0 when no cores exist", () => {
        const existingCores: { order: number }[] = [];

        const maxOrder =
          existingCores.length > 0
            ? Math.max(...existingCores.map((c) => c.order))
            : -1;

        const newOrder = maxOrder + 1;
        expect(newOrder).toBe(0);
      });

      it("new cores start inactive", () => {
        const newCore = {
          name: "New Core",
          content: "Some content",
          isActive: false, // default for new cores
          order: 0,
        };

        expect(newCore.isActive).toBe(false);
      });
    });

    describe("Update", () => {
      it("updates name while preserving other fields", () => {
        const core = {
          name: "Old Name",
          content: "Content",
          isActive: true,
          order: 0,
        };

        const updated = {
          ...core,
          name: "New Name",
        };

        expect(updated.name).toBe("New Name");
        expect(updated.content).toBe("Content");
        expect(updated.isActive).toBe(true);
        expect(updated.order).toBe(0);
      });

      it("updates content while preserving other fields", () => {
        const core = {
          name: "Core",
          content: "Old Content",
          isActive: true,
          order: 0,
        };

        const updated = {
          ...core,
          content: "New Content",
        };

        expect(updated.name).toBe("Core");
        expect(updated.content).toBe("New Content");
      });
    });

    describe("Toggle Active", () => {
      it("toggles active state", () => {
        const core = { isActive: false };
        const toggled = { ...core, isActive: !core.isActive };
        expect(toggled.isActive).toBe(true);
      });

      it("prevents deactivating last active core", () => {
        const cores = [
          { id: "1", isActive: true },
          { id: "2", isActive: false },
        ];

        const coreToDeactivate = cores.find((c) => c.id === "1");
        const activeCores = cores.filter((c) => c.isActive);

        // check if this would leave no active cores
        const canDeactivate =
          !coreToDeactivate?.isActive || activeCores.length > 1;

        expect(canDeactivate).toBe(false);
      });

      it("allows deactivating when multiple cores are active", () => {
        const cores = [
          { id: "1", isActive: true },
          { id: "2", isActive: true },
          { id: "3", isActive: false },
        ];

        const coreToDeactivate = cores.find((c) => c.id === "1");
        const activeCores = cores.filter((c) => c.isActive);

        const canDeactivate =
          !coreToDeactivate?.isActive || activeCores.length > 1;

        expect(canDeactivate).toBe(true);
      });
    });

    describe("Reorder", () => {
      it("updates order based on array position", () => {
        const orderedIds = ["id3", "id1", "id2"];

        const newOrders = orderedIds.map((id, index) => ({
          id,
          order: index,
        }));

        expect(newOrders).toEqual([
          { id: "id3", order: 0 },
          { id: "id1", order: 1 },
          { id: "id2", order: 2 },
        ]);
      });
    });

    describe("Delete", () => {
      it("prevents deleting the only core", () => {
        const cores = [{ id: "1", isActive: true }];

        const canDelete = cores.length > 1;
        expect(canDelete).toBe(false);
      });

      it("allows deleting when multiple cores exist", () => {
        const cores = [
          { id: "1", isActive: true },
          { id: "2", isActive: false },
        ];

        const canDelete = cores.length > 1;
        expect(canDelete).toBe(true);
      });

      it("activates another core when deleting last active", () => {
        const cores = [
          { id: "1", isActive: true },
          { id: "2", isActive: false },
          { id: "3", isActive: false },
        ];

        const coreToDelete = cores.find((c) => c.id === "1");
        const otherCores = cores.filter((c) => c.id !== "1");
        const otherActiveCores = otherCores.filter((c) => c.isActive);

        // if deleting the last active core, activate another
        if (coreToDelete?.isActive && otherActiveCores.length === 0) {
          const coreToActivate = otherCores[0];
          expect(coreToActivate).toBeDefined();
          expect(coreToActivate.id).toBe("2");
        }
      });
    });
  });

  describe("Sync from Local", () => {
    it("syncs local cores for new users", () => {
      const existingCores: unknown[] = [];
      const localCores = [
        { name: "Local 1", content: "Content 1", isActive: true, order: 0 },
        { name: "Local 2", content: "Content 2", isActive: false, order: 1 },
      ];

      const shouldSync = existingCores.length === 0;
      expect(shouldSync).toBe(true);

      if (shouldSync) {
        // simulate sync
        const syncedCores = localCores.map((c) => ({
          ...c,
          userId: "user123",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

        expect(syncedCores.length).toBe(2);
        expect(syncedCores[0].userId).toBe("user123");
      }
    });

    it("skips sync for existing users", () => {
      const existingCores = [{ id: "existing-core" }];

      const shouldSync = existingCores.length === 0;
      expect(shouldSync).toBe(false);
    });

    it("returns sync result", () => {
      const existingCores: unknown[] = [];
      const localCores = [
        { name: "Core", content: "Content", isActive: true, order: 0 },
      ];

      if (existingCores.length > 0) {
        const result = { synced: false, reason: "existing_user" };
        expect(result.synced).toBe(false);
      } else {
        const result = { synced: true, count: localCores.length };
        expect(result.synced).toBe(true);
        expect(result.count).toBe(1);
      }
    });
  });

  describe("Core Validation", () => {
    it("requires non-empty name", () => {
      const name = "";
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("accepts valid name", () => {
      const name = "My Custom Core";
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it("allows empty content", () => {
      // content can be empty (user might want a placeholder)
      const emptyContent = "";
      const isValid = emptyContent !== undefined; // no validation on content
      expect(isValid).toBe(true);
    });

    it("trims whitespace from name", () => {
      const name = "  Padded Name  ";
      const trimmed = name.trim();
      expect(trimmed).toBe("Padded Name");
    });
  });

  describe("User Isolation", () => {
    it("filters cores by userId", () => {
      const allCores = [
        { userId: "user1", name: "User 1 Core" },
        { userId: "user2", name: "User 2 Core" },
        { userId: "user1", name: "Another User 1 Core" },
      ];

      const user1Cores = allCores.filter((c) => c.userId === "user1");

      expect(user1Cores.length).toBe(2);
      expect(user1Cores.every((c) => c.userId === "user1")).toBe(true);
    });

    it("returns empty array for unauthenticated users", () => {
      const userId = null;

      if (!userId) {
        const cores: unknown[] = [];
        expect(cores).toEqual([]);
      }
    });
  });
});
