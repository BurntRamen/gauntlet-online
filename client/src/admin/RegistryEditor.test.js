import { act, renderHook } from "@testing-library/react";
import { EditorSessionContext } from "./EditorSession";
import { useRegistryEditor } from "./RegistryEditor";

const first = { id: "first", name: "First", status: "draft" };
const copy = value => JSON.parse(JSON.stringify(value));
const stateWith = rows => ({ live: { registry: { records: rows } } });
const settings = () => ({ state: stateWith([first]), registry: "registry", domain: "records", action: "draft", scope: { domain: "records" }, label: "Record", onDirty: jest.fn(), act: jest.fn(), copy });

test("server-created records select the acknowledged identity; failed saves retain the local buffer", async () => {
  const props = settings(), created = { ...first, id: "server-id", name: "Created" };
  props.act.mockResolvedValueOnce(stateWith([first, created])).mockResolvedValueOnce(false);
  const hook = renderHook(() => useRegistryEditor(props));
  await act(async () => { await hook.result.current.mutate({ operation: "create" }); });
  expect(hook.result.current.editing).toEqual(created);
  act(() => hook.result.current.update("name", "Keep this change"));
  await act(async () => { expect(await hook.result.current.save()).toBe(false); });
  expect(hook.result.current.editing.name).toBe("Keep this change");
  expect(props.act).toHaveBeenLastCalledWith("draft", { domain: "records", operation: "update", id: "server-id", value: { ...created, name: "Keep this change" } });
});

test("client-created records resolve their supplied ID even when they are not last in the response", async () => {
  const props = { ...settings(), localBaseline: true, serverIds: false };
  const created = { ...first, id: "local-id", name: "Local" };
  props.act.mockResolvedValue(stateWith([created, first]));
  const hook = renderHook(() => useRegistryEditor(props));
  act(() => hook.result.current.select(created, true));
  expect(hook.result.current.dirty).toBe(true);
  await act(async () => { expect(await hook.result.current.save()).toBe(true); });
  expect(props.act).toHaveBeenCalledWith("draft", { domain: "records", operation: "create", id: "local-id", value: created });
  expect(hook.result.current.original).toEqual(created);
  expect(hook.result.current.dirty).toBe(false);
});

test.each([false, true])("external changes preserve the registry baseline mode (%s)", localBaseline => {
  const props = { ...settings(), initialId: first.id, localBaseline };
  const hook = renderHook(({ state }) => useRegistryEditor({ ...props, state }), { initialProps: { state: props.state } });
  const remote = { ...first, name: "Changed remotely" };
  hook.rerender({ state: stateWith([remote]) });
  expect(hook.result.current.editing).toEqual(first);
  expect(hook.result.current.saved).toEqual(remote);
  expect(hook.result.current.dirty).toBe(!localBaseline);
});

test.each([false, true])("registered discard restores or closes according to the registry (%s)", localBaseline => {
  const props = { ...settings(), initialId: first.id, localBaseline }, register = jest.fn();
  const wrapper = ({ children }) => <EditorSessionContext.Provider value={{ register, requestLeave: action => action() }}>{children}</EditorSessionContext.Provider>;
  const hook = renderHook(() => useRegistryEditor(props), { wrapper });
  act(() => hook.result.current.update("name", "Unsaved"));
  const session = register.mock.calls.at(-1)[0];
  expect(session.local.name).toBe("Unsaved");
  expect(session.saved).toEqual(first);
  act(() => session.discard());
  expect(hook.result.current.editing).toEqual(localBaseline ? undefined : first);
  expect(hook.result.current.dirty).toBe(false);
});

test("an already-open deep link does not overwrite edits when shared state refreshes", () => {
  const props = { ...settings(), initialTarget: { domain: "records", id: first.id }, onTarget: jest.fn(), fieldId: () => "missing-field" };
  const hook = renderHook(({ state }) => useRegistryEditor({ ...props, state }), { initialProps: { state: props.state } });
  act(() => hook.result.current.update("name", "Unsaved"));
  hook.rerender({ state: stateWith([{ ...first, name: "Remote" }]) });
  expect(hook.result.current.editing.name).toBe("Unsaved");
  expect(props.onTarget).toHaveBeenCalledTimes(1);
});

test.each([undefined, { records: [first], events: [] }])("a pipeline can open a category on a legacy or empty snapshot without mutating a record (%j)", registry => {
  const props = { ...settings(), state: { live: { registry } }, initialTarget: { domain: "events", id: null }, onTarget: jest.fn(), fieldId: () => "missing" };
  const hook = renderHook(() => useRegistryEditor(props));
  expect(props.onTarget).toHaveBeenCalledWith(props.initialTarget);
  expect(hook.result.current.editing).toBeUndefined();
  expect(props.act).not.toHaveBeenCalled();
});
