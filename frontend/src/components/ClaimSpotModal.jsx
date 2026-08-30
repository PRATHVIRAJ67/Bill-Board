import { useState } from "react";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { claimSpotInBackend } from "@/lib/api";

const PRESET_COLORS = [
  "#00c48c", // Neon Emerald
  "#2f7dff", // Royal Cyber Blue
  "#ff5b6a", // Electric Crimson
  "#ff9c3a", // Amber Gold
  "#ac6bff", // Deep Violet
  "#69ffcc", // Mint Glow
  "#ff6f47", // Vivid Coral
  "#8be04e", // Lime Glow
];

const LINK_TYPES = [
  { id: "website",   label: "Website 🌐",   prefix: "https://" },
  { id: "instagram", label: "Instagram 📸", prefix: "https://instagram.com/" },
  { id: "telegram",  label: "Telegram ✈️",  prefix: "https://t.me/" },
  { id: "twitter",   label: "Twitter / X 🐦", prefix: "https://x.com/" },
  { id: "custom",    label: "Custom Link 🔗", prefix: "https://" },
];

const CATEGORIES = ["Brand", "SaaS", "AI", "Creator", "DevTool", "Game", "Music", "Culture", "Studio", "Media"];

export default function ClaimSpotModal({ spot, onClose, onClaimSuccess }) {
  const [handle, setHandle] = useState("");
  const [linkType, setLinkType] = useState("website");
  const [linkUrl, setLinkUrl] = useState("");
  const [category, setCategory] = useState("Brand");
  const [color, setColor] = useState("#00c48c");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!spot) return null;

  const price = spot.price || 25;

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!handle.trim()) {
      setErrorMsg("Please enter your brand handle or name.");
      return;
    }

    let finalHandle = handle.trim();
    if (!finalHandle.startsWith("@") && linkType !== "custom") {
      finalHandle = `@${finalHandle}`;
    }

    let finalUrl = linkUrl.trim();
    if (!finalUrl && linkType === "instagram") finalUrl = `https://instagram.com/${finalHandle.replace("@", "")}`;
    if (!finalUrl && linkType === "telegram") finalUrl = `https://t.me/${finalHandle.replace("@", "")}`;
    if (!finalUrl && linkType === "twitter") finalUrl = `https://x.com/${finalHandle.replace("@", "")}`;
    if (!finalUrl && linkType === "website") finalUrl = `https://${finalHandle.replace("@", "")}.io`;

    setErrorMsg("");
    setIsProcessing(true);

    const spotPayload = {
      handle: finalHandle,
      category,
      color,
      link_type: linkType,
      link_url: finalUrl,
    };

    // Trigger Razorpay Payment Gateway Checkout
    await openRazorpayCheckout({
      amountUSD: price,
      spotId: spot.id,
      handle: finalHandle,
      spotPayload,
      onSuccess: async (payDetails) => {
        // Save via Backend API (100% backend handled)
        const res = await claimSpotInBackend(spot.id, {
          ...spotPayload,
          paymentId: payDetails.paymentId,
        });
        setIsProcessing(false);
        if (res.success) {
          onClaimSuccess(res.spot || { id: spot.id, ...spotPayload, claimed: true });
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to update spot. Try again.");
        }
      },
      onFailure: (err) => {
        setIsProcessing(false);
        setErrorMsg(typeof err === "string" ? err : "Payment checkout cancelled.");
      },
    });
  };

  return (
    <div className="claim-modal-overlay" onClick={onClose} data-testid="claim-modal-overlay">
      <div
        className="claim-modal-card"
        onClick={(e) => e.stopPropagation()}
        data-testid="claim-modal-card"
      >
        <button
          type="button"
          className="claim-modal-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="claim-modal-header">
          <div className="claim-header-top">
            <span className="claim-spot-tag">SPOT #{String(spot.id).padStart(2, "0")} · EDITION #1</span>
            <span className="onetime-tag">LIFETIME OWNERSHIP</span>
          </div>
          <h2>PUT YOUR BRAND ON THE BOARD</h2>
          <div className="claim-price-bar">
            <span className="price-label">LIFETIME SPOT PRICE:</span>
            <strong className="price-val">${price} USD</strong>
            <span className="zero-fees-badge">⚡ ZERO MONTHLY FEES</span>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="claim-form">
          {errorMsg && <div className="claim-error">{errorMsg}</div>}

          {/* Form Field 1: Brand Handle / Name */}
          <div className="form-group">
            <label>1. BRAND HANDLE / NAME *</label>
            <input
              type="text"
              placeholder="@mybrand or My Startup"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              required
              maxLength={24}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
            />
          </div>

          {/* Form Field 2: Link Type */}
          <div className="form-group">
            <label>2. CHOOSE DESTINATION TYPE</label>
            <div className="link-type-grid">
              {LINK_TYPES.map((lt) => (
                <button
                  type="button"
                  key={lt.id}
                  className={`link-type-btn ${linkType === lt.id ? "active" : ""}`}
                  onClick={() => setLinkType(lt.id)}
                >
                  {lt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Field 3: Destination URL */}
          <div className="form-group">
            <label>3. DESTINATION URL (WHEN CLICKED)</label>
            <input
              type="url"
              placeholder={
                linkType === "telegram" ? "https://t.me/yourchannel" :
                linkType === "instagram" ? "https://instagram.com/yourbrand" :
                linkType === "twitter" ? "https://x.com/yourbrand" : "https://yourwebsite.com"
              }
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
            />
          </div>

          {/* Form Field 4: Category & Color */}
          <div className="form-row-2">
            <div className="form-group">
              <label>4. CATEGORY</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>5. BRAND COLOR</label>
              <div className="color-presets">
                {PRESET_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color-btn ${color === c ? "active" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="claim-live-preview">
            <div className="preview-top-row">
              <span className="preview-label">LIVE 3D BOARD PREVIEW</span>
              <span className="preview-indicator">● READY</span>
            </div>
            <div className="preview-panel-card" style={{ borderColor: color, boxShadow: `0 0 16px ${color}44` }}>
              <span className="pp-num">#{String(spot.id).padStart(2, "0")}</span>
              <span className="pp-handle" style={{ color: "#ffffff" }}>
                {handle.trim() || "@yourbrand"}
              </span>
              <span className="pp-cat" style={{ color: color }}>{category.toUpperCase()}</span>
            </div>
          </div>

          {/* Razorpay Submit Button */}
          <button type="submit" className="claim-pay-btn" disabled={isProcessing}>
            {isProcessing ? "PROCESSING CHECKOUT..." : `PAY WITH RAZORPAY ($${price} USD) →`}
          </button>
          <p className="pay-secure-note">🔒 Secured 256-bit Razorpay Checkout · Instant Live Board Sync</p>
        </form>
      </div>
    </div>
  );
}
