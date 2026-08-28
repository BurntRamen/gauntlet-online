import { act, render, screen } from "@testing-library/react";
import MenuBackdrop from "./MenuBackdrop";

const BACKGROUNDS = {
  journey: "/journey.jpg",
  play: "/play.jpg"
};

class InstantImage {
  constructor() {
    this.complete = false;
  }

  set src(value) {
    this._src = value;
    this.complete = true;
    Promise.resolve().then(() => this.onload?.());
  }

  decode() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  window.Image = InstantImage;
});

test("keeps a decoded backdrop visible while switching between menu areas", async () => {
  const { container, rerender } = render(<MenuBackdrop activeArea="journey" backgrounds={BACKGROUNDS} />);
  expect(container.querySelector(".menu-backdrop-layer.is-visible")).toHaveStyle({ "--menu-backdrop-image": "url(/journey.jpg)" });

  rerender(<MenuBackdrop activeArea="play" backgrounds={BACKGROUNDS} />);
  await act(async () => Promise.resolve());
  expect(container.querySelector(".menu-backdrop-layer.is-visible")).toHaveStyle({ "--menu-backdrop-image": "url(/play.jpg)" });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
