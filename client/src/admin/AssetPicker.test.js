import { fireEvent, render, screen, within } from "@testing-library/react";
import AssetPicker from "./AssetPicker";

const library = [...Array.from({ length: 27 }, (_, index) => ({ id: `image-${index}`, source: `/art/picture-${index}.webp`, path: `/immutable/${index}.webp`, mediaType: "image/webp", sha256: `digest-${index}` })), { id: "voice", source: "/voice/greeting.ogg", path: "/immutable/audio.ogg", mediaType: "audio/ogg" }];

test("pages and filters images, resolves current aliases, and only commits explicit selection", () => {
  const select = jest.fn(), close = jest.fn();
  render(<AssetPicker library={library} value="/art/picture-0.webp" media="image" onSelect={select} onClose={close} />);
  const results = within(screen.getByRole("region", { name: "Asset results" }));
  expect(results.getAllByRole("button", { pressed: false })).toHaveLength(23);
  expect(screen.queryByText("greeting.ogg")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Search assets")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Next assets" }));
  fireEvent.click(results.getByRole("button", { name: "picture-25.webp" }));
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use selected artwork" }));
  expect(select).toHaveBeenCalledWith("image-25");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
});

test("audio requires explicit playback and cancel preserves the field with focus restoration", () => {
  const trigger = document.createElement("button"); document.body.appendChild(trigger); trigger.focus();
  const select = jest.fn(), close = jest.fn();
  const { unmount } = render(<AssetPicker library={library} value="voice" media="audio" onSelect={select} onClose={close} />);
  const audio = screen.getByLabelText("Listen to greeting.ogg");
  expect(audio).toHaveAttribute("preload", "none");
  expect(audio).not.toHaveAttribute("autoplay");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(select).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
  unmount(); expect(trigger).toHaveFocus(); trigger.remove();
});

test("restores the supplied field trigger after a lazy mount has lost the active element", () => {
  render(<button>Browse artwork field</button>);
  const trigger = screen.getByRole("button", { name: "Browse artwork field" });
  const { unmount } = render(<AssetPicker library={library} value="image-0" onClose={jest.fn()} onSelect={jest.fn()} returnFocus={trigger} />);
  expect(screen.getByLabelText("Search assets")).toHaveFocus();
  unmount();
  expect(trigger).toHaveFocus();
});
