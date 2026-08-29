import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyBids } from "../api/bids";
import { confirmCollection } from "../api/transactions";

function MyOffers() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    const fetchBids = async () => {
      try {
        const res = await getMyBids();
        setBids(res.bids);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load offers");
      } finally {
        setLoading(false);
      }
    };

    fetchBids();
  }, []);

  const handleConfirmCollection = async (transactionId) => {
    setConfirmingId(transactionId);

    try {
      const res = await confirmCollection(transactionId);

      setBids((prev) =>
        prev.map((bid) =>
          bid.transaction?._id === transactionId
            ? { ...bid, transaction: res.transaction }
            : bid,
        ),
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to confirm collection");
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7faf7] flex items-center justify-center">
        <p className="text-gray-500 font-medium">Loading offers...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7faf7] text-gray-800">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          My Offers
        </h1>

        {error && (
          <div className="mt-5 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {bids.length === 0 ? (
          <div className="bg-white mt-6 p-12 rounded-2xl border border-gray-100 text-center text-gray-500">
            No offers submitted yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {bids.map((bid) => (
              <div
                key={bid._id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {bid.listing?.title || "Listing removed"}
                    </h2>

                    {bid.listing && (
                      <p className="text-gray-500 text-sm mt-0.5">
                        Material: {bid.listing.materialType}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      bid.status === "Accepted"
                        ? "bg-emerald-100 text-emerald-700"
                        : bid.status === "Rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {bid.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-gray-700 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <p>
                    <span className="font-semibold">Your Offer:</span> ৳
                    {bid.amount}
                  </p>

                  <p>
                    <span className="font-semibold">Your Message:</span>{" "}
                    {bid.message}
                  </p>
                </div>

                {bid.status === "Accepted" && (
                  <div className="mt-5">
                    <p className="text-emerald-700 font-semibold text-sm mb-3">
                      🎉 Seller accepted your offer!
                    </p>

                    {bid.transaction?._id &&
                      (bid.transaction.paymentStatus === "Pending" ? (
                        <Link
                          to={`/payment/${bid.transaction._id}`}
                          className="inline-block px-5 py-2.5 bg-emerald-700 text-white font-semibold text-sm rounded-xl hover:bg-emerald-800 shadow-sm hover:shadow transition"
                        >
                          Pay Now
                        </Link>
                      ) : bid.transaction.paymentStatus === "Held" ? (
                        bid.transaction.buyerConfirmed ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-xl border border-blue-100">
                            Paid — waiting for seller to confirm receipt
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleConfirmCollection(bid.transaction._id)
                            }
                            disabled={confirmingId === bid.transaction._id}
                            className="inline-block px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 shadow-sm hover:shadow transition disabled:opacity-60 cursor-pointer"
                          >
                            {confirmingId === bid.transaction._id
                              ? "Confirming..."
                              : "Confirm Collection Received"}
                          </button>
                        )
                      ) : bid.transaction.paymentStatus === "Released" ? (
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl border border-emerald-100">
                          ✓ Paid & released
                        </span>
                      ) : null)}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(listing._id)}
                  className="inline-block px-5 py-2.5 bg-emerald-700 text-white font-semibold text-sm rounded-xl hover:bg-red-700 shadow-sm hover:shadow transition"
                >
                  Withdraw Bid
                </button>


                {bid.status === "Pending" && (
                  <p className="mt-4 text-amber-700 text-sm font-medium">
                    Waiting for seller response.
                  </p>
                )}

                {bid.status === "Rejected" && (
                  <p className="mt-4 text-red-700 text-sm font-medium">
                    Seller rejected your offer.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default MyOffers;
