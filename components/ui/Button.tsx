import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const variantClass = variant === "primary" ? "btn-primary" : "btn-secondary";
  return <button className={`btn ${variantClass} ${className ?? ""}`} {...props} />;
}

