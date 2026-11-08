import { HelpProvider } from "./AuthoringHelp";
const render = element => renderWithoutHelp(element, { wrapper: ({ children }) => <HelpProvider value={require("../../../server/adminAuthoringGuide").help}>{children}</HelpProvider> });
import { fireEvent, render as renderWithoutHelp, screen, waitFor } from "@testing-library/react";
import AssetUpload from "./AssetUpload";
import AssetPicker from "./AssetPicker";
import AssetCapacity from "./AssetCapacity";

test("upload is explicit, bounded and keeps its retry identity after an uncertain result", async () => {
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  const upload = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce({ uploaded: { id: "version-a" } }), done = jest.fn();
  render(<AssetUpload onUpload={upload} onDone={done} />);
  fireEvent.click(screen.getByText("Upload artwork"));
  fireEvent.change(screen.getByLabelText("Artwork title"), { target: { value: "A new image" } });
  fireEvent.change(screen.getByLabelText("Image file"), { target: { files: [new File(["image bytes"], "image.png", { type: "image/png" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload new artwork" }));
  await screen.findByRole("alert"); expect(done).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Upload new artwork" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith("version-a"));
  expect(upload.mock.calls[0][0].requestId).toBe(upload.mock.calls[1][0].requestId);
  expect(upload.mock.calls[0][0].assetId).toBeUndefined();
});

test("audio preview is explicit, authenticated and never autoplays", async () => {
  const asset = { id:"audio-version-a", assetId:"audio-a", version:1, label:"Dialogue", path:"/api/admin/authoring/assets/audio-version-a", mediaType:"audio/wav", durationMs:1000, bytes:16044, stage:"Uploaded · private" };
  const request = jest.fn().mockResolvedValue({ mediaType:"audio/wav",data:"eA==" });
  const { container } = render(<AssetPicker media="audio" library={[asset]} value={asset.id} request={request} onUpload={jest.fn()} onSelect={jest.fn()} onClose={jest.fn()} />);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText(/1.0 seconds · PCM WAV/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{ name:"Load private audio preview" }));
  await waitFor(()=>expect(container.querySelector("audio")).not.toBeNull());
  expect(request).toHaveBeenCalledWith(asset.path);
  expect(container.querySelector("audio")).toHaveAttribute("preload","none");
  expect(container.querySelector("audio")).not.toHaveAttribute("autoplay");
  fireEvent.click(screen.getByText("Upload audio"));
  expect(screen.getByLabelText("Audio file")).toHaveAttribute("accept","audio/wav,.wav");
});

test("capacity distinguishes authoring references from measured remote usage", async () => {
  const request=jest.fn().mockResolvedValue({storedBytes:100,reservedBytes:200,maxBytes:1048576,remainingBytes:1048376,usageSource:"Private bucket objects and database reservations"});
  render(<AssetCapacity request={request} value={{provider:"supabase-immutable-media-v1",storedBytes:0,maxBytes:1048576,remainingBytes:1048576,versionCount:0,maxVersions:5000,remainingVersions:5000,encodedBytes:0,metadataBytes:10,statePayloadBytes:100,uniqueBlobCount:0,usageSource:"References only"}} />);
  fireEvent.click(screen.getByRole("button",{name:"Refresh storage usage"}));
  await screen.findByText(/Private bucket objects and database reservations/);
  expect(request).toHaveBeenCalledWith("/api/admin/authoring/assets-usage");
  expect(screen.getByText(/including interrupted uploads/)).toBeInTheDocument();
});

test("replacement chooses the logical asset; private media is fetched with the admin request", async () => {
  const asset = { id: "version-a", assetId: "logical-a", version: 1, label: "Image A", path: "/api/admin/authoring/assets/version-a", mediaType: "image/webp", width: 64, height: 64, bytes: 100, stage: "Uploaded · private", archived: false };
  const request = jest.fn().mockResolvedValue({ mediaType: "image/webp", data: "eA==" }), upload = jest.fn(), archive = jest.fn();
  render(<AssetPicker library={[asset, { ...asset, id: "version-b", archived: true }]} value="version-a" request={request} onUpload={upload} onArchive={archive} onSelect={jest.fn()} onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getAllByRole("img").some(img => img.getAttribute("src") === "data:image/webp;base64,eA==")).toBe(true));
  expect(request).toHaveBeenCalledWith(asset.path);
  fireEvent.click(screen.getByText("Upload artwork"));
  fireEvent.click(screen.getByLabelText(/New version of Image A/));
  expect(screen.getByLabelText("Artwork title")).toHaveValue("Image A");
  expect(screen.getByRole("button", { name: "Upload new version" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Archive asset from picker" }));
  expect(archive).toHaveBeenCalledWith({ assetId: "logical-a", archived: true });
});
