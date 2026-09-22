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
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed mb-6">{msg}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
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
