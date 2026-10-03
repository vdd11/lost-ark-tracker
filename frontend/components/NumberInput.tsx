"use client";

import { ComponentProps } from "react";

import { digitsOnly, withCommas } from "@/lib/numbers";

/**
 * A whole-number input (gold, mostly) that shows commas as you type:
 * 250000 reads as 250,000. `value` and `onChange` use plain digits ("250000").
 */
export default function NumberInput({
  value,
  onChange,
  ...props
}: { value: string; onChange: (digits: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange" | "type">) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={withCommas(digitsOnly(value))}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
    />
  );
}
