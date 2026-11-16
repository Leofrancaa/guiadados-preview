import {
  Croissant,
  IceCreamCone,
  PawPrint,
  Pill,
  Scissors,
  Shirt,
  ShoppingCart,
  Store,
  Tractor,
  UtensilsCrossed,
  type LucideProps,
} from "lucide-react";

const icones = {
  Croissant,
  ShoppingCart,
  UtensilsCrossed,
  Shirt,
  Pill,
  IceCreamCone,
  PawPrint,
  Scissors,
  Tractor,
} as const;

export function SegmentoIcone({
  nome,
  ...props
}: { nome: string } & LucideProps) {
  const Icone = icones[nome as keyof typeof icones] ?? Store;
  return <Icone aria-hidden="true" {...props} />;
}
