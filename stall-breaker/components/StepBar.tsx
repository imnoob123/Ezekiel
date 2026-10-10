// Segmented bar: one segment per micro-step.
export default function StepBar({ total, done }: { total: number; done: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-full transition-all duration-500 ${
            i < done
              ? "bg-accent shadow-[0_0_10px_rgba(139,92,246,0.8)]"
              : i === done
                ? "breathe bg-accent/45"
                : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}
