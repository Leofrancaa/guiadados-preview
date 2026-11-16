"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

export type SelectOption = {
  value: string;
  label: string;
  /** Opções com o mesmo grupo aparecem juntas, sob um título. */
  group?: string;
};

/**
 * Select com lista estilizada (Radix): teclado, leitor de tela e foco
 * funcionam como no nativo, mas a lista segue a identidade visual do painel.
 */
export function Select({
  id,
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder,
  size = "default",
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel?: string;
  /** Texto quando o valor atual não é nenhuma das opções. */
  placeholder?: string;
  size?: "default" | "compact";
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`select-trigger ${size === "compact" ? "compact" : ""}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="select-icon">
          <ChevronDown size={15} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.Viewport className="select-viewport">
            {grupos(options).map(([grupo, itens]) =>
              grupo ? (
                <SelectPrimitive.Group key={grupo} className="select-group">
                  <SelectPrimitive.Label className="select-label">
                    {grupo}
                  </SelectPrimitive.Label>
                  {itens.map(item)}
                </SelectPrimitive.Group>
              ) : (
                itens.map(item)
              ),
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** Mantém a ordem das opções, juntando as do mesmo grupo. */
function grupos(options: SelectOption[]) {
  const out: [string, SelectOption[]][] = [];
  for (const o of options) {
    const g = o.group ?? "";
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo[0] === g) ultimo[1].push(o);
    else out.push([g, [o]]);
  }
  return out;
}

function item(option: SelectOption) {
  return (
    <SelectPrimitive.Item
      key={option.value}
      value={option.value}
      className="select-item"
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="select-check">
        <Check size={14} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
