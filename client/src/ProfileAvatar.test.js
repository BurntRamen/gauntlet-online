import { render, screen } from "@testing-library/react";
import { PlayerAvatar, resolveProfileAvatarUrl } from "./ProfileAvatar";

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
