import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlayerAvatar, ProfilePortraitEditor, prepareProfilePortrait, resolveProfileAvatarUrl } from "./ProfileAvatar";

test("resolves backend portrait paths without exposing storage details", () => {
  const subject = { profile: { avatar: { path: "/api/profiles/player-1/avatar?v=abc" } } };
  expect(resolveProfileAvatarUrl(subject, "https://game.example.com/")).toBe("https://game.example.com/api/profiles/player-1/avatar?v=abc");
});

test("renders a player initial until a portrait exists", () => {
  render(<PlayerAvatar subject={{ name: "Simply" }} name="Simply" serverUrl="https://game.example.com" />);
  expect(screen.getByRole("img", { name: "Simply portrait" })).toHaveTextContent("S");
});

test("renders the account portrait when one is available", () => {
  const subject = { name: "Simply", profile: { avatar: { path: "/api/profiles/player-1/avatar?v=abc" } } };
  const { container } = render(<PlayerAvatar subject={subject} serverUrl="https://game.example.com" />);
  expect(container.querySelector("img")).toHaveAttribute("src", "https://game.example.com/api/profiles/player-1/avatar?v=abc");
});

test("falls back to a smaller JPEG when browser WEBP output exceeds the server limit", async () => {
  const originalCreateImageBitmap = global.createImageBitmap;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  global.createImageBitmap = jest.fn().mockResolvedValue({ width: 900, height: 600, close: jest.fn() });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: "low" }));
  HTMLCanvasElement.prototype.toBlob = jest.fn((callback, type, quality) => {
    const size = type === "image/webp" ? 950 * 1024 : quality > 0.7 ? 420 * 1024 : 300 * 1024;
    callback(new Blob([new Uint8Array(size)], { type }));
  });

  try {
    const portrait = await prepareProfilePortrait(new File([new Uint8Array(2048)], "portrait.png", { type: "image/png" }));
    expect(portrait.type).toBe("image/jpeg");
    expect(portrait.size).toBeLessThan(900 * 1024);
  } finally {
    global.createImageBitmap = originalCreateImageBitmap;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }
});

test("uploads a portrait through a directly accessible file control", async () => {
  const originalCreateImageBitmap = global.createImageBitmap;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalFetch = global.fetch;
  const updated = { id: "player-1", profile: { avatar: { revision: "abc" } } };
  const onAccountUpdated = jest.fn();
  global.createImageBitmap = jest.fn().mockResolvedValue({ width: 640, height: 640, close: jest.fn() });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: "low" }));
  HTMLCanvasElement.prototype.toBlob = jest.fn((callback, type) => callback(new Blob([new Uint8Array(512)], { type })));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ account: updated }) });

  try {
    render(<ProfilePortraitEditor account={{ id: "player-1" }} authToken="token-1" serverUrl="https://game.example.com/" onAccountUpdated={onAccountUpdated} />);
    const fileInput = screen.getByLabelText("Upload profile portrait");
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array(256)], "portrait.png", { type: "image/png" })] } });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("https://game.example.com/api/account/avatar");
    expect(request.method).toBe("PUT");
    expect(request.headers.Authorization).toBe("Bearer token-1");
    expect(request.body).toBeInstanceOf(Blob);
    await waitFor(() => expect(onAccountUpdated).toHaveBeenCalledWith(updated));
    expect(screen.getByRole("status")).toHaveTextContent("Portrait live");
  } finally {
    global.createImageBitmap = originalCreateImageBitmap;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    global.fetch = originalFetch;
  }
});
