"use client";

export function ConfirmModal({
  msg,
  okLabel = "Obriši",
  okColor = "red",
  onOk,
  onCancel,
}: {
  msg: string;
  okLabel?: string;
  okColor?: "red" | "amber";
  onOk: () => void;
  onCancel: () => void;
}) {
  const btnClass =
    okColor === "amber"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-red-600 hover:bg-red-700 text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-gray-800 text-sm leading-relaxed mb-6">{msg}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Odustani
          </button>
          <button onClick={onOk} className={`px-4 py-2 text-sm rounded-lg font-medium ${btnClass}`}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
