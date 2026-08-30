import { useState } from "react";
import { audioManager } from "@/lib/audioManager";

export const POLICIES = {
  terms: {
    id: "terms",
    title: "Terms & Conditions",
    subtitle: "Rules and terms governing the purchase and display of digital billboard spots.",
    lastUpdated: "August 30, 2026",
    content: (
      <>
        <h4>1. Agreement to Terms</h4>
        <p>
          By accessing or using The Internet's Billboard ("the Service", "we", "us"), you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not purchase or use the Service.
        </p>

        <h4>2. Digital Advertising Spots</h4>
        <p>
          The Internet's Billboard provides 20 limited-edition digital advertising spots on a shared interactive 3D billboard canvas. Spots are granted on a lifetime basis for a one-time fee with no recurring monthly subscriptions.
        </p>

        <h4>3. Content Guidelines & Prohibited Use</h4>
        <p>
          You agree that any brand handle, text, link, or media submitted for display will NOT contain:
        </p>
        <ul>
          <li>Malicious software, phishing schemes, scams, or fraudulent initiatives.</li>
          <li>Explicit adult, pornographic, violent, defamatory, or hateful content.</li>
          <li>Infringement of copyright, trademark, or intellectual property rights of others.</li>
          <li>Content violating Indian laws or international cyber regulations.</li>
        </ul>
        <p>
          We reserve the right to modify or remove content that violates these guidelines without refund.
        </p>

        <h4>4. Availability and Service Uptime</h4>
        <p>
          While we strive for 99.9% server and 3D engine availability, the Service is provided "as is" and "as available". Scheduled maintenance and cloud infrastructure updates may cause temporary interruptions.
        </p>

        <h4>5. Contact Information</h4>
        <p>
          For any legal or service inquiries, please contact <strong>prathviholla67@gmail.com</strong>.
        </p>
      </>
    ),
  },

  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How we collect, use, and protect your information.",
    lastUpdated: "August 30, 2026",
    content: (
      <>
        <h4>1. Information We Collect</h4>
        <p>
          When you claim a spot or interact with our platform, we collect:
        </p>
        <ul>
          <li><strong>Brand Information:</strong> Your brand name/handle, category, preferred colorway, and destination link (which are made public on the billboard).</li>
          <li><strong>Contact Details:</strong> Your email address (for payment receipts and spot update verifications).</li>
          <li><strong>Transaction Identifiers:</strong> Razorpay Payment ID and Order ID for transaction fulfillment and verification.</li>
        </ul>

        <h4>2. Payment Security</h4>
        <p>
          We do <strong>NOT</strong> collect, store, or process any credit card numbers, CVVs, net banking passwords, or UPI PINs. All financial transactions are processed securely through Razorpay's PCI-DSS compliant 256-bit encrypted payment gateway.
        </p>

        <h4>3. How We Use Information</h4>
        <p>
          Collected data is used solely for rendering your billboard space in real-time, verifying transaction authenticity, providing customer support, and preventing fraud.
        </p>

        <h4>4. Third-Party Services</h4>
        <p>
          We utilize trusted third-party providers including <strong>Razorpay</strong> (payment processing) and <strong>Supabase</strong> (real-time cloud database). We never sell, rent, or trade your personal data.
        </p>
      </>
    ),
  },

  refund: {
    id: "refund",
    title: "Refund & Cancellation Policy",
    subtitle: "Clear policies on payments, digital fulfillment, and refunds.",
    lastUpdated: "August 30, 2026",
    content: (
      <>
        <h4>1. Digital Goods Nature</h4>
        <p>
          Billboard spots on The Internet's Billboard are custom, instantaneous digital goods. Once a spot claim transaction is approved by Razorpay and synchronized to our live 3D billboard and public database, the spot is permanently registered.
        </p>

        <h4>2. Refund Policy</h4>
        <p>
          Due to the immediate digital fulfillment and permanent allocation of billboard space:
        </p>
        <ul>
          <li><strong>Successful Claims:</strong> Completed and successfully rendered spot claims are generally non-refundable.</li>
          <li><strong>Technical Failures / Double Charges:</strong> In the rare event of a duplicate charge or where payment succeeded but a technical error prevented your spot from being claimed, you are entitled to a <strong>100% full refund</strong>.</li>
        </ul>

        <h4>3. How to Request a Refund or Adjustment</h4>
        <p>
          If you encountered a billing error or need a spot update, email us at <strong>prathviholla67@gmail.com</strong> with your Razorpay Payment ID within 7 days of transaction. Eligible refunds will be credited back to your original payment method (Card/UPI/NetBanking) within 5–7 business days as per banking standards.
        </p>
      </>
    ),
  },

  delivery: {
    id: "delivery",
    title: "Shipping & Delivery Policy",
    subtitle: "Real-time digital fulfillment and delivery confirmation.",
    lastUpdated: "August 30, 2026",
    content: (
      <>
        <h4>1. Digital Delivery Only</h4>
        <p>
          The Internet's Billboard provides strictly digital advertising spaces. No physical goods or packages are shipped.
        </p>

        <h4>2. Fulfillment Timeline</h4>
        <p>
          <strong>Immediate Real-Time Delivery:</strong> Upon successful completion of payment via Razorpay, your chosen brand handle, color scheme, category, and destination link are written to the live Supabase database and rendered across the interactive 3D billboard canvas within seconds.
        </p>

        <h4>3. Delivery Confirmation</h4>
        <p>
          A digital receipt containing your Razorpay Payment ID and spot allocation is displayed on-screen, and a payment confirmation receipt is automatically dispatched to the email entered during checkout.
        </p>
      </>
    ),
  },

  contact: {
    id: "contact",
    title: "Contact & Merchant Information",
    subtitle: "Official merchant identity and direct support channels.",
    lastUpdated: "August 30, 2026",
    content: (
      <>
        <h4>Merchant & Legal Entity</h4>
        <div className="policy-merchant-info">
          <p><strong>Brand Name:</strong> The Internet's Billboard</p>
          <p><strong>Merchant / Founder:</strong> Prathviraj Holla</p>
          <p><strong>Support Email:</strong> <a href="mailto:prathviholla67@gmail.com">prathviholla67@gmail.com</a></p>
          <p><strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/prathviraj-holla-727a98256/" target="_blank" rel="noreferrer">prathviraj-holla</a></p>
          <p><strong>Operating Location:</strong> Karnataka, India</p>
          <p><strong>Customer Support Hours:</strong> Monday – Saturday, 9:00 AM – 9:00 PM IST (Response within 24h)</p>
        </div>
      </>
    ),
  },
};

