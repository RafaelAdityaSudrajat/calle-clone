// src/pages/dashboard-secondary/type/type-input-field.ts
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type BaseProps = {
  label: string;
  placeholder?: string;
  isTextArea?: false;
  isSelect?: false;
};

type TextAreaProps = {
  label: string;
  placeholder?: string;
  isTextArea: true;
  isSelect?: false;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

type SelectProps = {
  label: string;
  placeholder?: string;
  isTextArea?: false;
  isSelect: true;
  children?: React.ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;

type InputFieldProps = InputProps | TextAreaProps | SelectProps;

export type { InputFieldProps };
