import { useEffect, useRef, useState } from "react";
import "./ProfileAvatar.css";

const ACCEPTED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const PORTRAIT_SIZE = 512;

function avatarRecord(subject) {
  return subject?.avatar || subject?.profile?.avatar || null;
}

export function resolveProfileAvatarUrl(subject, serverUrl = "") {
  const avatar = avatarRecord(subject);
  const source = avatar?.url || avatar?.path || subject?.avatarUrl || "";
  if (!source) return "";
  if (/^(?:data:|blob:|https?:)/i.test(source)) return source;
  const base = String(serverUrl || "").replace(/\/$/, "");
  return `${base}${source.startsWith("/") ? source : `/${source}`}`;
}

function imageInitial(name) {
  return String(name || "G").trim().slice(0, 1).toUpperCase() || "G";
}

export function PlayerAvatar({ subject, name, serverUrl = "", size = "medium", className = "", decorative = false }) {
  const source = resolveProfileAvatarUrl(subject, serverUrl);
  const [failedSource, setFailedSource] = useState("");
  const visibleSource = source && source !== failedSource ? source : "";
  const label = `${name || subject?.name || subject?.displayName || "Player"} portrait`;

  return (
    <span
      className={`player-avatar player-avatar-${size}${visibleSource ? " has-image" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
    >
      {visibleSource
        ? <img src={visibleSource} alt="" onError={() => setFailedSource(source)} />
        : <span aria-hidden="true">{imageInitial(name || subject?.name || subject?.displayName)}</span>}
    </span>
  );
}

async function loadProfileImage(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("That image could not be read."));
  });
  image.src = objectUrl;
  await loaded;
  return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(objectUrl) };
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareProfilePortrait(file) {
  if (!file || !ACCEPTED_PROFILE_IMAGE_TYPES.has(file.type)) throw new Error("Choose a PNG, JPG, or WEBP image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 8 MB.");

  const loaded = await loadProfileImage(file);
  try {
    const side = Math.min(loaded.width, loaded.height);
    const sourceX = Math.max(0, (loaded.width - side) / 2);
    const sourceY = Math.max(0, (loaded.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = PORTRAIT_SIZE;
    canvas.height = PORTRAIT_SIZE;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Portrait processing is unavailable in this browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.image, sourceX, sourceY, side, side, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    const webp = await canvasBlob(canvas, "image/webp", 0.86);
    const portrait = webp || await canvasBlob(canvas, "image/jpeg", 0.88);
    if (!portrait) throw new Error("The portrait could not be prepared.");
    return portrait;
  } finally {
    loaded.release();
  }
}

export function ProfilePortraitEditor({ account, authToken, serverUrl, onAccountUpdated }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => setStatus(""), [account?.profile?.avatar?.revision]);

  async function uploadPortrait(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authToken || uploading) return;
    setUploading(true);
    setStatus("Preparing square portrait…");
    try {
      const portrait = await prepareProfilePortrait(file);
      setStatus("Securing portrait…");
      const response = await fetch(`${String(serverUrl || "").replace(/\/$/, "")}/api/account/avatar`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": portrait.type
        },
        body: portrait
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The portrait could not be saved.");
      onAccountUpdated?.(data.account);
      setStatus("Portrait live across your Gauntlet identity.");
    } catch (error) {
      setStatus(error.message || "The portrait could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-portrait-editor">
      <input
        ref={inputRef}
        className="profile-portrait-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={uploadPortrait}
        disabled={!account || uploading}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={!account || uploading}>
        {uploading ? "Saving portrait…" : account?.profile?.avatar ? "Change portrait" : "Upload portrait"}
      </button>
      <small>PNG, JPG, or WEBP · centered square crop · 8 MB max</small>
      {status && <span className="profile-portrait-status" role="status">{status}</span>}
    </div>
  );
}