export default function PolicyModal({ policyKey = "terms", onClose }) {
  const [activeTab, setActiveTab] = useState(policyKey);

  if (!policyKey) return null;

  const currentPolicy = POLICIES[activeTab] || POLICIES.terms;

  return (
    <div className="policy-modal-overlay" onClick={onClose} data-testid="policy-modal-overlay">
      <div
        className="policy-modal-card"
        onClick={(e) => e.stopPropagation()}
        data-testid="policy-modal-card"
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

        {/* Modal Navigation Tabs */}
        <div className="policy-tabs-nav">
          <button
            className={`policy-tab-btn ${activeTab === "terms" ? "active" : ""}`}
            onClick={() => {
              audioManager.playSelect();
              setActiveTab("terms");
            }}
          >
            Terms & Conditions
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => {
              audioManager.playSelect();
              setActiveTab("privacy");
            }}
          >
            Privacy Policy
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "refund" ? "active" : ""}`}
            onClick={() => {
              audioManager.playSelect();
              setActiveTab("refund");
            }}
          >
            Refund Policy
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "delivery" ? "active" : ""}`}
            onClick={() => {
              audioManager.playSelect();
              setActiveTab("delivery");
            }}
          >
            Shipping / Delivery
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "contact" ? "active" : ""}`}
            onClick={() => {
              audioManager.playSelect();
              setActiveTab("contact");
            }}
          >
            Contact Info
          </button>
        </div>

        {/* Policy Body */}
        <div className="policy-content-container">
          <div className="policy-header">
            <span className="policy-tag">LEGAL & COMPLIANCE</span>
            <h2>{currentPolicy.title}</h2>
            <p className="policy-sub">{currentPolicy.subtitle}</p>
            <span className="policy-updated">Last Updated: {currentPolicy.lastUpdated}</span>
          </div>

          <div className="policy-body-text">
            {currentPolicy.content}
          </div>
        </div>

        <div className="policy-modal-footer">
          <p>🔒 Compliant with Razorpay Merchant Terms & Digital Services Standards</p>
          <button className="policy-close-btn" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
