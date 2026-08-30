import { useState } from "react";
import { audioManager } from "@/lib/audioManager";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    topic: "sponsorship",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    audioManager.playAction();
    setLoading(true);

    try {
      // Send directly to prathviholla67@gmail.com via FormSubmit AJAX API
      const res = await fetch("https://formsubmit.co/ajax/prathviholla67@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          topic: formData.topic,
          message: formData.message,
          _subject: `[The Board] New Inquiry from ${formData.name} - ${formData.topic.toUpperCase()}`,
          _template: "table",
        }),
      });

      if (res.ok) {
        setLoading(false);
        setSubmitted(true);
      } else {
        // Fallback: open user's default email client
        const mailtoUrl = `mailto:prathviholla67@gmail.com?subject=${encodeURIComponent(`[The Board Inquiry] ${formData.topic}`)}&body=${encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nTopic: ${formData.topic}\n\nMessage:\n${formData.message}`)}`;
        window.open(mailtoUrl, "_blank");
        setLoading(false);
        setSubmitted(true);
      }
    } catch {
      // Fallback: open mail client on network fail
      const mailtoUrl = `mailto:prathviholla67@gmail.com?subject=${encodeURIComponent(`[The Board Inquiry] ${formData.topic}`)}&body=${encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nTopic: ${formData.topic}\n\nMessage:\n${formData.message}`)}`;
      window.open(mailtoUrl, "_blank");
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <section id="contact" className="contact-section" data-testid="contact-section">
      <div className="section-container">
        <div className="section-header">
          <div className="section-eyebrow">◈ GET IN TOUCH</div>
          <h2 className="section-title">
            CONTACT & <em>PARTNERSHIPS</em>
          </h2>
          <p className="section-subtitle">
            Have questions, custom sponsorship inquiries, or need support with your spot? Reach out anytime.
          </p>
        </div>

        <div className="contact-grid">
          {/* Left Column: Direct Channels */}
          <div className="contact-channels-card">
            <h3 className="channels-title">DIRECT CHANNELS</h3>
            <p className="channels-desc">
              Connect directly with the creator of The Internet's Billboard. We respond to all inquiries within 24 hours.
            </p>

            <div className="channel-links">
              <a
                href="mailto:prathviholla67@gmail.com"
                className="channel-item"
                onClick={() => audioManager.playSelect()}
              >
                <div className="channel-icon">✉️</div>
                <div className="channel-info">
                  <span className="channel-label">EMAIL & SUPPORT</span>
                  <span className="channel-value">prathviholla67@gmail.com</span>
                </div>
                <span className="channel-arrow">↗</span>
              </a>

              <a
                href="https://www.linkedin.com/in/prathviraj-holla-727a98256/"
                target="_blank"
                rel="noopener noreferrer"
                className="channel-item"
                onClick={() => audioManager.playSelect()}
              >
                <div className="channel-icon">🔗</div>
                <div className="channel-info">
                  <span className="channel-label">LINKEDIN</span>
                  <span className="channel-value">prathviraj-holla</span>
                </div>
                <span className="channel-arrow">↗</span>
              </a>
            </div>

            <div className="channel-live-status">
              <span className="status-ping" />
              <span>SYSTEM STATUS: 100% OPERATIONAL · 20 SPOTS LIVE</span>
            </div>
          </div>

          {/* Right Column: Quick Contact Form */}
          <div className="contact-form-card">
            {submitted ? (
              <div className="contact-success-state">
                <div className="success-icon">✓</div>
                <h3>Message Sent Successfully!</h3>
                <p>
                  Thank you for reaching out, <strong>{formData.name}</strong>. We have received your inquiry and will reply to <strong>{formData.email}</strong> shortly.
                </p>
                <button
                  className="reset-form-btn"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", topic: "sponsorship", message: "" });
                  }}
                >
                  SEND ANOTHER MESSAGE
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <h3 className="form-title">SEND A MESSAGE</h3>

                <div className="form-group">
                  <label htmlFor="c-name">YOUR NAME</label>
                  <input
                    id="c-name"
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Prathviraj"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="c-email">EMAIL ADDRESS</label>
                  <input
                    id="c-email"
                    type="email"
                    name="email"
                    required
                    placeholder="prathviholla67@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="c-topic">TOPIC / INQUIRY TYPE</label>
                  <select
                    id="c-topic"
                    name="topic"
                    value={formData.topic}
                    onChange={handleChange}
                  >
                    <option value="sponsorship">Billboard Spot / Sponsorship</option>
                    <option value="link-update">Update Existing Spot Link / Handle</option>
                    <option value="bulk">Custom Multi-Spot Partnership</option>
                    <option value="technical">Technical Support / Bug Report</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="c-msg">MESSAGE</label>
                  <textarea
                    id="c-msg"
                    name="message"
                    required
                    rows={4}
                    placeholder="Tell us about your brand or question..."
                    value={formData.message}
                    onChange={handleChange}
                  />
                </div>

                <button type="submit" className="contact-submit-btn" disabled={loading}>
                  {loading ? "SENDING MESSAGE..." : "SEND MESSAGE ↗"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
