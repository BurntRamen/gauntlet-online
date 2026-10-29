import { createBrowserStorage } from "./browserStorage";

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
  };
}

test("denied localStorage getter supports a private session without throwing", () => {
  const storage = createBrowserStorage(() => { throw new DOMException("Denied", "SecurityError"); });
  expect(storage.getItem("auth")).toBeNull();
  storage.setItem("auth", "account-a");
  storage.setItem("volume", 0);
  expect(storage.getItem("auth")).toBe("account-a");
  expect(storage.getItem("volume")).toBe("0");
  storage.removeItem("auth");
  expect(storage.getItem("auth")).toBeNull();
  expect(createBrowserStorage(() => { throw new Error("Denied"); }).getItem("auth")).toBeNull();
});

test("quota failures use new values rather than a previously saved account", () => {
  const backing = memoryStorage([["auth", "account-a"]]);
  const storage = createBrowserStorage(() => backing);
  const persist = backing.setItem.getMockImplementation();
  expect(storage.getItem("auth")).toBe("account-a");
  backing.setItem.mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  storage.setItem("auth", "account-b");
  expect(storage.getItem("auth")).toBe("account-b");
  expect(backing.getItem("auth")).toBe("account-a");
  backing.setItem.mockImplementation(persist);
  expect(storage.getItem("auth")).toBe("account-b");
  expect(backing.getItem("auth")).toBe("account-b");
});

test("failed signout never restores an old token, even after storage access returns", () => {
  const backing = memoryStorage([["auth", "account-a"]]);
  let denied = false;
  const storage = createBrowserStorage(() => { if (denied) throw new Error("Denied"); return backing; });
  expect(storage.getItem("auth")).toBe("account-a");
  denied = true;
  storage.removeItem("auth");
  expect(storage.getItem("auth")).toBeNull();
  denied = false;
  expect(storage.getItem("auth")).toBeNull();
  expect(backing.getItem("auth")).toBeNull();
  storage.setItem("auth", "account-b");
  expect(storage.getItem("auth")).toBe("account-b");
});

test("successful reads stay current with other tabs and tolerate later read failures", () => {
  const backing = memoryStorage([["auth", "account-a"]]);
  const storage = createBrowserStorage(() => backing);
  expect(storage.getItem("auth")).toBe("account-a");
  backing.setItem("auth", "account-b");
  expect(storage.getItem("auth")).toBe("account-b");
  backing.getItem.mockImplementationOnce(() => { throw new Error("Denied"); });
  expect(storage.getItem("auth")).toBe("account-b");
  backing.removeItem("auth");
  expect(storage.getItem("auth")).toBeNull();
});
