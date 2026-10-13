import { render, screen, waitFor } from "@testing-library/react";
import { PrivateAssetProvider, PrivateImage } from "./PrivateAsset";
test("visible private versions share one authenticated read and failed versions stay visibly unavailable", async () => {
  const request = jest.fn(path => path.endsWith("bad") ? Promise.reject(new Error("Unavailable")) : Promise.resolve({ mediaType: "image/webp", data: "YWJj" }));
  render(<PrivateAssetProvider request={request}><PrivateImage src="/api/admin/authoring/assets/a" alt="First" /><PrivateImage src="/api/admin/authoring/assets/a" alt="Second" /><PrivateImage src="/api/admin/authoring/assets/bad" alt="Broken" /></PrivateAssetProvider>);
  await waitFor(() => expect(screen.getByAltText("First")).toHaveAttribute("src", "data:image/webp;base64,YWJj"));
  expect(screen.getByAltText("Second")).toHaveAttribute("src", "data:image/webp;base64,YWJj");
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("alert")).toHaveTextContent("Artwork unavailable");
  expect(screen.queryByAltText("Broken")).not.toBeInTheDocument();
});
