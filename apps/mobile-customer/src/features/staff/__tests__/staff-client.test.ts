import { StaffClientError, inviteStaff, listStaff, removeStaff } from "../services/staff-client";

describe("staff-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe("listStaff", () => {
    test("returns the staff array on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ staff: [{ id: "su_1", email: "a@b.com", role: "owner", activated: true }] })),
      });
      const result = await listStaff("token");
      expect(result).toEqual([{ id: "su_1", email: "a@b.com", role: "owner", activated: true }]);
    });

    test("throws StaffClientError on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: () => Promise.resolve("{}") });
      await expect(listStaff("token")).rejects.toThrow(StaffClientError);
    });
  });

  describe("inviteStaff", () => {
    test("posts email and role", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ staff: { id: "su_2", email: "new@b.com", role: "analyst", activated: false } })),
      });
      const result = await inviteStaff("token", "new@b.com", "analyst");
      expect(result.activated).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/seller/staff"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "new@b.com", role: "analyst" }),
        })
      );
    });

    test("throws with the server message when the email is already invited", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "This email is already part of your team" })),
      });
      await expect(inviteStaff("token", "dup@b.com", "analyst")).rejects.toThrow(
        "This email is already part of your team"
      );
    });
  });

  describe("removeStaff", () => {
    test("DELETEs the staff member by id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") });
      await removeStaff("token", "su_2");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/seller/staff/su_2"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    test("throws when trying to remove the owner", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "The seller owner cannot be removed" })),
      });
      await expect(removeStaff("token", "su_owner")).rejects.toThrow("The seller owner cannot be removed");
    });
  });
});
