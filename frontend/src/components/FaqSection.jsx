import { useState } from "react";
import { audioManager } from "@/lib/audioManager";

const FAQ_ITEMS = [
  {
    q: "What is The Internet's Billboard?",
    a: "The Internet's Billboard is a limited-edition, interactive 3D digital advertising landmark. There are only 20 permanent spots available on Billboard #1. Once claimed, your brand, handle, custom color, and direct website link are etched onto the billboard forever.",
  },
  {
    q: "Is it really a one-time purchase for lifetime ownership?",
    a: "Yes! There are zero recurring fees, no monthly subscriptions, and no renewal charges. Once you claim your spot, it remains live permanently on The Board with lifetime visibility.",
  },
  {
    q: "How does the Leaderboard Ranking work?",
    a: "Ranking is determined by prime billboard hierarchy: Center Prime spots ($125) hold Rank #1 and #2 with gold crown badges. Inner Ring spots ($75) hold ranks #3–#6, followed by Mid Ring ($50) and Edge spots ($25).",
  },
  {
    q: "Can I update my brand name, link, or color after purchasing?",
    a: "Yes! If you ever want to update your destination URL, brand handle, category, or colorway, you can reach out via the Contact section or support with your payment receipt ID.",
  },
  {
    q: "How are payments processed?",
    a: "Payments are processed securely through Razorpay with 256-bit encryption. We support UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and International Cards. Your billboard panel updates live immediately upon payment confirmation.",
  },
  {
    q: "What types of websites and links can I promote?",
    a: "You can promote startups, personal portfolios, SaaS products, YouTube/Twitch channels, X/Twitter handles, Telegram communities, and business websites. Malicious, deceptive, or illegal content is strictly prohibited.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleIndex = (index) => {
    audioManager.playSelect();
    setOpenIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <section id="faq" className="faq-section" data-testid="faq-section">
      <div className="section-container">
        <div className="section-header">
          <div className="section-eyebrow">◈ FREQUENTLY ASKED QUESTIONS</div>
          <h2 className="section-title">
            EVERYTHING YOU NEED TO <em>KNOW</em>
          </h2>
          <p className="section-subtitle">
            Got questions about claiming your lifetime spot? Here is everything answered.
          </p>
        </div>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`faq-card ${isOpen ? "is-open" : ""}`}
                onClick={() => toggleIndex(i)}
                data-testid={`faq-item-${i}`}
              >
                <div className="faq-question-row">
                  <span className="faq-number">0{i + 1}</span>
                  <h3 className="faq-question">{item.q}</h3>
                  <span className="faq-toggle-icon">{isOpen ? "−" : "+"}</span>
                </div>
                {isOpen && (
                  <div className="faq-answer">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
