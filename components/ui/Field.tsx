import * as React from "react";

export function FieldLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`label ${props.className ?? ""}`} {...props} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea className={`textarea ${props.className ?? ""}`} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${props.className ?? ""}`} {...props} />;
}

