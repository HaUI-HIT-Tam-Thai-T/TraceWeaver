import { Input } from "./Input";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

// The calendar edits whole seconds; fractional seconds stay separate and are never rounded by Date.
export function PreciseDateTimeField({ id, label, value, onChange, invalid, describedBy }: Props) {
  const [base = "", fraction = ""] = value.split(".");
  function updateBase(next: string) {
    onChange(next ? `${next}${fraction ? `.${fraction}` : ""}` : "");
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="type-label block">
        {label}
      </label>
      <Input
        id={id}
        type="datetime-local"
        step="1"
        value={base}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onInput={(event) => updateBase(event.currentTarget.value)}
        onChange={(event) => updateBase(event.target.value)}
      />
      <details>
        <summary className="type-caption cursor-pointer text-muted">
          Độ chính xác phần giây {fraction ? `(.${fraction})` : "(không có)"}
        </summary>
        <label htmlFor={`${id}-fraction`} className="type-label block">
          Chữ số sau dấu thập phân (tùy chọn)
        </label>
        <Input
          id={`${id}-fraction`}
          inputMode="numeric"
          value={fraction}
          disabled={!base}
          onChange={(event) => {
            if (/^\d*$/.test(event.target.value))
              onChange(`${base}${event.target.value ? `.${event.target.value}` : ""}`);
          }}
        />
      </details>
    </div>
  );
}
