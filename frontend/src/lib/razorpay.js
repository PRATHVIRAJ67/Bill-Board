/**
 * Razorpay Standard Web Checkout Integration
 */
import { createRazorpayOrder, verifyRazorpayPayment } from './api';

// Dynamically load Razorpay SDK
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay Payment Gateway Checkout Modal
 */
export async function openRazorpayCheckout({
  amountUSD,
  spotId,
  handle,
  spotPayload = {},
  onSuccess,
  onFailure,
  onOrderCreated,
}) {
  // 1. Ensure Razorpay SDK is loaded
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    if (onFailure) onFailure("Razorpay SDK failed to load. Please check your network connection.");
    return;
  }

  // 2. Step 1: Create Order on Backend
  const orderRes = await createRazorpayOrder({
    amountUSD,
    spotId,
    handle,
  });

  if (!orderRes.success || !orderRes.data?.order_id) {
    if (onFailure) onFailure(orderRes.error || "Failed to create order on server. Please try again.");
    return;
  }

  const orderData = orderRes.data;
  if (onOrderCreated) onOrderCreated(orderData);

  // Get Public Key ID from environment
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.REACT_APP_RAZORPAY_KEY_ID)) ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_RAZORPAY_KEY_ID) ||
    "rzp_test_TVtzzS51l0oAyp";

  // 3. Step 2: Configure Checkout Modal Options
  const options = {
    key: key,
    amount: orderData.amount,
    currency: orderData.currency || "INR",
    name: "THE BOARD",
    description: `Claim Spot #${String(spotId).padStart(2, "0")} (${handle})`,
    order_id: orderData.order_id,
    prefill: {
      name: handle.replace(/^@/, ""),
      email: "billing@theboard.live",
      contact: "9999999999",
    },
    theme: {
      color: spotPayload.color || "#00c48c",
    },
    // On Payment Success in Modal
    handler: async function (response) {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = response;

      // 4. Step 3: Verify Payment Signature via Backend
      const verifyRes = await verifyRazorpayPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        spotId,
      });

      if (verifyRes.success) {
        if (onSuccess) {
          onSuccess({
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            spotId,
            handle,
          });
        }
      } else {
        if (onFailure) {
          onFailure(verifyRes.error || "Payment verification signature check failed.");
        }
      }
    },
    modal: {
      ondismiss: function () {
        if (onFailure) onFailure("Payment checkout cancelled by user.");
      },
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    
    // Attach payment.failed event handler
    rzp.on("payment.failed", function (response) {
      console.error("Razorpay Payment Failed:", response.error);
      if (onFailure) {
        onFailure(`Payment failed: ${response.error.description || response.error.reason || 'Transaction declined'}`);
      }
    });

    rzp.open();
  } catch (err) {
    console.error("Razorpay Modal launch error:", err);
    if (onFailure) onFailure(err.message || "Failed to open payment gateway.");
  }
}
