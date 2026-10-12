import { act, fireEvent, render, screen } from "@testing-library/react";
import AdminSearch from "./AdminSearch";
const result = (label = "Campaigns") => ({ total: 1, results: [{ key: label, label, detail: "Campaign heading", snippet: "A saved introduction", target: { area: "Design", domain: "campaigns", id: "rumin", field: "pitch" } }], source: "draft", hash: "saved-hash" });
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const tick = () => act(async () => { jest.advanceTimersByTime(300); });

test("keyboard search focuses input; guarded selections keep results until departure is accepted", async () => {
  const request = jest.fn().mockResolvedValue(result()), onSelect = jest.fn();
  render(<AdminSearch request={request} onSelect={onSelect} />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.getByRole("searchbox")).toHaveFocus();
  await tick();
  fireEvent.click(screen.getByRole("button", { name: /Campaigns/ }));
  expect(onSelect.mock.calls[0][0]).toEqual(result().results[0].target);
  expect(screen.getByRole("searchbox")).toBeVisible();
  act(() => onSelect.mock.calls[0][1]());
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Search Admin/ }));
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
  expect(screen.getByRole("button", { name: /Search Admin/ })).toHaveFocus();
});

test("old requests cannot replace newer results; query and category are encoded", async () => {
  let old;
  const request = jest.fn().mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValue(result("New result"));
  render(<AdminSearch request={request} onSelect={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Search Admin/ }));
  await tick();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new & name" } });
  fireEvent.change(screen.getByLabelText("Search in"), { target: { value: "prose" } });
  await tick();
  expect(request.mock.calls.at(-1)[0]).toContain("q=new+%26+name&kind=prose");
  await act(async () => old(result("Old result")));
  expect(screen.getByRole("button", { name: /New result/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Old result/ })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Saved draft");
});

test("request failures are readable and never expose previous selectable results", async () => {
  render(<AdminSearch request={jest.fn().mockRejectedValue(new Error("Search unavailable"))} onSelect={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Search Admin/ }));
  await tick();
  expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable");
});
